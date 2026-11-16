import crypto from 'node:crypto';
import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin.ts';
import {
  attachAuthIfPresent,
  requireAdmin,
  requireAnyPermission,
  requireAuth,
  requirePermission,
  requireProfileUnlocked,
  requireRootOwner,
  type AuthenticatedRequest,
} from './middleware.ts';
import {
  ALL_PERMISSIONS,
  assertRootProtection,
  createNotification,
  DEFAULT_ROLE_DEFINITIONS,
  getRolePermissions,
  isAdminRole,
  writeAuditLog,
} from './rbac.ts';
import {
  calculateAgeFromDob,
  encryptSensitive,
  generateRandomAdminUsername,
  generateStrongRandomPassword,
  hashPassword,
  rotateRuntimeSecrets,
  sanitizeId,
  sanitizePhotoData,
  sanitizeString,
  signSessionToken,
  signWebhookPayload,
  verifyPassword,
  verifyWebhookSignature,
} from './security.ts';
import { ensureUserReferralCode } from './referrals.ts';
import type {
  BookingLocationPoint,
  BookingRecord,
  CompanionApplicationRecord,
  CompanionProfile,
  PaymentGateway,
  PaymentRecord,
  UserAccount,
  UserRole,
} from '../types/logeasi.ts';
import {
  containsUnsafeViolenceTerm,
  DEFAULT_BENGALI_BOOKING_CATEGORIES,
  VIOLENCE_SAFETY_MESSAGE_BN,
} from '../data/bookingCategories.ts';

export const paymentsAdminRouter = Router();
paymentsAdminRouter.use(attachAuthIfPresent);

async function getActiveAdminUids(): Promise<string[]> {
  const [adminsSnap, rootLockSnap] = await Promise.all([
    adminDb.collection('admin_accounts').get(),
    adminDb.collection('platform_settings').doc('root_lock').get(),
  ]);
  const uids = new Set<string>();
  adminsSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status !== 'suspended') {
      uids.add(String(data.uid || d.id));
    }
  });
  const rootUid = rootLockSnap.data()?.rootAdminUid;
  if (rootUid) uids.add(String(rootUid));
  return Array.from(uids);
}

async function notifyAdminsOnAdvancePaymentEvent(params: {
  booking: BookingRecord;
  payment: PaymentRecord;
  phase: 'submitted' | 'verified';
}) {
  const { booking, payment, phase } = params;
  const adminUids = await getActiveAdminUids();
  const hasLiveLoc = Boolean(booking.customerLiveLocation?.lat && booking.customerLiveLocation?.lng);
  const locText = hasLiveLoc
    ? `লাইভ লোকেশন সংযুক্ত (${booking.customerLiveLocation!.lat.toFixed(4)}, ${booking.customerLiveLocation!.lng.toFixed(4)})`
    : 'কাস্টমারের লাইভ লোকেশন এখনো চাওয়া/পাওয়া যায়নি';

  const title =
    phase === 'verified'
      ? `৫০% পেমেন্ট সম্পন্ন: কাস্টমারকে ম্যাপ লোকেশন বুঝিয়ে দিন (${booking.bookingCode})`
      : `৫০% অ্যাডভান্স জমা হয়েছে: যাচাই ও ম্যাপ ডিসপ্যাচ করুন (${booking.bookingCode})`;
  const message =
    phase === 'verified'
      ? `${booking.customerName} (বুকিং ${booking.bookingCode}) BDT ৳${payment.amountBdt.toLocaleString()} (${payment.gateway.toUpperCase()}) ৫০% পেমেন্ট সম্পন্ন করেছেন। ${locText}। অ্যাডমিন প্যানেল থেকে Google Maps লোকেশন ও মিটআপ নির্দেশনা পাঠান।`
      : `${booking.customerName} (বুকিং ${booking.bookingCode}) ${payment.gateway.toUpperCase()} রেফারেন্স (${payment.senderReferenceTrxId || payment.transactionId}) জমা দিয়েছেন। ${locText}।`;

  await Promise.all([
    ...adminUids.map((uid) =>
      createNotification({
        userUid: uid,
        type: 'admin_50_payment_dispatch',
        title,
        message,
        link: `/admin/dashboard?dispatchBooking=${booking.id}`,
      })
    ),
    adminDb.collection('bookings').doc(booking.id).update({
      adminNotifiedAfter50At: new Date().toISOString(),
    }).catch(() => {}),
  ]);
}

// ========================
// PAYMENT MODULE (NO CARD/PIN STORAGE; SIGNED WEBHOOK VERIFICATION)
// ========================

async function processVerifiedPaymentWebhook(payload: {
  paymentId: string;
  transactionId: string;
  bookingId: string;
  amountBdt: number;
  currency: string;
  gateway: string;
  event: string;
}) {
  const payRef = adminDb.collection('payments').doc(payload.paymentId);
  const paySnap = await payRef.get();
  if (!paySnap.exists) {
    throw new Error('Payment transaction not found.');
  }
  const payment = paySnap.data() as PaymentRecord;

  // Idempotency guard
  if (payment.status === 'verified_paid' && payment.webhookVerified) {
    return { alreadyProcessed: true, payment };
  }

  if (payload.currency !== 'BDT' || Number(payload.amountBdt) !== payment.amountBdt) {
    throw new Error('Webhook amount/currency mismatch.');
  }

  const now = new Date().toISOString();
  if (payload.event !== 'PAYMENT_SUCCESS') {
    await payRef.update({ status: 'failed', verifiedAt: now });
    return { alreadyProcessed: false, payment: { ...payment, status: 'failed' } };
  }

  await payRef.update({
    status: 'verified_paid',
    webhookVerified: true,
    verifiedAt: now,
  });

  const bSnapBefore = await adminDb.collection('bookings').doc(payment.bookingId).get();
  const bBefore = (bSnapBefore.data() || {}) as BookingRecord;

  // Update booking status automatically AFTER verified webhook
  await adminDb.collection('bookings').doc(payment.bookingId).update({
    status: 'confirmed_paid',
    paymentStatus: 'paid',
    remainingDueBdt: 0,
    advanceStatus: 'paid',
    updatedAt: now,
  });

  // Credit companion pending balance
  const cmpRef = adminDb.collection('companion_profiles').doc(payment.companionUid);
  const cmpSnap = await cmpRef.get();
  if (cmpSnap.exists) {
    const cmp = cmpSnap.data()!;
    await cmpRef.update({
      pendingBalanceBdt: Number(cmp.pendingBalanceBdt || 0) + payment.companionNetBdt,
      updatedAt: now,
    });
  }

  await Promise.all([
    createNotification({
      userUid: payment.customerUid,
      type: 'payment_confirmed',
      title: `Payment Verified (${payment.transactionId})`,
      message: `Your BDT ৳${payment.amountBdt.toLocaleString()} payment via ${payment.gateway.toUpperCase()} is verified. Booking is now confirmed.`,
      link: '/bookings',
    }),
    createNotification({
      userUid: payment.companionUid,
      type: 'payment_confirmed',
      title: `Booking Confirmed & Paid (${payment.transactionId})`,
      message: `Escrow payment of BDT ৳${payment.amountBdt.toLocaleString()} verified. Your net earnings (BDT ৳${payment.companionNetBdt.toLocaleString()}) are held until completion.`,
      link: '/dashboard/companion',
    }),
    writeAuditLog({
      actorUid: 'payment_webhook_verifier',
      actorRole: 'system',
      action: 'PAYMENT_WEBHOOK_VERIFIED',
      targetType: 'payment',
      targetId: payment.id,
      details: `Verified HMAC-SHA256 webhook for ${payment.transactionId} (${payment.gateway}, BDT ${payment.amountBdt}, mode ${payment.mode}).`,
      severity: 'info',
    }),
    ...(bSnapBefore.exists
      ? [notifyAdminsOnAdvancePaymentEvent({ booking: bBefore, payment, phase: 'verified' })]
      : []),
  ]);

  return { alreadyProcessed: false, payment: { ...payment, status: 'verified_paid', webhookVerified: true } };
}

paymentsAdminRouter.post(
  '/payments/initiate',
  requireAuth,
  requireProfileUnlocked,
  async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = sanitizeId(req.body?.bookingId);
      const gateway = req.body?.gateway as PaymentGateway;
      if (!['bkash', 'nagad', 'custom', 'benson', 'rocket', 'sslcommerz', 'cash'].includes(gateway)) {
        return res.status(400).json({ error: 'অসমর্থিত পেমেন্ট মাধ্যম।' });
      }

      const [bSnap, settingsSnap] = await Promise.all([
        adminDb.collection('bookings').doc(bookingId).get(),
        adminDb.collection('platform_settings').doc('main').get(),
      ]);

      if (!bSnap.exists) return res.status(404).json({ error: 'বুকিং পাওয়া যায়নি।' });
      const booking = bSnap.data() as BookingRecord;

      if (booking.customerUid !== req.authUser!.uid) {
        return res.status(403).json({ error: 'শুধুমাত্র বুকিং কাস্টমার পেমেন্ট করতে পারবেন।' });
      }
      if (['declined', 'cancelled', 'completed'].includes(booking.status)) {
        return res.status(400).json({ error: 'এই বুকিংয়ের জন্য আর পেমেন্ট করা সম্ভব নয়।' });
      }

      const advanceDone = booking.advanceStatus === 'paid' || booking.paymentStatus === 'paid';
      const paymentStage: 'advance_50' | 'remaining_50' = advanceDone ? 'remaining_50' : 'advance_50';

      // Mandatory 50% Advance MUST use Admin Personal/Custom/Benson Options
      if (paymentStage === 'advance_50' && !['bkash', 'nagad', 'custom', 'benson'].includes(gateway)) {
        return res.status(400).json({
          error:
            'প্রথমে ৫০% অ্যাডভান্স পেমেন্ট বাধ্যতামূলকভাবে অ্যাডমিনের পার্সোনাল বিকাশ, পার্সোনাল নগদ, কাস্টম পার্সোনাল অথবা বেনসন সিগারেট অপশনের মাধ্যমেই করতে হবে।',
        });
      }

      const settings = settingsSnap.data() || {};
      const mode = settings.paymentMode === 'live' && settings.merchantApproved ? 'live' : 'sandbox';

      const advanceAmount = booking.advanceRequiredBdt || Math.round(booking.agreedPriceBdt / 2);
      const remainingAmount =
        booking.remainingDueBdt !== undefined
          ? Number(booking.remainingDueBdt)
          : Math.max(0, booking.agreedPriceBdt - Number(booking.advancePaidBdt || 0));

      const chargeAmountBdt = paymentStage === 'advance_50' ? advanceAmount : remainingAmount;
      if (chargeAmountBdt <= 0) {
        return res.status(400).json({ error: 'এই বুকিংয়ের কোনো বকেয়া টাকা অবশিষ্ট নেই।' });
      }

      if (gateway === 'cash') {
        if (!settings.cashPaymentEnabled) {
          return res.status(403).json({ error: 'Cash payment is currently disabled by platform policy.' });
        }
        const maxCash = Number(settings.maxCashBookingBdt || 3000);
        if (chargeAmountBdt > maxCash) {
          return res.status(400).json({
            error: `Cash payment is permitted only for amounts up to BDT ৳${maxCash.toLocaleString()}.`,
          });
        }
      }

      const feePercent = Number(settings.serviceFeePercent ?? 12);
      const chargeFeeBdt = Math.round((chargeAmountBdt * feePercent) / 100);
      const chargeNetBdt = chargeAmountBdt - chargeFeeBdt;

      const paymentId = `PAY_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const transactionId = `LGS-${gateway.toUpperCase().slice(0, 3)}-${crypto.randomInt(1000000, 9999999)}`;
      const gatewaySessionId = `SBX_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      const baseBdt = Math.max(100, Number(settings.bensonBaseBdt || 1000));
      const packetsPerBase = Math.max(1, Number(settings.bensonPacketsPerBase || 3));
      const equivalentPackets =
        gateway === 'benson' ? Number(((chargeAmountBdt / baseBdt) * packetsPerBase).toFixed(1)) : undefined;
      const equivalentLabel =
        gateway === 'benson'
          ? `${equivalentPackets} ${sanitizeString(settings.bensonItemName || 'প্যাকেট বেনসন সিগারেট', 80)}`
          : undefined;

      const record: PaymentRecord = {
        id: paymentId,
        transactionId,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        customerUid: booking.customerUid,
        companionUid: booking.companionUid,
        gateway,
        mode,
        paymentStage,
        amountBdt: chargeAmountBdt,
        platformFeeBdt: chargeFeeBdt,
        companionNetBdt: chargeNetBdt,
        status: gateway === 'cash' ? 'cash_pending' : 'initiated',
        webhookVerified: false,
        gatewaySessionId,
        ...(equivalentLabel ? { equivalentItemLabel: equivalentLabel, equivalentItemPackets: equivalentPackets } : {}),
        createdAt: now,
      };

      await adminDb.collection('payments').doc(paymentId).set(record);
      await adminDb.collection('bookings').doc(booking.id).update({
        status:
          gateway === 'cash'
            ? 'confirmed_paid'
            : booking.status === 'requested' || booking.status === 'accepted_awaiting_agreement'
              ? booking.status
              : 'payment_pending',
        paymentStatus: gateway === 'cash' ? 'cash_pending' : booking.paymentStatus === 'advance_paid' ? 'advance_paid' : 'pending',
        updatedAt: now,
      });

      if (gateway === 'cash') {
        await createNotification({
          userUid: booking.companionUid,
          type: 'cash_booking_confirmed',
          title: `Cash-on-Meetup Balance Confirmed (${booking.bookingCode})`,
          message: `Customer selected permitted cash settlement for remaining BDT ৳${chargeAmountBdt.toLocaleString()}.`,
          link: '/dashboard/companion',
        });
      }

      res.status(201).json({
        payment: record,
        sandboxCheckoutReady: paymentStage !== 'advance_50' && gateway !== 'cash',
      });
    } catch (err) {
      console.error('Initiate payment error:', err);
      res.status(500).json({ error: 'Unable to initiate payment checkout.' });
    }
  }
);

// Hosted Sandbox Payment Gateway Authorization -> generates signed server-to-server webhook
paymentsAdminRouter.post(
  '/payments/sandbox-gateway/authorize',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const paymentId = sanitizeId(req.body?.paymentId);
      const outcome = req.body?.outcome === 'fail' ? 'PAYMENT_FAILED' : 'PAYMENT_SUCCESS';
      const paySnap = await adminDb.collection('payments').doc(paymentId).get();
      if (!paySnap.exists) return res.status(404).json({ error: 'Checkout session not found.' });
      const payment = paySnap.data() as PaymentRecord;

      if (payment.customerUid !== req.authUser!.uid) {
        return res.status(403).json({ error: 'Unauthorized checkout session.' });
      }
      if (payment.paymentStage === 'advance_50') {
        return res.status(400).json({
          error:
            '৫০% অ্যাডভান্স পেমেন্ট অবশ্যই অ্যাডমিনের পার্সোনাল বা কাস্টম সেন্ড মানি নম্বরে টাকা পাঠিয়ে TrxID জমা দিতে হবে।',
        });
      }
      if (payment.mode !== 'sandbox') {
        return res.status(400).json({ error: 'Sandbox gateway simulator is unavailable in live mode.' });
      }

      const webhookPayload = {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        bookingId: payment.bookingId,
        amountBdt: payment.amountBdt,
        currency: 'BDT',
        gateway: payment.gateway,
        event: outcome,
      };
      const signature = signWebhookPayload(webhookPayload);

      // Verify signature via the exact same trusted verifier path
      if (!verifyWebhookSignature(webhookPayload, signature)) {
        return res.status(500).json({ error: 'Webhook signing failure.' });
      }

      const result = await processVerifiedPaymentWebhook(webhookPayload);
      res.json({
        webhookVerified: result.payment.webhookVerified,
        status: result.payment.status,
        transactionId: result.payment.transactionId,
        signaturePrefix: `${signature.slice(0, 12)}...`,
      });
    } catch (err: any) {
      console.error('Sandbox gateway error:', err);
      res.status(400).json({ error: err?.message || 'Sandbox gateway authorization failed.' });
    }
  }
);

// Trusted Server-to-Server Payment Gateway Webhook Endpoint (HMAC-SHA256 Signed)
paymentsAdminRouter.post('/payments/webhook', async (req, res) => {
  try {
    const sig = String(req.headers['x-logeasi-signature'] || '');
    if (!sig || !verifyWebhookSignature(req.body || {}, sig)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }
    const result = await processVerifiedPaymentWebhook(req.body);
    res.json({ received: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Webhook processing error.' });
  }
});

// Customer submits Personal bKash, Personal Nagad, Admin Custom Personal TrxID, or Benson Cigarette Photo Proof (NO PIN/OTP ever stored)
paymentsAdminRouter.post(
  '/payments/:id/submit-personal-trx',
  requireAuth,
  requireProfileUnlocked,
  async (req: AuthenticatedRequest, res) => {
    try {
      const paymentId = sanitizeId(req.params.id);
      const trxId = sanitizeString(req.body?.senderReferenceTrxId || '', 80).toUpperCase();
      if (!trxId || trxId.length < 4) {
        return res.status(400).json({
          error: 'সঠিক TrxID বা হস্তান্তর রেফারেন্স/ফোন নম্বর লিখুন (কমপক্ষে ৪ অক্ষর)। কখনোই আপনার PIN দেবেন না।',
        });
      }

      const payRef = adminDb.collection('payments').doc(paymentId);
      const paySnap = await payRef.get();
      if (!paySnap.exists) return res.status(404).json({ error: 'Payment session not found.' });
      const payment = paySnap.data() as PaymentRecord;

      if (payment.customerUid !== req.authUser!.uid) {
        return res.status(403).json({ error: 'Unauthorized payment session.' });
      }
      if (!['bkash', 'nagad', 'custom', 'benson'].includes(payment.gateway)) {
        return res.status(400).json({
          error: 'ম্যানুয়াল TrxID / রেফারেন্স শুধুমাত্র অ্যাডমিন পার্সোনাল বিকাশ, নগদ, কাস্টম বা বেনসন সিগারেট অপশনের জন্য।',
        });
      }
      if (payment.status === 'verified_paid') {
        return res.status(400).json({ error: 'এই পেমেন্ট ইতিমধ্যেই যাচাই ও সম্পন্ন হয়েছে।' });
      }

      let bensonDeliveryMode: 'in_person' | 'send_delivery' | undefined;
      let sanitizedProofPhoto: string | undefined;

      if (payment.gateway === 'benson') {
        const rawMode = String(req.body?.bensonDeliveryMode || '').trim();
        if (rawMode !== 'in_person' && rawMode !== 'send_delivery') {
          return res.status(400).json({
            error: 'বেনসন সিগারেট কীভাবে দেবেন তা নির্বাচন করুন (দেখা করে সরাসরি নাকি কুরিয়ার/রাইডারে সেন্ড)।',
          });
        }
        bensonDeliveryMode = rawMode;

        const cleanedPhoto = sanitizePhotoData(req.body?.proofPhotoUrl);
        if (!cleanedPhoto) {
          return res.status(400).json({
            error:
              'বেনসন সিগারেট কিনে প্যাকেটের স্পষ্ট ছবি (প্রমাণ) তুলে আপলোড করা বাধ্যতামূলক। দেখা করে দিন বা সেন্ড করুন—সিগারেটের ছবি ছাড়া জমা নেওয়া হবে না।',
          });
        }
        sanitizedProofPhoto = cleanedPhoto;
      } else if (req.body?.proofPhotoUrl) {
        const optionalPhoto = sanitizePhotoData(req.body?.proofPhotoUrl);
        if (optionalPhoto) {
          sanitizedProofPhoto = optionalPhoto;
        }
      }

      const bRef = adminDb.collection('bookings').doc(payment.bookingId);
      const bSnap = await bRef.get();
      const bData = (bSnap.data() || {}) as BookingRecord;

      const updatePayload: Partial<PaymentRecord> = {
        senderReferenceTrxId: trxId,
        status: 'pending_manual_verification',
      };
      if (bensonDeliveryMode) updatePayload.bensonDeliveryMode = bensonDeliveryMode;
      if (sanitizedProofPhoto) updatePayload.proofPhotoUrl = sanitizedProofPhoto;

      const now = new Date().toISOString();
      await payRef.update(updatePayload);
      const nextAdminLocStatus =
        bData.adminLocationStatus && bData.adminLocationStatus !== 'not_requested'
          ? bData.adminLocationStatus
          : bData.customerLiveLocation
            ? 'customer_shared'
            : 'customer_location_requested';

      await bRef.update({
        status:
          bData.status === 'requested' || bData.status === 'accepted_awaiting_agreement'
            ? bData.status
            : 'payment_pending',
        advanceStatus: payment.paymentStage === 'advance_50' ? 'pending_verification' : (bData.advanceStatus || 'unpaid'),
        paymentStatus: bData.paymentStatus === 'advance_paid' ? 'advance_paid' : 'pending',
        adminLocationStatus: nextAdminLocStatus,
        updatedAt: now,
      });

      const modeTextBn =
        bensonDeliveryMode === 'in_person'
          ? 'দেখা করে হাতে হাতে'
          : bensonDeliveryMode === 'send_delivery'
            ? 'কুরিয়ার/রাইডারে সেন্ড'
            : '';

      await Promise.all([
        createNotification({
          userUid: payment.companionUid,
          type: 'personal_payment_submitted',
          title:
            payment.gateway === 'benson'
              ? `বেনসন সিগারেট প্রমাণ জমা হয়েছে (${payment.transactionId})`
              : `Personal ${payment.gateway.toUpperCase()} TrxID Submitted (${payment.transactionId})`,
          message:
            payment.gateway === 'benson'
              ? `গ্রাহক ${modeTextBn} পদ্ধতিতে (${payment.equivalentItemLabel || formatBdtFallback(payment.amountBdt)}) বেনসন সিগারেটের ছবিসহ প্রমাণ (${trxId}) জমা দিয়েছেন। অ্যাডমিন যাচাইয়ের অপেক্ষায়।`
              : `Customer submitted TrxID ${trxId} for BDT ৳${payment.amountBdt.toLocaleString()}. Pending Finance Admin verification.`,
          link: '/dashboard/companion',
        }),
        notifyAdminsOnAdvancePaymentEvent({
          booking: bData,
          payment: { ...payment, ...updatePayload } as PaymentRecord,
          phase: 'submitted',
        }),
        writeAuditLog({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: payment.gateway === 'benson' ? 'BENSON_PROOF_SUBMITTED' : 'PERSONAL_MFS_TRX_SUBMITTED',
          targetType: 'payment',
          targetId: payment.id,
          details:
            payment.gateway === 'benson'
              ? `Submitted BENSON cigarette proof (${bensonDeliveryMode}) Ref=${trxId} for booking ${payment.bookingCode || payment.bookingId}.`
              : `Submitted ${payment.gateway.toUpperCase()} Personal TrxID=${trxId} for booking ${payment.bookingCode || payment.bookingId}.`,
          severity: 'info',
        }),
      ]);

      res.json({
        payment: {
          ...payment,
          ...updatePayload,
        },
      });
    } catch (err) {
      console.error('Submit personal trx error:', err);
      res.status(500).json({ error: 'Unable to submit personal transaction reference.' });
    }
  }
);

function formatBdtFallback(amount: number): string {
  return `৳${Number(amount || 0).toLocaleString()}`;
}

// Finance Admin or Root verifies Personal bKash / Personal Nagad TrxID
paymentsAdminRouter.post(
  '/admin/payments/:id/verify-personal',
  requireAdmin,
  requirePermission('manage_payments'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const paymentId = sanitizeId(req.params.id);
      const decision = req.body?.decision === 'reject' ? 'reject' : 'approve';
      const payRef = adminDb.collection('payments').doc(paymentId);
      const paySnap = await payRef.get();
      if (!paySnap.exists) return res.status(404).json({ error: 'Payment record not found.' });
      const payment = paySnap.data() as PaymentRecord;

      if (payment.status === 'verified_paid') {
        return res.status(400).json({ error: 'Payment already verified.' });
      }

      const bRef = adminDb.collection('bookings').doc(payment.bookingId);
      const bSnap = await bRef.get();
      const booking = (bSnap.data() || {}) as BookingRecord;

      const now = new Date().toISOString();
      if (decision === 'reject') {
        await payRef.update({ status: 'failed', verifiedAt: now });
        await bRef.update({
          status: booking.status === 'payment_pending' ? 'price_agreed_awaiting_payment' : booking.status || 'requested',
          advanceStatus: payment.paymentStage === 'advance_50' ? 'unpaid' : (booking.advanceStatus || 'unpaid'),
          paymentStatus: booking.advanceStatus === 'paid' ? 'advance_paid' : 'unpaid',
          updatedAt: now,
        });
        await createNotification({
          userUid: payment.customerUid,
          type: 'payment_rejected',
          title: `Personal Payment Rejected (${payment.transactionId})`,
          message: `Submitted TrxID (${payment.senderReferenceTrxId || 'N/A'}) could not be matched. Please retry checkout.`,
          link: `/payment/${payment.bookingId}`,
        });
        await writeAuditLog({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: 'PERSONAL_MFS_PAYMENT_REJECTED',
          targetType: 'payment',
          targetId: payment.id,
          details: `Rejected ${payment.gateway.toUpperCase()} TrxID=${payment.senderReferenceTrxId || 'N/A'}.`,
          severity: 'warning',
        });
        return res.json({ status: 'failed' });
      }

      await payRef.update({
        status: 'verified_paid',
        webhookVerified: true,
        verifiedAt: now,
      });

      const isAdvance = payment.paymentStage === 'advance_50';
      const totalAgreed = Number(booking.agreedPriceBdt || payment.amountBdt);
      const nextAdvancePaid = isAdvance
        ? payment.amountBdt
        : Number(booking.advancePaidBdt || 0) + payment.amountBdt;
      const remainingDueBdt = Math.max(0, totalAgreed - nextAdvancePaid);

      const nextLocStatusOnVerify =
        booking.adminLocationStatus === 'admin_dispatched'
          ? 'admin_dispatched'
          : booking.customerLiveLocation
            ? 'customer_shared'
            : 'customer_location_requested';

      await bRef.update({
        advancePaidBdt: nextAdvancePaid,
        remainingDueBdt,
        advanceStatus: 'paid',
        paymentStatus: remainingDueBdt === 0 ? 'paid' : 'advance_paid',
        adminLocationStatus: nextLocStatusOnVerify,
        locationRequestedAt: booking.customerLiveLocation ? booking.locationRequestedAt : now,
        status:
          remainingDueBdt === 0 || booking.companionAgreed
            ? 'confirmed_paid'
            : booking.status || 'requested',
        updatedAt: now,
      });

      const cmpRef = adminDb.collection('companion_profiles').doc(payment.companionUid);
      const cmpSnap = await cmpRef.get();
      if (cmpSnap.exists) {
        const cmp = cmpSnap.data()!;
        await cmpRef.update({
          pendingBalanceBdt: Number(cmp.pendingBalanceBdt || 0) + payment.companionNetBdt,
          updatedAt: now,
        });
      }

      const sysMsgId = `MSG_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await adminDb.collection('booking_messages').doc(sysMsgId).set({
        id: sysMsgId,
        bookingId: booking.id,
        senderUid: 'system_admin_dispatch',
        senderName: 'LOGEASI পেমেন্ট নিশ্চিতকরণ',
        body: booking.customerLiveLocation
          ? `৫০% অ্যাডভান্স পেমেন্ট (৳${payment.amountBdt.toLocaleString()}) যাচাই সম্পন্ন হয়েছে। কাস্টমারের লাইভ লোকেশন সঙ্গীর সাথে শেয়ার করা হয়েছে — এখন সরাসরি আলাপ-আলোচনা করুন। (অ্যাডমিন শুধুমাত্র পর্যবেক্ষণ করবেন)`
          : `৫০% অ্যাডভান্স পেমেন্ট (৳${payment.amountBdt.toLocaleString()}) যাচাই সম্পন্ন হয়েছে। এখন ম্যাপ থেকে সরাসরি আপনার সঙ্গীর সাথে লাইভ লোকেশন শেয়ার করুন এবং চ্যাটে আলাপ-আলোচনা করুন।`,
        createdAt: now,
      });

      await Promise.all([
        createNotification({
          userUid: payment.customerUid,
          type: 'payment_confirmed',
          title: `৫০% পেমেন্ট নিশ্চিত (${payment.transactionId}) — সঙ্গীর সাথে লোকেশন ও আলোচনা`,
          message: booking.customerLiveLocation
            ? `আপনার BDT ৳${payment.amountBdt.toLocaleString()} পেমেন্ট নিশ্চিত হয়েছে। এখন সঙ্গীর সাথে সরাসরি আলাপ-আলোচনা করুন ও লোকেশন আপডেট রাখুন।`
            : `আপনার BDT ৳${payment.amountBdt.toLocaleString()} পেমেন্ট নিশ্চিত হয়েছে। বুকিং পেজ থেকে সরাসরি আপনার সঙ্গীকে লাইভ লোকেশন শেয়ার করুন ও কথা বলুন।`,
          link: `/bookings?bookingId=${booking.id}`,
        }),
        createNotification({
          userUid: payment.companionUid,
          type: 'payment_confirmed',
          title: `Booking Confirmed & Paid (${payment.transactionId})`,
          message: `Personal ${payment.gateway.toUpperCase()} payment verified. Net earnings BDT ৳${payment.companionNetBdt.toLocaleString()} held in escrow.`,
          link: '/dashboard/companion',
        }),
        notifyAdminsOnAdvancePaymentEvent({
          booking,
          payment,
          phase: 'verified',
        }),
        writeAuditLog({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: 'PERSONAL_MFS_PAYMENT_VERIFIED',
          targetType: 'payment',
          targetId: payment.id,
          details: `Verified ${payment.gateway.toUpperCase()} Personal TrxID=${payment.senderReferenceTrxId || 'N/A'} for BDT ${payment.amountBdt}.`,
          severity: 'info',
        }),
      ]);

      res.json({ status: 'verified_paid' });
    } catch (err) {
      console.error('Verify personal payment error:', err);
      res.status(500).json({ error: 'Failed to verify personal payment.' });
    }
  }
);

// Update Personal bKash, Personal Nagad & Admin Custom Personal receiving numbers (Finance Admin or Root)
paymentsAdminRouter.put(
  '/admin/personal-payment-numbers',
  requireAdmin,
  requirePermission('manage_payments'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const bkashPersonalNumber = sanitizeString(req.body?.bkashPersonalNumber || '', 40);
      const nagadPersonalNumber = sanitizeString(req.body?.nagadPersonalNumber || '', 40);
      const customPaymentLabel = sanitizeString(req.body?.customPaymentLabel || '', 120);
      const customPaymentNumber = sanitizeString(req.body?.customPaymentNumber || '', 60);
      const customPaymentInstructions = sanitizeString(req.body?.customPaymentInstructions || '', 300);
      const bensonPaymentLabel = sanitizeString(req.body?.bensonPaymentLabel || '', 120);
      const bensonBaseBdt = Math.max(100, Math.min(100000, Number(req.body?.bensonBaseBdt || 1000)));
      const bensonPacketsPerBase = Math.max(1, Math.min(100, Number(req.body?.bensonPacketsPerBase || 3)));
      const bensonItemName = sanitizeString(req.body?.bensonItemName || 'প্যাকেট বেনসন সিগারেট', 80);
      const bensonContactNumber = sanitizeString(req.body?.bensonContactNumber || '', 60);
      const bensonPaymentInstructions = sanitizeString(req.body?.bensonPaymentInstructions || '', 300);

      if (!bkashPersonalNumber || !nagadPersonalNumber) {
        return res.status(400).json({ error: 'Both Personal bKash and Personal Nagad numbers are required.' });
      }
      await adminDb.collection('platform_settings').doc('main').set(
        {
          bkashPersonalNumber,
          nagadPersonalNumber,
          ...(customPaymentLabel ? { customPaymentLabel } : {}),
          ...(customPaymentNumber !== undefined ? { customPaymentNumber } : {}),
          ...(customPaymentInstructions !== undefined ? { customPaymentInstructions } : {}),
          ...(bensonPaymentLabel ? { bensonPaymentLabel } : {}),
          bensonBaseBdt,
          bensonPacketsPerBase,
          ...(bensonItemName ? { bensonItemName } : {}),
          ...(bensonContactNumber !== undefined ? { bensonContactNumber } : {}),
          ...(bensonPaymentInstructions !== undefined ? { bensonPaymentInstructions } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'PERSONAL_PAYMENT_NUMBERS_UPDATED',
        targetType: 'platform_settings',
        targetId: 'main',
        details: `Updated Personal bKash=${bkashPersonalNumber}, Personal Nagad=${nagadPersonalNumber}, Custom=${customPaymentNumber}, Benson=${bensonBaseBdt}BDT/${bensonPacketsPerBase}pkts.`,
        severity: 'warning',
      });
      res.json({
        updated: true,
        bkashPersonalNumber,
        nagadPersonalNumber,
        customPaymentLabel,
        customPaymentNumber,
        customPaymentInstructions,
        bensonPaymentLabel,
        bensonBaseBdt,
        bensonPacketsPerBase,
        bensonItemName,
        bensonContactNumber,
        bensonPaymentInstructions,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update personal payment numbers.' });
    }
  }
);

paymentsAdminRouter.get('/payments/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const [custPay, cmpPay, refundSnap] = await Promise.all([
      adminDb.collection('payments').where('customerUid', '==', uid).get(),
      adminDb.collection('payments').where('companionUid', '==', uid).get(),
      adminDb.collection('refunds').where('customerUid', '==', uid).get(),
    ]);
    const map = new Map<string, PaymentRecord>();
    custPay.docs.forEach((d) => map.set(d.id, d.data() as PaymentRecord));
    cmpPay.docs.forEach((d) => map.set(d.id, d.data() as PaymentRecord));

    const payments = Array.from(map.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const refunds = refundSnap.docs.map((d) => d.data());
    res.json({ payments, refunds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load payment history.' });
  }
});

// Companion Payout Requests
paymentsAdminRouter.post(
  '/payouts/request',
  requireAuth,
  requireProfileUnlocked,
  async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const amountBdt = Math.round(Number(req.body?.amountBdt || 0));
    const method = req.body?.method;
    const accountNumber = sanitizeString(req.body?.accountNumber, 40);

    if (!['bkash', 'nagad', 'rocket', 'bank_eft'].includes(method)) {
      return res.status(400).json({ error: 'Valid payout method required.' });
    }
    if (amountBdt < 500 || !accountNumber || accountNumber.length < 6) {
      return res.status(400).json({ error: 'Minimum payout is BDT ৳500 with valid account number.' });
    }

    const cmpRef = adminDb.collection('companion_profiles').doc(uid);
    const cmpSnap = await cmpRef.get();
    if (!cmpSnap.exists) return res.status(404).json({ error: 'Companion profile not found.' });

    const available = Number(cmpSnap.data()!.availableBalanceBdt || 0);
    if (amountBdt > available) {
      return res.status(400).json({ error: 'Insufficient available balance for payout.' });
    }

    const id = `PYT_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const masked = `${'*'.repeat(Math.max(4, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
    const payout = {
      id,
      companionUid: uid,
      companionName: req.authUser!.fullName,
      amountBdt,
      method,
      accountMasked: masked,
      status: 'pending',
      reviewedByUid: '',
      createdAt: new Date().toISOString(),
    };

    await cmpRef.update({ availableBalanceBdt: available - amountBdt });
    await adminDb.collection('companion_payouts').doc(id).set(payout);

    res.status(201).json({ payout });
  } catch (err) {
    res.status(500).json({ error: 'Unable to submit payout request.' });
  }
});

paymentsAdminRouter.get('/payouts/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb
      .collection('companion_payouts')
      .where('companionUid', '==', req.authUser!.uid)
      .get();
    const payouts = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ payouts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load payouts.' });
  }
});

// ========================
// ADMIN, FINANCE, RBAC, SECURITY & ROOT MANAGEMENT ENDPOINTS
// ========================

paymentsAdminRouter.get(
  '/admin/overview',
  requireAdmin,
  requirePermission('view_analytics'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const days = Math.max(1, Math.min(365, Number(req.query.days || 30)));
      const cutoff = Date.now() - days * 86400_000;

      const [
        usersSnap,
        cmpSnap,
        verSnap,
        bkgSnap,
        paySnap,
        payoutSnap,
        refundSnap,
        ticketSnap,
        auditSnap,
      ] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('companion_profiles').get(),
        adminDb.collection('verification_requests').get(),
        adminDb.collection('bookings').get(),
        adminDb.collection('payments').get(),
        adminDb.collection('companion_payouts').get(),
        adminDb.collection('refunds').get(),
        adminDb.collection('support_tickets').get(),
        adminDb.collection('audit_logs').get(),
      ]);

      const users = usersSnap.docs.map((d) => d.data());
      const companions = cmpSnap.docs.map((d) => d.data());
      const verifications = verSnap.docs.map((d) => d.data());
      const bookings = bkgSnap.docs.map((d) => d.data());
      const payments = paySnap.docs.map((d) => d.data());
      const payouts = payoutSnap.docs.map((d) => d.data());
      const refunds = refundSnap.docs.map((d) => d.data());
      const tickets = ticketSnap.docs.map((d) => d.data());
      const audits = auditSnap.docs
        .map((d) => d.data())
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 12);

      const filteredBookings = bookings.filter(
        (b) => new Date(b.createdAt || 0).getTime() >= cutoff
      );
      const filteredPayments = payments.filter(
        (p) => new Date(p.createdAt || 0).getTime() >= cutoff
      );

      const paidTxns = filteredPayments.filter((p) => p.status === 'verified_paid');
      const totalVolumeBdt = paidTxns.reduce((s, p) => s + Number(p.amountBdt || 0), 0);
      const platformRevenueBdt = paidTxns.reduce((s, p) => s + Number(p.platformFeeBdt || 0), 0);

      // Build gateway breakdown chart series
      const gatewayBreakdown = ['bkash', 'nagad', 'custom', 'benson', 'rocket', 'sslcommerz', 'cash'].map((gw) => ({
        gateway: gw.toUpperCase(),
        volumeBdt: paidTxns
          .filter((p) => p.gateway === gw)
          .reduce((s, p) => s + Number(p.amountBdt || 0), 0),
        count: paidTxns.filter((p) => p.gateway === gw).length,
      }));

      res.json({
        kpis: {
          totalCustomers: users.filter((u) => u.role === 'customer').length,
          totalCompanions: companions.length,
          verifiedCompanions: companions.filter((c) => c.verificationStatus === 'approved').length,
          pendingVerifications: verifications.filter((v) => v.status === 'pending').length,
          activeBookings: filteredBookings.filter((b) =>
            ['requested', 'accepted_awaiting_agreement', 'price_agreed_awaiting_payment', 'payment_pending', 'confirmed_paid', 'in_progress'].includes(b.status)
          ).length,
          completedBookings: filteredBookings.filter((b) => b.status === 'completed').length,
          cancelledBookings: filteredBookings.filter((b) => b.status === 'cancelled').length,
          totalVolumeBdt,
          platformRevenueBdt,
          pendingPayouts: payouts.filter((p) => p.status === 'pending').length,
          refundRequests: refunds.filter((r) => r.status === 'requested').length,
          openComplaints: tickets.filter((t) => ['open', 'in_review'].includes(t.status)).length,
        },
        gatewayBreakdown,
        recentActivity: audits,
      });
    } catch (err) {
      console.error('Admin overview error:', err);
      res.status(500).json({ error: 'Unable to load admin overview.' });
    }
  }
);

// Customers & Companions user directory (never returns private/security subcollection!)
paymentsAdminRouter.get(
  '/admin/users',
  requireAdmin,
  requirePermission('manage_customers'),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('users').get();
      const users = snap.docs
        .map((d) => d.data())
        .filter((u) => ['customer', 'companion'].includes(u.role))
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: 'Unable to list users.' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/users/:uid/status',
  requireAdmin,
  requirePermission('manage_customers'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const targetUid = sanitizeId(req.params.uid);
      const status = req.body?.status === 'suspended' ? 'suspended' : 'active';

      const guard = await assertRootProtection({
        targetUid,
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: status === 'suspended' ? 'SUSPEND' : 'REINSTATE',
      });
      if (!guard.allowed) {
        return res.status(403).json({ error: guard.reason });
      }

      const userRef = adminDb.collection('users').doc(targetUid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      const now = new Date().toISOString();
      await userRef.update({ status, updatedAt: now });

      const cmpRef = adminDb.collection('companion_profiles').doc(targetUid);
      const cmpSnap = await cmpRef.get();
      if (cmpSnap.exists) {
        await cmpRef.update({
          isAvailableNow: status === 'active',
          updatedAt: now,
        });
      }

      await createNotification({
        userUid: targetUid,
        type: 'account_status_update',
        title: status === 'suspended' ? 'অ্যাকাউন্ট সাময়িকভাবে স্থগিত' : 'অ্যাকাউন্ট পুনরায় সক্রিয় হয়েছে',
        message:
          status === 'suspended'
            ? 'অ্যাডমিন আপনার অ্যাকাউন্ট সাময়িকভাবে স্থগিত করেছেন। সহায়তার জন্য সাপোর্টে যোগাযোগ করুন।'
            : 'অ্যাডমিন আপনার অ্যাকাউন্ট পুনরায় সক্রিয় করেছেন। এখন সব ফিচার ব্যবহার করতে পারবেন।',
        link: userSnap.data()?.role === 'companion' ? '/dashboard/companion' : '/dashboard/customer',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: `USER_${status.toUpperCase()}`,
        targetType: 'user',
        targetId: targetUid,
        details: `Account status updated to ${status}.`,
        severity: status === 'suspended' ? 'warning' : 'info',
      });

      res.json({ uid: targetUid, status });
    } catch (err) {
      console.error('Update user status error:', err);
      res.status(500).json({ error: 'Failed to update user status.' });
    }
  }
);

// Direct 18+ Adult / Companion Verification Control from User Control Table
paymentsAdminRouter.post(
  '/admin/users/:uid/verify-adult',
  requireAdmin,
  requirePermission('approve_verifications'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const targetUid = sanitizeId(req.params.uid);
      const decision: 'approved' | 'rejected' =
        req.body?.decision === 'rejected' ? 'rejected' : 'approved';
      const approved = decision === 'approved';

      const userRef = adminDb.collection('users').doc(targetUid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      const now = new Date().toISOString();

      await userRef.update({
        isAdultVerified18Plus: approved,
        verificationStatus: decision,
        updatedAt: now,
      });

      const cmpRef = adminDb.collection('companion_profiles').doc(targetUid);
      const cmpSnap = await cmpRef.get();
      if (cmpSnap.exists) {
        await cmpRef.update({
          verificationStatus: decision,
          updatedAt: now,
        });
      }

      const verSnap = await adminDb
        .collection('verification_requests')
        .where('uid', '==', targetUid)
        .get();
      for (const d of verSnap.docs) {
        await d.ref.update({
          status: decision,
          reviewedByUid: req.authUser!.uid,
          reviewerNote: `অ্যাডমিন প্যানেল থেকে সরাসরি ${approved ? 'অনুমোদিত' : 'বাতিল'}`,
        });
      }

      await createNotification({
        userUid: targetUid,
        type: 'verification_update',
        title: `১৮+ পরিচয় যাচাই ${approved ? 'অনুমোদিত' : 'বাতিল'}`,
        message: approved
          ? 'অ্যাডমিন আপনার ১৮+ পরিচয় যাচাই অনুমোদন করেছেন। আপনার ভেরিফায়েড স্ট্যাটাস এখন সক্রিয়।'
          : 'অ্যাডমিন আপনার ১৮+ পরিচয় যাচাই স্থগিত/বাতিল করেছেন।',
        link: cmpSnap.exists ? '/dashboard/companion' : '/dashboard/customer',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: `USER_VERIFICATION_${decision.toUpperCase()}`,
        targetType: 'user',
        targetId: targetUid,
        details: `Admin set 18+ verification status for ${targetUid} to ${decision}.`,
        severity: 'info',
      });

      res.json({ uid: targetUid, isAdultVerified18Plus: approved, verificationStatus: decision });
    } catch (err) {
      console.error('Direct verify-adult error:', err);
      res.status(500).json({ error: '১৮+ ভেরিফিকেশন আপডেট করা যায়নি।' });
    }
  }
);

// Verification queue
paymentsAdminRouter.get(
  '/admin/verifications',
  requireAdmin,
  requirePermission('approve_verifications'),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('verification_requests').get();
      const list = snap.docs
        .map((d) => d.data())
        .sort((a, b) => {
          const ap = a.status === 'pending' ? 0 : 1;
          const bp = b.status === 'pending' ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return String(b.createdAt).localeCompare(String(a.createdAt));
        });
      res.json({ verifications: list });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load verification requests.' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/verifications/:id/review',
  requireAdmin,
  requirePermission('approve_verifications'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
      const reviewerNote = sanitizeString(req.body?.reviewerNote || '', 400);

      const ref = adminDb.collection('verification_requests').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Verification request not found.' });
      const ver = snap.data()!;
      const now = new Date().toISOString();

      await ref.update({
        status: decision,
        reviewerNote,
        reviewedByUid: req.authUser!.uid,
        reviewedAt: now,
      });

      const targetUserRef = adminDb.collection('users').doc(ver.uid);
      const targetUserSnap = await targetUserRef.get();
      if (targetUserSnap.exists) {
        await targetUserRef.update({
          isAdultVerified18Plus: decision === 'approved',
          verificationStatus: decision,
          updatedAt: now,
        });
      }

      const cmpRef = adminDb.collection('companion_profiles').doc(ver.uid);
      const cmpSnap = await cmpRef.get();
      if (cmpSnap.exists) {
        await cmpRef.update({
          verificationStatus: decision,
          updatedAt: now,
        });
      }

      await createNotification({
        userUid: ver.uid,
        type: 'verification_update',
        title: `১৮+ পরিচয় যাচাই ${decision === 'approved' ? 'অনুমোদিত' : 'বাতিল'}`,
        message:
          decision === 'approved'
            ? 'আপনার ১৮+ পরিচয় যাচাই অনুমোদন করা হয়েছে। এখন আপনার ভেরিফায়েড ব্যাজ চালু রয়েছে।'
            : `আপনার ভেরিফিকেশন আবেদন বাতিল করা হয়েছে: ${reviewerNote || 'ডকুমেন্ট স্পষ্ট নয়।'}`,
        link: cmpSnap.exists ? '/dashboard/companion' : '/dashboard/customer',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: `VERIFICATION_${decision.toUpperCase()}`,
        targetType: 'verification_request',
        targetId: id,
        details: `Verification for ${ver.uid} marked ${decision}.`,
        severity: 'info',
      });

      res.json({ id, status: decision, uid: ver.uid });
    } catch (err) {
      console.error('Review verification error:', err);
      res.status(500).json({ error: 'Failed to review verification.' });
    }
  }
);

// Admin Bookings
paymentsAdminRouter.get(
  '/admin/bookings',
  requireAdmin,
  requirePermission('manage_bookings'),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('bookings').get();
      const bookings = snap.docs
        .map((d) => d.data())
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      res.json({ bookings });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load bookings.' });
    }
  }
);

paymentsAdminRouter.patch(
  '/admin/bookings/:id/status',
  requireAdmin,
  requirePermission('manage_bookings'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const nextStatus = sanitizeString(req.body?.status, 60);
      const allowedStatuses = [
        'requested',
        'accepted_awaiting_agreement',
        'price_agreed_awaiting_payment',
        'payment_pending',
        'confirmed_paid',
        'in_progress',
        'completed',
        'cancelled',
        'disputed',
      ];
      if (!allowedStatuses.includes(nextStatus)) {
        return res.status(400).json({ error: 'Invalid booking status.' });
      }
      const ref = adminDb.collection('bookings').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Booking not found.' });
      const bkg = snap.data()!;

      await ref.update({ status: nextStatus, updatedAt: new Date().toISOString() });

      await Promise.all([
        createNotification({
          userUid: bkg.customerUid,
          type: 'booking_update',
          title: `বুকিং ${bkg.bookingCode} স্ট্যাটাস আপডেট`,
          message: `অ্যাডমিন আপনার বুকিংয়ের অবস্থা "${nextStatus}"-এ হালনাগাদ করেছেন।`,
          link: '/dashboard/customer',
        }),
        createNotification({
          userUid: bkg.companionUid,
          type: 'booking_update',
          title: `বুকিং ${bkg.bookingCode} স্ট্যাটাস আপডেট`,
          message: `অ্যাডমিন বুকিংয়ের অবস্থা "${nextStatus}"-এ হালনাগাদ করেছেন।`,
          link: '/dashboard/companion',
        }),
      ]);

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'ADMIN_BOOKING_STATUS_UPDATED',
        targetType: 'booking',
        targetId: id,
        details: `Updated booking ${bkg.bookingCode} status from ${bkg.status} to ${nextStatus}.`,
        severity: 'warning',
      });

      res.json({ id, status: nextStatus });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update booking status.' });
    }
  }
);

// Read-Only Safeguard: Customer & Companion manage Live Location & Discussion directly; Admin only observes.
paymentsAdminRouter.post(
  '/admin/bookings/:id/request-location',
  requireAdmin,
  async (_req: AuthenticatedRequest, res) => {
    return res.status(403).json({
      error:
        'পর্যবেক্ষণ মোড (Read-Only): কাস্টমার সরাসরি সঙ্গীর সাথে লাইভ লোকেশন শেয়ার করবেন ও আলাপ-আলোচনা করবেন। অ্যাডমিনের এখানে কোনো এডিট বা ডিসপ্যাচ করার অপশন নেই।',
    });
  }
);

paymentsAdminRouter.post(
  '/admin/bookings/:id/dispatch-location',
  requireAdmin,
  async (_req: AuthenticatedRequest, res) => {
    return res.status(403).json({
      error:
        'পর্যবেক্ষণ মোড (Read-Only): কাস্টমার ও সঙ্গী নিজেরাই লাইভ লোকেশন ও মিটআপ ঠিক করবেন। অ্যাডমিন শুধুমাত্র দেখতে পারবেন।',
    });
  }
);

// Finance: Payments, Refunds, Payouts, CSV Export
paymentsAdminRouter.get(
  '/admin/finance',
  requireAdmin,
  requirePermission('manage_payments'),
  async (_req, res) => {
    try {
      const [paySnap, refSnap, pytSnap] = await Promise.all([
        adminDb.collection('payments').get(),
        adminDb.collection('refunds').get(),
        adminDb.collection('companion_payouts').get(),
      ]);
      res.json({
        payments: paySnap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
        refunds: refSnap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
        payouts: pytSnap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      });
    } catch (err) {
      res.status(500).json({ error: 'Unable to load financial records.' });
    }
  }
);

paymentsAdminRouter.get(
  '/admin/payments/export-csv',
  requireAdmin,
  requirePermission('manage_payments'),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('payments').get();
      const rows = snap.docs.map((d) => d.data() as PaymentRecord);
      const header = 'TransactionID,BookingCode,Gateway,Mode,AmountBDT,PlatformFeeBDT,CompanionNetBDT,Status,WebhookVerified,CreatedAt';
      const lines = rows.map(
        (r) =>
          `"${r.transactionId}","${r.bookingCode || r.bookingId}","${r.gateway}","${r.mode}",${r.amountBdt},${r.platformFeeBdt},${r.companionNetBdt},"${r.status}",${r.webhookVerified},"${r.createdAt}"`
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="logeasi-transactions.csv"');
      res.send([header, ...lines].join('\n'));
    } catch (err) {
      res.status(500).json({ error: 'Failed to export CSV.' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/refunds/:id/process',
  requireAdmin,
  requirePermission('process_refunds'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const status = req.body?.status === 'processed' ? 'processed' : 'rejected';
      const ref = adminDb.collection('refunds').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Refund request not found.' });
      const refund = snap.data()!;

      await ref.update({ status, processedByUid: req.authUser!.uid });
      if (status === 'processed') {
        await adminDb.collection('payments').doc(refund.paymentId).update({ status: 'refunded' });
        await adminDb.collection('bookings').doc(refund.bookingId).update({ paymentStatus: 'refunded' });
      }

      await createNotification({
        userUid: refund.customerUid,
        type: 'refund_update',
        title: `Refund ${status === 'processed' ? 'Processed' : 'Declined'}`,
        message: `Your refund request of BDT ৳${Number(refund.amountBdt).toLocaleString()} was ${status}.`,
        link: '/dashboard/customer',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: `REFUND_${status.toUpperCase()}`,
        targetType: 'refund',
        targetId: id,
        details: `Refund BDT ${refund.amountBdt} marked ${status}.`,
        severity: 'info',
      });

      res.json({ id, status });
    } catch (err) {
      res.status(500).json({ error: 'Failed to process refund.' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/payouts/:id/process',
  requireAdmin,
  requirePermission('review_payouts'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const status = ['approved', 'paid', 'rejected'].includes(req.body?.status)
        ? req.body.status
        : 'paid';
      const ref = adminDb.collection('companion_payouts').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Payout request not found.' });
      const payout = snap.data()!;

      await ref.update({ status, reviewedByUid: req.authUser!.uid });
      if (status === 'rejected' && payout.status === 'pending') {
        // Restore available balance
        const cmpRef = adminDb.collection('companion_profiles').doc(payout.companionUid);
        const cmpSnap = await cmpRef.get();
        if (cmpSnap.exists) {
          await cmpRef.update({
            availableBalanceBdt: Number(cmpSnap.data()!.availableBalanceBdt || 0) + Number(payout.amountBdt),
          });
        }
      }

      await createNotification({
        userUid: payout.companionUid,
        type: 'payout_update',
        title: `Payout ${status.toUpperCase()}`,
        message: `Your payout request of BDT ৳${Number(payout.amountBdt).toLocaleString()} (${payout.method.toUpperCase()}) is ${status}.`,
        link: '/dashboard/companion',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: `PAYOUT_${status.toUpperCase()}`,
        targetType: 'companion_payout',
        targetId: id,
        details: `Payout BDT ${payout.amountBdt} updated to ${status}.`,
        severity: 'info',
      });

      res.json({ id, status });
    } catch (err) {
      res.status(500).json({ error: 'Failed to process payout.' });
    }
  }
);

// Support Tickets & Safety Reports (Admin)
paymentsAdminRouter.get(
  '/admin/tickets',
  requireAdmin,
  requirePermission('handle_complaints'),
  async (_req, res) => {
    try {
      const [tSnap, rSnap] = await Promise.all([
        adminDb.collection('support_tickets').get(),
        adminDb.collection('reports').get(),
      ]);
      res.json({
        tickets: tSnap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
        reports: rSnap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch support queue.' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/tickets/:id/reply',
  requireAdmin,
  requirePermission('handle_complaints'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const adminReply = sanitizeString(req.body?.adminReply, 1500);
      const status = ['open', 'in_review', 'resolved', 'closed'].includes(req.body?.status)
        ? req.body.status
        : 'resolved';

      const ref = adminDb.collection('support_tickets').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Ticket not found.' });

      await ref.update({ adminReply, status, assignedAdminUid: req.authUser!.uid });
      await createNotification({
        userUid: snap.data()!.userUid,
        type: 'support_reply',
        title: `Support Ticket Updated (${snap.data()!.ticketCode})`,
        message: adminReply.slice(0, 120),
        link: '/help',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'SUPPORT_TICKET_REPLIED',
        targetType: 'support_ticket',
        targetId: id,
        details: `Status set to ${status}.`,
        severity: 'info',
      });

      res.json({ id, status });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update ticket.' });
    }
  }
);

// Content Management + Admin Notice Board
paymentsAdminRouter.put(
  '/admin/content',
  requireAdmin,
  requirePermission('manage_content'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const announcementBanner = sanitizeString(req.body?.announcementBanner, 300);
      const safetyNotice = sanitizeString(req.body?.safetyNotice, 300);
      const featuredHeadline = sanitizeString(req.body?.featuredHeadline, 300);
      const noticeBoardTitle = sanitizeString(req.body?.noticeBoardTitle || '', 160);
      const noticeBoardMessage = sanitizeString(req.body?.noticeBoardMessage || '', 600);
      const adminContactUsername = sanitizeString(req.body?.adminContactUsername || '', 80);
      const adminContactEmail = sanitizeString(req.body?.adminContactEmail || '', 160).toLowerCase();
      const adminContactInstagram = sanitizeString(req.body?.adminContactInstagram || '', 120);

      await adminDb.collection('platform_settings').doc('main').set(
        {
          announcementBanner,
          safetyNotice,
          featuredHeadline,
          ...(noticeBoardTitle ? { noticeBoardTitle } : {}),
          ...(noticeBoardMessage ? { noticeBoardMessage } : {}),
          ...(adminContactUsername ? { adminContactUsername } : {}),
          ...(adminContactEmail ? { adminContactEmail } : {}),
          ...(adminContactInstagram ? { adminContactInstagram } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'CONTENT_UPDATED',
        targetType: 'platform_settings',
        targetId: 'main',
        details: 'Updated announcement banner, safety notice, hero headline, and Notice Board admin contacts.',
        severity: 'info',
      });

      res.json({ updated: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update website content.' });
    }
  }
);

// Dynamic Booking Categories Manager (Bengali & English) with strict non-violence enforcement
paymentsAdminRouter.put(
  '/admin/categories',
  requireAdmin,
  requirePermission('manage_content'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const rawList = Array.isArray(req.body?.categories) ? req.body.categories : null;
      if (!rawList) {
        return res.status(400).json({ error: 'Categories array is required.' });
      }

      const cleaned: string[] = [];
      const seen = new Set<string>();
      for (const item of rawList) {
        const val = sanitizeString(item, 120);
        if (!val) continue;
        if (containsUnsafeViolenceTerm(val)) {
          return res.status(400).json({ error: VIOLENCE_SAFETY_MESSAGE_BN });
        }
        const key = val.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          cleaned.push(val);
        }
        if (cleaned.length >= 30) break;
      }

      const finalCategories =
        cleaned.length > 0 ? cleaned : [...DEFAULT_BENGALI_BOOKING_CATEGORIES];

      await adminDb.collection('platform_settings').doc('main').set(
        {
          bookingCategories: finalCategories,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'BOOKING_CATEGORIES_UPDATED',
        targetType: 'platform_settings',
        targetId: 'main',
        details: `Admin updated ${finalCategories.length} booking categories.`,
        severity: 'info',
      });

      res.json({ bookingCategories: finalCategories });
    } catch (err) {
      console.error('Update categories error:', err);
      res.status(500).json({ error: 'Failed to save booking categories.' });
    }
  }
);

// ========================
// ADMIN MANAGEMENT & ROOT PROTECTION
// ========================

paymentsAdminRouter.get('/admin/accounts', requireAdmin, async (_req, res) => {
  try {
    const snap = await adminDb.collection('admin_accounts').get();
    const accounts = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const rolePerms = await getRolePermissions(data.role as UserRole);
        const permissions =
          data.role !== 'root_super_admin' && Array.isArray(data.customPermissions)
            ? (data.customPermissions as string[])
            : rolePerms;
        return {
          ...data,
          permissions,
          customPermissions: Array.isArray(data.customPermissions) ? data.customPermissions : undefined,
        };
      })
    );
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch administrator accounts.' });
  }
});

paymentsAdminRouter.post(
  '/admin/accounts',
  requireAdmin,
  requirePermission('create_admins'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const email = sanitizeString(req.body?.email || '', 200).toLowerCase();
      const phone = sanitizeString(req.body?.phone || '', 30);
      const rawUsername = sanitizeString(req.body?.username || '', 64)
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '');
      const fullName = sanitizeString(req.body?.fullName || 'LOGEASI Administrator', 120);
      const rawPassword = req.body?.password ? String(req.body.password) : '';
      const generateRandom = Boolean(req.body?.generateRandom);
      const requestedRole = req.body?.role as UserRole;

      // Never allow creating a second Root Super Admin
      if (requestedRole === 'root_super_admin') {
        return res.status(403).json({
          error: 'Forbidden: Only one permanent Root Super Admin can exist.',
        });
      }
      if (!isAdminRole(requestedRole)) {
        return res.status(400).json({ error: 'Invalid administrator role.' });
      }

      let finalUsername = rawUsername;
      if (generateRandom && !finalUsername) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = generateRandomAdminUsername('adm');
          const dup = await adminDb
            .collection('users')
            .where('username', '==', candidate)
            .limit(1)
            .get();
          if (dup.empty) {
            finalUsername = candidate;
            break;
          }
        }
      }

      if (!fullName || (!email && !phone && !finalUsername)) {
        return res.status(400).json({
          error: 'Full name and at least one of username, email, or phone are required.',
        });
      }

      if (finalUsername) {
        const existingUsername = await adminDb
          .collection('users')
          .where('username', '==', finalUsername)
          .limit(1)
          .get();
        if (!existingUsername.empty) {
          return res.status(409).json({ error: 'That admin username is already in use.' });
        }
      }

      if (email) {
        const existingEmail = await adminDb
          .collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        if (!existingEmail.empty) {
          return res.status(409).json({ error: 'That admin email is already registered.' });
        }
      }

      let passwordToUse = rawPassword;
      let wasPasswordGenerated = false;
      if (generateRandom && !passwordToUse) {
        passwordToUse = generateStrongRandomPassword(16);
        wasPasswordGenerated = true;
      }

      if (passwordToUse && passwordToUse.length < 8) {
        return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
      }

      const uid = `adm_${crypto.randomBytes(8).toString('hex')}`;
      const adminId = `ADM-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
      const now = new Date().toISOString();

      await adminDb.collection('admin_accounts').doc(uid).set({
        uid,
        adminId,
        username: finalUsername,
        email,
        phone,
        fullName,
        role: requestedRole,
        isRootOwner: false,
        status: 'active',
        createdByUid: req.authUser!.uid,
        createdAt: now,
      });

      await adminDb.collection('users').doc(uid).set({
        uid,
        username: finalUsername,
        email,
        phone,
        fullName,
        role: requestedRole,
        isAdultVerified18Plus: true,
        phoneVerified: Boolean(phone),
        emailVerified: Boolean(email),
        twoFactorEnabled: false,
        status: 'active',
        photoUrl: '',
        city: 'Dhaka',
        createdAt: now,
      });

      if (passwordToUse && passwordToUse.length >= 8) {
        const passwordHash = await hashPassword(passwordToUse);
        await adminDb.collection('users').doc(uid).collection('private').doc('security').set({
          uid,
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: '',
          lastLoginAt: '',
        });
      }

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: generateRandom ? 'ADMIN_CREATED_RANDOM' : 'ADMIN_CREATED',
        targetType: 'admin_account',
        targetId: uid,
        details: `Created admin ${adminId} (${fullName}${finalUsername ? `, @${finalUsername}` : ''}) with role ${requestedRole}.`,
        severity: 'warning',
      });

      res.status(201).json({
        adminId,
        uid,
        role: requestedRole,
        username: finalUsername || undefined,
        generatedPassword: wasPasswordGenerated ? passwordToUse : undefined,
      });
    } catch (err) {
      console.error('Create admin error:', err);
      res.status(500).json({ error: 'Failed to create administrator account.' });
    }
  }
);

const ROOT_EXCLUSIVE_PERMS = new Set([
  'manage_platform_config',
  'customize_role_permissions',
  'manage_backups',
]);
const VALID_PERMISSION_KEYS = new Set<string>(ALL_PERMISSIONS.map((p) => p.key));

paymentsAdminRouter.patch(
  '/admin/accounts/:uid',
  requireAdmin,
  requirePermission('manage_non_root_admins'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const targetUid = sanitizeId(req.params.uid);
      const {
        role,
        status,
        fullName,
        username,
        email,
        phone,
        customPermissions,
        regeneratePassword,
        newPassword,
      } = req.body || {};

      if (role === 'root_super_admin') {
        return res.status(403).json({
          error: 'Forbidden: Only one permanent Root Super Admin can exist.',
        });
      }

      const action =
        status === 'suspended'
          ? 'SUSPEND'
          : role && role !== 'root_super_admin'
            ? 'REMOVE_ROOT_ROLE'
            : 'MODIFY';

      const guard = await assertRootProtection({
        targetUid,
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action,
      });
      if (!guard.allowed) {
        return res.status(403).json({ error: guard.reason });
      }

      const adminUpdates: Record<string, any> = {};
      const userUpdates: Record<string, any> = {};

      if (typeof fullName === 'string' && fullName.trim()) {
        const cleanName = sanitizeString(fullName, 120);
        adminUpdates.fullName = cleanName;
        userUpdates.fullName = cleanName;
      }
      if (typeof username === 'string') {
        const cleanUsername = sanitizeString(username, 64)
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '');
        if (cleanUsername) {
          const dup = await adminDb
            .collection('users')
            .where('username', '==', cleanUsername)
            .limit(1)
            .get();
          if (!dup.empty && dup.docs[0].id !== targetUid) {
            return res.status(409).json({ error: 'That admin username is already in use.' });
          }
        }
        adminUpdates.username = cleanUsername;
        userUpdates.username = cleanUsername;
      }
      if (typeof email === 'string') {
        const cleanEmail = sanitizeString(email, 200).toLowerCase();
        adminUpdates.email = cleanEmail;
        userUpdates.email = cleanEmail;
        userUpdates.emailVerified = Boolean(cleanEmail);
      }
      if (typeof phone === 'string') {
        const cleanPhone = sanitizeString(phone, 30);
        adminUpdates.phone = cleanPhone;
        userUpdates.phone = cleanPhone;
        userUpdates.phoneVerified = Boolean(cleanPhone);
      }
      if (role && isAdminRole(role) && role !== 'root_super_admin') {
        adminUpdates.role = role;
        userUpdates.role = role;
      }
      if (status && ['active', 'suspended'].includes(status)) {
        adminUpdates.status = status;
        userUpdates.status = status;
      }
      if (customPermissions === null) {
        adminUpdates.customPermissions = null;
      } else if (Array.isArray(customPermissions)) {
        const sanitizedPerms = customPermissions
          .map((p: unknown) => sanitizeString(p, 80))
          .filter((p: string) => VALID_PERMISSION_KEYS.has(p))
          .filter((p: string) => req.authUser!.isRootOwner || !ROOT_EXCLUSIVE_PERMS.has(p));
        adminUpdates.customPermissions = Array.from(new Set(sanitizedPerms));
      }

      let generatedPassword: string | undefined;
      let passwordChanged = false;
      if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
        if (newPassword.trim().length < 8) {
          return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
        }
        const passwordHash = await hashPassword(newPassword.trim());
        await adminDb
          .collection('users')
          .doc(targetUid)
          .collection('private')
          .doc('security')
          .set(
            {
              uid: targetUid,
              passwordHash,
              failedLoginAttempts: 0,
              lockedUntil: '',
            },
            { merge: true }
          );
        passwordChanged = true;
      } else if (regeneratePassword === true) {
        generatedPassword = generateStrongRandomPassword(16);
        const passwordHash = await hashPassword(generatedPassword);
        await adminDb
          .collection('users')
          .doc(targetUid)
          .collection('private')
          .doc('security')
          .set(
            {
              uid: targetUid,
              passwordHash,
              failedLoginAttempts: 0,
              lockedUntil: '',
            },
            { merge: true }
          );
        passwordChanged = true;
      }

      if (Object.keys(adminUpdates).length === 0 && !passwordChanged) {
        return res.status(400).json({ error: 'No valid administrator updates provided.' });
      }

      if (Object.keys(adminUpdates).length > 0) {
        await adminDb.collection('admin_accounts').doc(targetUid).update(adminUpdates);
      }
      if (Object.keys(userUpdates).length > 0) {
        await adminDb.collection('users').doc(targetUid).update(userUpdates);
      }

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: generatedPassword ? 'ADMIN_PASSWORD_REGENERATED' : 'ADMIN_UPDATED',
        targetType: 'admin_account',
        targetId: targetUid,
        details: `Updated admin ${targetUid}: ${JSON.stringify(adminUpdates)}${passwordChanged ? ' (+ password updated)' : ''}`,
        severity: 'warning',
      });

      res.json({ updated: true, updates: adminUpdates, generatedPassword });
    } catch (err) {
      console.error('Update admin error:', err);
      res.status(500).json({ error: 'Failed to update administrator account.' });
    }
  }
);

paymentsAdminRouter.delete(
  '/admin/accounts/:uid',
  requireAdmin,
  requirePermission('manage_non_root_admins'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const targetUid = sanitizeId(req.params.uid);
      const guard = await assertRootProtection({
        targetUid,
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'DELETE',
      });
      if (!guard.allowed) {
        return res.status(403).json({ error: guard.reason });
      }

      await adminDb.collection('admin_accounts').doc(targetUid).delete();
      await adminDb.collection('users').doc(targetUid).update({ role: 'customer', status: 'deactivated' });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'ADMIN_DELETED',
        targetType: 'admin_account',
        targetId: targetUid,
        details: `Removed non-root administrator ${targetUid}.`,
        severity: 'critical',
      });

      res.json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete administrator account.' });
    }
  }
);

// Role Permission Matrix (Root Super Admin can customize)
paymentsAdminRouter.get('/admin/roles', requireAdmin, async (_req, res) => {
  try {
    const [rolesSnap, permsSnap] = await Promise.all([
      adminDb.collection('admin_roles').get(),
      adminDb.collection('admin_permissions').get(),
    ]);
    res.json({
      roles: rolesSnap.docs.map((d) => d.data()),
      permissions: permsSnap.docs.map((d) => d.data()),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load RBAC definitions.' });
  }
});

paymentsAdminRouter.put(
  '/admin/roles/:roleKey',
  requireAdmin,
  requireRootOwner,
  async (req: AuthenticatedRequest, res) => {
    try {
      const roleKey = sanitizeId(req.params.roleKey);
      if (roleKey === 'root_super_admin') {
        return res.status(403).json({ error: 'Root Super Admin permissions cannot be reduced.' });
      }
      if (!Object.keys(DEFAULT_ROLE_DEFINITIONS).includes(roleKey)) {
        return res.status(404).json({ error: 'Role not found.' });
      }

      const permissions = Array.isArray(req.body?.permissions)
        ? req.body.permissions.map((p: unknown) => sanitizeString(p, 80)).filter(Boolean)
        : [];

      await adminDb.collection('admin_roles').doc(roleKey).update({ permissions });
      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'RBAC_ROLE_CUSTOMIZED',
        targetType: 'admin_role',
        targetId: roleKey,
        details: `Root Super Admin updated permissions for ${roleKey}.`,
        severity: 'warning',
      });

      res.json({ roleKey, permissions });
    } catch (err) {
      res.status(500).json({ error: 'Failed to customize role permissions.' });
    }
  }
);

// Platform Settings (Root Super Admin only)
paymentsAdminRouter.put(
  '/admin/platform-settings',
  requireAdmin,
  requireRootOwner,
  async (req: AuthenticatedRequest, res) => {
    try {
      const serviceFeePercent = Math.max(0, Math.min(35, Number(req.body?.serviceFeePercent ?? 12)));
      const merchantApproved = Boolean(req.body?.merchantApproved);
      const requestedMode = req.body?.paymentMode === 'live' ? 'live' : 'sandbox';
      if (requestedMode === 'live' && !merchantApproved) {
        return res.status(400).json({
          error: 'Live payment mode requires confirmed merchant approval and security testing sign-off.',
        });
      }
      const cashPaymentEnabled = Boolean(req.body?.cashPaymentEnabled);
      const maxCashBookingBdt = Math.max(500, Math.min(20000, Number(req.body?.maxCashBookingBdt || 3000)));
      const bkashPersonalNumber = sanitizeString(req.body?.bkashPersonalNumber || '01700-000000', 40);
      const nagadPersonalNumber = sanitizeString(req.body?.nagadPersonalNumber || '01877pokpok', 40);

      await adminDb.collection('platform_settings').doc('main').set(
        {
          serviceFeePercent,
          merchantApproved,
          paymentMode: requestedMode,
          cashPaymentEnabled,
          maxCashBookingBdt,
          bkashPersonalNumber,
          nagadPersonalNumber,
          allowedDivision: 'সকল বাংলাদেশ বিভাগ (All 8 Divisions)',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'PLATFORM_SETTINGS_UPDATED',
        targetType: 'platform_settings',
        targetId: 'main',
        details: `Fee=${serviceFeePercent}%, mode=${requestedMode}, cashEnabled=${cashPaymentEnabled}.`,
        severity: 'critical',
      });

      res.json({ updated: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save platform settings.' });
    }
  }
);

// Security Center: Audit Logs & Backup Snapshot Export
paymentsAdminRouter.get(
  '/admin/audit-logs',
  requireAdmin,
  requirePermission('view_audit_logs'),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('audit_logs').get();
      const logs = snap.docs
        .map((d) => d.data())
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 150);
      res.json({ logs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load audit logs.' });
    }
  }
);

paymentsAdminRouter.get(
  '/admin/security/backup',
  requireAdmin,
  requireRootOwner,
  async (req: AuthenticatedRequest, res) => {
    try {
      const collections = [
        'users',
        'companion_profiles',
        'bookings',
        'payments',
        'refunds',
        'companion_payouts',
        'admin_accounts',
        'admin_roles',
        'platform_settings',
      ];
      const snapshot: Record<string, any[]> = {};
      for (const col of collections) {
        const snap = await adminDb.collection(col).get();
        snapshot[col] = snap.docs.map((d) => d.data());
      }

      const backupId = `BKP-${Date.now()}`;
      await adminDb.collection('backup_snapshots').doc(backupId).set({
        id: backupId,
        createdByUid: req.authUser!.uid,
        createdAt: new Date().toISOString(),
        recordCounts: Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, v.length])),
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'DISASTER_RECOVERY_BACKUP_EXPORTED',
        targetType: 'backup_snapshot',
        targetId: backupId,
        details: 'Root Super Admin exported platform backup snapshot.',
        severity: 'critical',
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="logeasi-backup-${backupId}.json"`);
      res.send(JSON.stringify({ backupId, exportedAt: new Date().toISOString(), snapshot }, null, 2));
    } catch (err) {
      res.status(500).json({ error: 'Backup generation failed.' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/change-password',
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'বর্তমান এবং নতুন পাসওয়ার্ড উভয়ই প্রয়োজন।' });
      }
      if (newPassword.length < 10 || newPassword.length > 128) {
        return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।' });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ error: 'নতুন পাসওয়ার্ড অবশ্যই বর্তমান পাসওয়ার্ড থেকে আলাদা হতে হবে।' });
      }

      const uid = req.authUser!.uid;
      const privRef = adminDb.collection('users').doc(uid).collection('private').doc('security');
      const privSnap = await privRef.get();
      const privData = privSnap.data() || {};
      const existingHash = typeof privData.passwordHash === 'string' ? privData.passwordHash : '';

      if (!existingHash || !(await verifyPassword(currentPassword, existingHash))) {
        return res.status(401).json({ error: 'বর্তমান পাসওয়ার্ড সঠিক নয়।' });
      }

      const passwordHash = await hashPassword(newPassword);
      await privRef.set(
        {
          uid,
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: '',
          passwordUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await writeAuditLog({
        actorUid: uid,
        actorRole: req.authUser!.role,
        action: 'ADMIN_PASSWORD_CHANGED',
        targetType: 'admin_account',
        targetId: uid,
        details: 'Admin changed their own login password via Security Dashboard.',
        severity: 'critical',
      });

      res.json({ updated: true });
    } catch (err) {
      console.error('Admin password change error:', err);
      res.status(500).json({ error: 'পাসওয়ার্ড পরিবর্তন করা যায়নি।' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/security/rotate-secrets',
  requireAdmin,
  requireRootOwner,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { rotatedAt } = rotateRuntimeSecrets();
      const sessionToken = signSessionToken({
        uid: req.authUser!.uid,
        email: req.authUser!.email,
        role: req.authUser!.role,
      });

      const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
      const isHttps = req.secure || proto.includes('https');
      res.cookie('logeasi_session', sessionToken, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 12,
        path: '/',
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'SECURITY_SECRETS_ROTATED',
        targetType: 'platform_security',
        targetId: 'runtime-secrets',
        details: 'Root Super Admin rotated runtime session and webhook signing secrets; prior tokens invalidated.',
        severity: 'critical',
      });

      res.json({ rotated: true, rotatedAt, sessionToken });
    } catch (err) {
      console.error('Secret rotation error:', err);
      res.status(500).json({ error: 'সেশন ও ওয়েবহুক সিক্রেট রোটেট করা যায়নি।' });
    }
  }
);

// Admin Companion Directory & Contact Power Controls
paymentsAdminRouter.get(
  '/admin/companions',
  requireAdmin,
  requireAnyPermission(['manage_companions', 'manage_customers']),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('companion_profiles').get();
      const companions = snap.docs
        .map((d) => d.data())
        .sort((a, b) => Number(b.ratingAvg || 0) - Number(a.ratingAvg || 0));
      res.json({ companions });
    } catch (err) {
      res.status(500).json({ error: 'Unable to list companion profiles.' });
    }
  }
);

paymentsAdminRouter.patch(
  '/admin/companions/:uid',
  requireAdmin,
  requireAnyPermission(['manage_companions', 'manage_customers']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const targetUid = sanitizeId(req.params.uid);
      const ref = adminDb.collection('companion_profiles').doc(targetUid);
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Companion profile not found.' });
      }

      const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
      const body = req.body || {};

      if (body.displayName !== undefined) updates.displayName = sanitizeString(body.displayName, 120);
      if (body.headline !== undefined) updates.headline = sanitizeString(body.headline, 180);
      if (body.city !== undefined) updates.city = sanitizeString(body.city, 80);
      if (body.division !== undefined) updates.division = sanitizeString(body.division, 80);
      if (body.hourlyRateBdt !== undefined) {
        updates.hourlyRateBdt = Math.max(500, Math.min(50000, Number(body.hourlyRateBdt)));
      }
      if (body.sessionRateBdt !== undefined) {
        updates.sessionRateBdt = Math.max(1000, Math.min(150000, Number(body.sessionRateBdt)));
      }
      if (body.instagramHandle !== undefined) {
        updates.instagramHandle = sanitizeString(body.instagramHandle, 160);
      }
      if (body.whatsappNumber !== undefined) {
        updates.whatsappNumber = sanitizeString(body.whatsappNumber, 40);
      }
      if (body.contactEmail !== undefined) {
        updates.contactEmail = sanitizeString(body.contactEmail, 160).toLowerCase();
      }
      if (body.isAvailableNow !== undefined) {
        updates.isAvailableNow = Boolean(body.isAvailableNow);
      }
      if (
        body.verificationStatus &&
        ['unverified', 'pending', 'approved', 'rejected'].includes(body.verificationStatus)
      ) {
        updates.verificationStatus = body.verificationStatus;
      }
      if (body.photoUrl !== undefined) {
        const cleanPhoto = sanitizePhotoData(body.photoUrl);
        if (cleanPhoto === null) {
          return res.status(400).json({
            error: 'Invalid photo format or size too large (max ~330 KB after compression).',
          });
        }
        updates.photoUrl = cleanPhoto;
      }

      await ref.update(updates);
      const userRef = adminDb.collection('users').doc(targetUid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const userSync: Record<string, any> = {};
        if (updates.photoUrl !== undefined) userSync.photoUrl = updates.photoUrl;
        if (updates.verificationStatus !== undefined) {
          userSync.verificationStatus = updates.verificationStatus;
          userSync.isAdultVerified18Plus = updates.verificationStatus === 'approved';
        }
        if (Object.keys(userSync).length > 0) {
          await userRef.update(userSync);
        }
      }

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'ADMIN_COMPANION_UPDATED',
        targetType: 'companion_profile',
        targetId: targetUid,
        details: `Admin updated companion details (${Object.keys(updates).filter((k) => k !== 'updatedAt').join(', ')}).`,
        severity: 'info',
      });

      const updatedSnap = await ref.get();
      res.json({ companion: updatedSnap.data() });
    } catch (err) {
      console.error('Admin companion update error:', err);
      res.status(500).json({ error: 'Failed to update companion profile.' });
    }
  }
);

// ========================
// ADMIN COMPANION APPLICATIONS, CREATION & WHATSAPP PAYOUT SETTLEMENT
// ========================

async function provisionCompanionAccountFromAdmin(params: {
  fullName: string;
  emailInput?: string;
  passwordInput?: string;
  whatsappNumber: string;
  city: string;
  division: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  hourlyRateBdt: number;
  sessionRateBdt: number;
  headline: string;
  bio: string;
  instagramHandle?: string;
  photoUrl?: string;
}): Promise<{ user: UserAccount; profile: CompanionProfile; email: string; issuedPassword: string }> {
  const randomSlug = crypto.randomBytes(3).toString('hex');
  const cleanEmail = sanitizeString(
    params.emailInput || `companion.${randomSlug}@logeasi.com`,
    200
  ).toLowerCase();

  const dup = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get();
  if (!dup.empty) {
    throw Object.assign(new Error(`ইমেইল ${cleanEmail} ইতিমধ্যেই ব্যবহৃত হচ্ছে। অন্য একটি ইমেইল দিন।`), {
      statusCode: 409,
    });
  }

  const rawPw = (params.passwordInput || '').trim();
  const issuedPassword = rawPw.length >= 6 ? rawPw : generateStrongRandomPassword(12);
  const passwordHash = await hashPassword(issuedPassword);

  const uid = `cmp_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();

  const newUser: UserAccount = {
    uid,
    email: cleanEmail,
    phone: params.whatsappNumber,
    fullName: params.fullName,
    role: 'companion',
    isAdultVerified18Plus: true,
    verificationStatus: 'approved',
    phoneVerified: Boolean(params.whatsappNumber),
    emailVerified: true,
    twoFactorEnabled: false,
    status: 'active',
    photoUrl: params.photoUrl || '',
    city: params.city,
    gender: params.gender,
    profileCompleted: true,
    profileUpdatedAt: now,
    referralCreditsBdt: 0,
    referralCount: 0,
    createdAt: now,
  };

  await adminDb.collection('users').doc(uid).set(newUser);
  const refMeta = await ensureUserReferralCode(newUser);
  newUser.referralCode = refMeta.referralCode;

  await adminDb.collection('users').doc(uid).collection('private').doc('security').set({
    uid,
    dateOfBirth: encryptSensitive(params.dateOfBirth || '1997-01-01'),
    passwordHash,
    failedLoginAttempts: 0,
    lastLoginAt: '',
  });

  const profile: CompanionProfile = {
    uid,
    displayName: params.fullName,
    headline: params.headline || 'যাচাইকৃত সামাজিক সঙ্গী · অ্যাডমিন অনুমোদিত',
    bio:
      params.bio ||
      'অ্যাডমিন দ্বারা যাচাইকৃত ও অনুমোদিত সামাজিক সঙ্গী। পাবলিক স্থানে নিরাপদ ও সম্মানজনক আড্ডা এবং ভ্রমণ সহায়তার জন্য বুকিং করুন।',
    city: params.city,
    division: params.division,
    gender: params.gender,
    areas: [params.city],
    languages: ['Bengali', 'English'],
    categories: ['টং এর আড্ডার রাজা (টং চা ও গল্প)', 'ঘোরা ফেরা ও শহর ভ্রমণ'],
    interests: ['Tea', 'Travel', 'Dining', 'Photography'],
    skills: ['Friendly Conversation', 'City Guide', 'Event Hosting'],
    hourlyRateBdt: Math.max(500, Number(params.hourlyRateBdt || 1500)),
    sessionRateBdt: Math.max(1000, Number(params.sessionRateBdt || 4200)),
    availabilityDays: ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
    availabilityHours: '10:00 AM – 9:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 5,
    reviewCount: 0,
    completedBookings: 0,
    pendingBalanceBdt: 0,
    availableBalanceBdt: 0,
    photoUrl: params.photoUrl || '',
    instagramHandle: params.instagramHandle || '',
    whatsappNumber: params.whatsappNumber,
    contactEmail: cleanEmail,
    updatedAt: now,
  };

  await adminDb.collection('companion_profiles').doc(uid).set(profile);
  return { user: newUser, profile, email: cleanEmail, issuedPassword };
}

paymentsAdminRouter.get(
  '/admin/companion-applications',
  requireAdmin,
  requireAnyPermission(['approve_verifications', 'manage_companions', 'manage_customers']),
  async (_req, res) => {
    try {
      const snap = await adminDb.collection('companion_applications').get();
      const applications = snap.docs
        .map((d) => d.data())
        .sort((a, b) => {
          const ap = a.status === 'pending' ? 0 : 1;
          const bp = b.status === 'pending' ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
      res.json({ applications });
    } catch (err) {
      res.status(500).json({ error: 'সঙ্গী আবেদন তালিকা লোড করা যায়নি।' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/companion-applications/:id/approve-create',
  requireAdmin,
  requireAnyPermission(['approve_verifications', 'manage_companions', 'manage_customers']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const ref = adminDb.collection('companion_applications').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'আবেদনটি পাওয়া যায়নি।' });

      const app = snap.data() as CompanionApplicationRecord;
      if (app.status === 'approved' && app.issuedUid) {
        return res.status(409).json({
          error: `এই আবেদনের বিপরীতে ইতিমধ্যেই সঙ্গী অ্যাকাউন্ট (${app.issuedEmail}) তৈরি হয়েছে।`,
        });
      }

      const requestedEmail = sanitizeString(req.body?.email || app.contactEmail || '', 200).toLowerCase();
      const requestedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
      const hourlyRateBdt = Math.max(500, Number(req.body?.hourlyRateBdt || app.hourlyRateBdt || 1500));
      const sessionRateBdt = Math.max(1000, Number(req.body?.sessionRateBdt || app.sessionRateBdt || 4200));
      const adminNote = sanitizeString(req.body?.adminNote || 'অ্যাডমিন দ্বারা অনুমোদিত ও WhatsApp-এ হস্তান্তরিত', 400);

      const provisioned = await provisionCompanionAccountFromAdmin({
        fullName: app.fullName,
        emailInput: requestedEmail,
        passwordInput: requestedPassword,
        whatsappNumber: app.whatsappNumber,
        city: app.city,
        division: app.division,
        gender: app.gender,
        dateOfBirth: app.dateOfBirth,
        hourlyRateBdt,
        sessionRateBdt,
        headline: app.headline,
        bio: app.bio,
        instagramHandle: app.instagramHandle,
        photoUrl: app.photoUrl,
      });

      const now = new Date().toISOString();
      await ref.update({
        status: 'approved',
        adminNote,
        issuedUid: provisioned.user.uid,
        issuedEmail: provisioned.email,
        reviewedByUid: req.authUser!.uid,
        updatedAt: now,
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'COMPANION_APPLICATION_APPROVED_ACCOUNT_CREATED',
        targetType: 'companion_application',
        targetId: id,
        details: `Approved ${app.fullName} (${app.whatsappNumber}) -> created companion ${provisioned.email}.`,
        severity: 'warning',
      });

      res.status(201).json({
        applicationId: id,
        companionUid: provisioned.user.uid,
        fullName: app.fullName,
        whatsappNumber: app.whatsappNumber,
        email: provisioned.email,
        issuedPassword: provisioned.issuedPassword,
      });
    } catch (err: any) {
      const code = Number(err?.statusCode) || 500;
      res.status(code).json({ error: err?.message || 'সঙ্গী অ্যাকাউন্ট তৈরি করা যায়নি।' });
    }
  }
);

paymentsAdminRouter.post(
  '/admin/companion-applications/:id/reject',
  requireAdmin,
  requireAnyPermission(['approve_verifications', 'manage_companions', 'manage_customers']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const adminNote = sanitizeString(req.body?.adminNote || 'আবেদনটি অ্যাডমিন দ্বারা প্রত্যাখ্যান করা হয়েছে।', 400);
      const ref = adminDb.collection('companion_applications').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'আবেদনটি পাওয়া যায়নি।' });

      await ref.update({
        status: 'rejected',
        adminNote,
        reviewedByUid: req.authUser!.uid,
        updatedAt: new Date().toISOString(),
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'COMPANION_APPLICATION_REJECTED',
        targetType: 'companion_application',
        targetId: id,
        details: adminNote,
        severity: 'info',
      });

      res.json({ id, status: 'rejected' });
    } catch (err) {
      res.status(500).json({ error: 'আবেদন বাতিল করা যায়নি।' });
    }
  }
);

// Direct Admin Companion Creation (without waiting for an application)
paymentsAdminRouter.post(
  '/admin/companions/create',
  requireAdmin,
  requireAnyPermission(['manage_companions', 'manage_customers', 'approve_verifications']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const fullName = sanitizeString(req.body?.fullName, 120);
      const whatsappNumber = sanitizeString(req.body?.whatsappNumber, 40);
      const emailInput = sanitizeString(req.body?.email || '', 200).toLowerCase();
      const passwordInput = typeof req.body?.password === 'string' ? req.body.password : '';
      const city = sanitizeString(req.body?.city || 'Dhaka', 80);
      const division = sanitizeString(req.body?.division || 'Dhaka', 80);
      const gender: 'male' | 'female' = req.body?.gender === 'female' ? 'female' : 'male';
      const dateOfBirth = sanitizeString(req.body?.dateOfBirth || '1997-05-15', 20);
      const hourlyRateBdt = Math.max(500, Number(req.body?.hourlyRateBdt || 1500));
      const sessionRateBdt = Math.max(1000, Number(req.body?.sessionRateBdt || 4200));
      const headline = sanitizeString(req.body?.headline || 'যাচাইকৃত সামাজিক সঙ্গী', 180);
      const bio = sanitizeString(req.body?.bio || '', 1000);
      const instagramHandle = sanitizeString(req.body?.instagramHandle || '', 120);
      let photoUrl = '';
      if (req.body?.photoUrl) {
        const clean = sanitizePhotoData(req.body.photoUrl);
        if (clean) photoUrl = clean;
      }

      if (!fullName || !whatsappNumber) {
        return res.status(400).json({ error: 'সঙ্গীর নাম ও WhatsApp নম্বর দিন।' });
      }
      if (calculateAgeFromDob(dateOfBirth) < 18) {
        return res.status(400).json({ error: 'সঙ্গীর বয়স অবশ্যই ১৮+ হতে হবে।' });
      }

      const provisioned = await provisionCompanionAccountFromAdmin({
        fullName,
        emailInput,
        passwordInput,
        whatsappNumber,
        city,
        division,
        gender,
        dateOfBirth,
        hourlyRateBdt,
        sessionRateBdt,
        headline,
        bio,
        instagramHandle,
        photoUrl,
      });

      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'ADMIN_CREATED_COMPANION_ACCOUNT',
        targetType: 'companion_profile',
        targetId: provisioned.user.uid,
        details: `Admin created companion account ${provisioned.email} for ${fullName} (${whatsappNumber}).`,
        severity: 'warning',
      });

      res.status(201).json({
        companionUid: provisioned.user.uid,
        fullName,
        whatsappNumber,
        email: provisioned.email,
        issuedPassword: provisioned.issuedPassword,
      });
    } catch (err: any) {
      const code = Number(err?.statusCode) || 500;
      res.status(code).json({ error: err?.message || 'সরাসরি সঙ্গী অ্যাকাউন্ট তৈরি করা যায়নি।' });
    }
  }
);

// Admin Settles / Sends Companion Money directly via WhatsApp / bKash / Nagad after collecting payment
paymentsAdminRouter.post(
  '/admin/companions/:uid/settle-whatsapp',
  requireAdmin,
  requireAnyPermission(['manage_payments', 'review_payouts', 'manage_companions']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const companionUid = sanitizeId(req.params.uid);
      const cmpRef = adminDb.collection('companion_profiles').doc(companionUid);
      const cmpSnap = await cmpRef.get();
      if (!cmpSnap.exists) return res.status(404).json({ error: 'সঙ্গী প্রোফাইল পাওয়া যায়নি।' });
      const cmp = cmpSnap.data() as CompanionProfile;

      const available = Math.max(0, Number(cmp.availableBalanceBdt || 0));
      const pending = Math.max(0, Number(cmp.pendingBalanceBdt || 0));
      const maxSettleable = available + pending;
      const requestedAmount = req.body?.amountBdt ? Math.round(Number(req.body.amountBdt)) : available || maxSettleable;

      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
        return res.status(400).json({
          error: 'এই সঙ্গীর জন্য কোনো বকেয়া/পরিশোধযোগ্য ব্যালেন্স নেই অথবা সঠিক পরিমাণ লিখুন।',
        });
      }
      if (requestedAmount > maxSettleable) {
        return res.status(400).json({
          error: `সর্বোচ্চ ৳${maxSettleable.toLocaleString()} পর্যন্ত পরিশোধ রেকর্ড করা যাবে।`,
        });
      }

      const deductFromAvailable = Math.min(available, requestedAmount);
      const deductFromPending = Math.max(0, requestedAmount - deductFromAvailable);
      const nextAvailable = available - deductFromAvailable;
      const nextPending = Math.max(0, pending - deductFromPending);

      const now = new Date().toISOString();
      const note = sanitizeString(
        req.body?.note || `WhatsApp (${cmp.whatsappNumber || 'N/A'}) যোগাযোগের মাধ্যমে অ্যাডমিন দ্বারা টাকা হস্তান্তরিত।`,
        300
      );
      const payoutId = `PYT_WA_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const maskedPhone = cmp.whatsappNumber
        ? `${'*'.repeat(Math.max(4, cmp.whatsappNumber.length - 4))}${cmp.whatsappNumber.slice(-4)}`
        : 'WhatsApp';

      await cmpRef.update({
        availableBalanceBdt: nextAvailable,
        pendingBalanceBdt: nextPending,
        updatedAt: now,
      });

      const payoutRecord = {
        id: payoutId,
        companionUid,
        companionName: cmp.displayName,
        amountBdt: requestedAmount,
        method: 'whatsapp_handoff',
        accountMasked: maskedPhone,
        status: 'paid',
        reviewedByUid: req.authUser!.uid,
        adminNote: note,
        createdAt: now,
      };
      await adminDb.collection('companion_payouts').doc(payoutId).set(payoutRecord);

      await Promise.all([
        createNotification({
          userUid: companionUid,
          type: 'payout_whatsapp_settled',
          title: `অ্যাডমিন ৳${requestedAmount.toLocaleString()} পরিশোধ করেছেন`,
          message: `${note} — আপনার সঙ্গী ড্যাশবোর্ডে বিস্তারিত দেখুন।`,
          link: '/dashboard/companion',
        }),
        writeAuditLog({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: 'ADMIN_WHATSAPP_COMPANION_SETTLEMENT',
          targetType: 'companion_payout',
          targetId: payoutId,
          details: `Settled BDT ${requestedAmount} to ${cmp.displayName} (${cmp.whatsappNumber || companionUid}) via WhatsApp/Admin handoff.`,
          severity: 'info',
        }),
      ]);

      res.json({
        settled: true,
        payout: payoutRecord,
        availableBalanceBdt: nextAvailable,
        pendingBalanceBdt: nextPending,
      });
    } catch (err) {
      console.error('WhatsApp settle error:', err);
      res.status(500).json({ error: 'সঙ্গীর টাকা হস্তান্তর রেকর্ড করা যায়নি।' });
    }
  }
);

paymentsAdminRouter.delete(
  '/admin/companion-posts/:id',
  requireAdmin,
  requireAnyPermission(['manage_content', 'manage_companions']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = sanitizeId(req.params.id);
      const ref = adminDb.collection('companion_posts').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'পোস্ট খুঁজে পাওয়া যায়নি।' });
      await ref.delete();
      await writeAuditLog({
        actorUid: req.authUser!.uid,
        actorRole: req.authUser!.role,
        action: 'ADMIN_DELETED_COMPANION_POST',
        targetType: 'companion_post',
        targetId: id,
        details: `Admin removed companion post ${id}.`,
        severity: 'warning',
      });
      res.json({ deleted: true, id });
    } catch (err) {
      res.status(500).json({ error: 'পোস্ট মুছে ফেলা যায়নি।' });
    }
  }
);

