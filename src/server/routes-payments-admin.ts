import crypto from 'node:crypto';
import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin.ts';
import {
  attachAuthIfPresent,
  requireAdmin,
  requireAuth,
  requirePermission,
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
  generateRandomAdminUsername,
  generateStrongRandomPassword,
  hashPassword,
  sanitizeId,
  sanitizePhotoData,
  sanitizeString,
  signWebhookPayload,
  verifyWebhookSignature,
} from './security.ts';
import type { BookingRecord, PaymentGateway, PaymentRecord, UserRole } from '../types/logeasi.ts';
import {
  containsUnsafeViolenceTerm,
  DEFAULT_BENGALI_BOOKING_CATEGORIES,
  VIOLENCE_SAFETY_MESSAGE_BN,
} from '../data/bookingCategories.ts';

export const paymentsAdminRouter = Router();
paymentsAdminRouter.use(attachAuthIfPresent);

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

  // Update booking status automatically AFTER verified webhook
  await adminDb.collection('bookings').doc(payment.bookingId).update({
    status: 'confirmed_paid',
    paymentStatus: 'paid',
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
  ]);

  return { alreadyProcessed: false, payment: { ...payment, status: 'verified_paid', webhookVerified: true } };
}

paymentsAdminRouter.post('/payments/initiate', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const bookingId = sanitizeId(req.body?.bookingId);
    const gateway = req.body?.gateway as PaymentGateway;
    if (!['bkash', 'nagad', 'rocket', 'sslcommerz', 'cash'].includes(gateway)) {
      return res.status(400).json({ error: 'Unsupported payment gateway.' });
    }

    const [bSnap, settingsSnap] = await Promise.all([
      adminDb.collection('bookings').doc(bookingId).get(),
      adminDb.collection('platform_settings').doc('main').get(),
    ]);

    if (!bSnap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = bSnap.data() as BookingRecord;

    if (booking.customerUid !== req.authUser!.uid) {
      return res.status(403).json({ error: 'Only the booking customer can initiate payment.' });
    }
    if (!['price_agreed_awaiting_payment', 'payment_pending'].includes(booking.status)) {
      return res.status(400).json({
        error: 'Both parties must agree on the final price before payment initiation.',
      });
    }

    const settings = settingsSnap.data() || {};
    const mode = settings.paymentMode === 'live' && settings.merchantApproved ? 'live' : 'sandbox';

    if (gateway === 'cash') {
      if (!settings.cashPaymentEnabled) {
        return res.status(403).json({ error: 'Cash payment is currently disabled by platform policy.' });
      }
      const maxCash = Number(settings.maxCashBookingBdt || 3000);
      if (booking.agreedPriceBdt > maxCash) {
        return res.status(400).json({
          error: `Cash payment is permitted only for bookings up to BDT ৳${maxCash.toLocaleString()}.`,
        });
      }
    }

    const paymentId = `PAY_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const transactionId = `LGS-${gateway.toUpperCase().slice(0, 3)}-${crypto.randomInt(1000000, 9999999)}`;
    const gatewaySessionId = `SBX_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const record: PaymentRecord = {
      id: paymentId,
      transactionId,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      customerUid: booking.customerUid,
      companionUid: booking.companionUid,
      gateway,
      mode,
      amountBdt: booking.agreedPriceBdt,
      platformFeeBdt: booking.platformFeeBdt,
      companionNetBdt: booking.companionNetBdt,
      status: gateway === 'cash' ? 'cash_pending' : 'initiated',
      webhookVerified: false,
      gatewaySessionId,
      createdAt: now,
    };

    await adminDb.collection('payments').doc(paymentId).set(record);
    await adminDb.collection('bookings').doc(booking.id).update({
      status: gateway === 'cash' ? 'confirmed_paid' : 'payment_pending',
      paymentStatus: gateway === 'cash' ? 'cash_pending' : 'pending',
      updatedAt: now,
    });

    if (gateway === 'cash') {
      await createNotification({
        userUid: booking.companionUid,
        type: 'cash_booking_confirmed',
        title: `Cash-on-Meetup Booking Confirmed (${booking.bookingCode})`,
        message: `Customer selected permitted cash payment (BDT ৳${booking.agreedPriceBdt.toLocaleString()}).`,
        link: '/dashboard/companion',
      });
    }

    res.status(201).json({
      payment: record,
      sandboxCheckoutReady: gateway !== 'cash',
    });
  } catch (err) {
    console.error('Initiate payment error:', err);
    res.status(500).json({ error: 'Unable to initiate payment checkout.' });
  }
});

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

// Customer submits Personal bKash (1) or Personal Nagad (2: 01877pokpok) Transaction Reference ID (NO PIN/OTP ever stored)
paymentsAdminRouter.post(
  '/payments/:id/submit-personal-trx',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const paymentId = sanitizeId(req.params.id);
      const trxId = sanitizeString(req.body?.senderReferenceTrxId || '', 60).toUpperCase();
      if (!trxId || trxId.length < 5) {
        return res.status(400).json({
          error: 'Enter a valid bKash/Nagad Transaction ID (minimum 5 characters). Never enter your PIN.',
        });
      }

      const payRef = adminDb.collection('payments').doc(paymentId);
      const paySnap = await payRef.get();
      if (!paySnap.exists) return res.status(404).json({ error: 'Payment session not found.' });
      const payment = paySnap.data() as PaymentRecord;

      if (payment.customerUid !== req.authUser!.uid) {
        return res.status(403).json({ error: 'Unauthorized payment session.' });
      }
      if (!['bkash', 'nagad'].includes(payment.gateway)) {
        return res.status(400).json({
          error: 'Manual TrxID submission applies only to Personal bKash or Personal Nagad payments.',
        });
      }
      if (payment.status === 'verified_paid') {
        return res.status(400).json({ error: 'This payment is already verified and settled.' });
      }

      const now = new Date().toISOString();
      await payRef.update({
        senderReferenceTrxId: trxId,
        status: 'pending_manual_verification',
      });
      await adminDb.collection('bookings').doc(payment.bookingId).update({
        status: 'payment_pending',
        paymentStatus: 'pending',
        updatedAt: now,
      });

      await Promise.all([
        createNotification({
          userUid: payment.companionUid,
          type: 'personal_payment_submitted',
          title: `Personal ${payment.gateway.toUpperCase()} TrxID Submitted (${payment.transactionId})`,
          message: `Customer submitted TrxID ${trxId} for BDT ৳${payment.amountBdt.toLocaleString()}. Pending Finance Admin verification.`,
          link: '/dashboard/companion',
        }),
        writeAuditLog({
          actorUid: req.authUser!.uid,
          actorRole: req.authUser!.role,
          action: 'PERSONAL_MFS_TRX_SUBMITTED',
          targetType: 'payment',
          targetId: payment.id,
          details: `Submitted ${payment.gateway.toUpperCase()} Personal TrxID=${trxId} for booking ${payment.bookingCode || payment.bookingId}.`,
          severity: 'info',
        }),
      ]);

      res.json({
        payment: {
          ...payment,
          senderReferenceTrxId: trxId,
          status: 'pending_manual_verification',
        },
      });
    } catch (err) {
      console.error('Submit personal trx error:', err);
      res.status(500).json({ error: 'Unable to submit personal transaction reference.' });
    }
  }
);

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

      const now = new Date().toISOString();
      if (decision === 'reject') {
        await payRef.update({ status: 'failed', verifiedAt: now });
        await adminDb.collection('bookings').doc(payment.bookingId).update({
          status: 'price_agreed_awaiting_payment',
          paymentStatus: 'unpaid',
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
      await adminDb.collection('bookings').doc(payment.bookingId).update({
        status: 'confirmed_paid',
        paymentStatus: 'paid',
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

      await Promise.all([
        createNotification({
          userUid: payment.customerUid,
          type: 'payment_confirmed',
          title: `Personal ${payment.gateway.toUpperCase()} Verified (${payment.transactionId})`,
          message: `TrxID ${payment.senderReferenceTrxId || ''} verified for BDT ৳${payment.amountBdt.toLocaleString()}. Booking is confirmed.`,
          link: '/bookings',
        }),
        createNotification({
          userUid: payment.companionUid,
          type: 'payment_confirmed',
          title: `Booking Confirmed & Paid (${payment.transactionId})`,
          message: `Personal ${payment.gateway.toUpperCase()} payment verified. Net earnings BDT ৳${payment.companionNetBdt.toLocaleString()} held in escrow.`,
          link: '/dashboard/companion',
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

// Update Personal bKash & Personal Nagad receiving numbers (Finance Admin or Root)
paymentsAdminRouter.put(
  '/admin/personal-payment-numbers',
  requireAdmin,
  requirePermission('manage_payments'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const bkashPersonalNumber = sanitizeString(req.body?.bkashPersonalNumber || '', 40);
      const nagadPersonalNumber = sanitizeString(req.body?.nagadPersonalNumber || '', 40);
      if (!bkashPersonalNumber || !nagadPersonalNumber) {
        return res.status(400).json({ error: 'Both Personal bKash and Personal Nagad numbers are required.' });
      }
      await adminDb.collection('platform_settings').doc('main').set(
        {
          bkashPersonalNumber,
          nagadPersonalNumber,
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
        details: `Updated Personal bKash=${bkashPersonalNumber}, Personal Nagad=${nagadPersonalNumber}.`,
        severity: 'warning',
      });
      res.json({ updated: true, bkashPersonalNumber, nagadPersonalNumber });
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
paymentsAdminRouter.post('/payouts/request', requireAuth, async (req: AuthenticatedRequest, res) => {
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

      // Build 7-bucket chart series
      const gatewayBreakdown = ['bkash', 'nagad', 'rocket', 'sslcommerz', 'cash'].map((gw) => ({
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
        .filter((u) => ['customer', 'companion'].includes(u.role));
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

      await adminDb.collection('users').doc(targetUid).update({ status });
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
      res.status(500).json({ error: 'Failed to update user status.' });
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
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
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

      await ref.update({
        status: decision,
        reviewerNote,
        reviewedByUid: req.authUser!.uid,
      });

      const cmpRef = adminDb.collection('companion_profiles').doc(ver.uid);
      const cmpSnap = await cmpRef.get();
      if (cmpSnap.exists) {
        await cmpRef.update({
          verificationStatus: decision,
          updatedAt: new Date().toISOString(),
        });
      }

      await createNotification({
        userUid: ver.uid,
        type: 'verification_update',
        title: `Identity Verification ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        message:
          decision === 'approved'
            ? 'Your 18+ identity verification is approved. Your verified status is now active on LOGEASI.COM.'
            : `Your verification request was declined: ${reviewerNote || 'Document unclear.'}`,
        link: '/dashboard/companion',
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

      res.json({ id, status: decision });
    } catch (err) {
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

// Content Management
paymentsAdminRouter.put(
  '/admin/content',
  requireAdmin,
  requirePermission('manage_content'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const announcementBanner = sanitizeString(req.body?.announcementBanner, 300);
      const safetyNotice = sanitizeString(req.body?.safetyNotice, 300);
      const featuredHeadline = sanitizeString(req.body?.featuredHeadline, 300);

      await adminDb.collection('platform_settings').doc('main').set(
        {
          announcementBanner,
          safetyNotice,
          featuredHeadline,
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
        details: 'Updated announcement banner, safety notice, and hero headline.',
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
      if (regeneratePassword === true) {
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
      }

      if (Object.keys(adminUpdates).length === 0 && !generatedPassword) {
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
        details: `Updated admin ${targetUid}: ${JSON.stringify(adminUpdates)}${generatedPassword ? ' (+ password rotated)' : ''}`,
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
          allowedDivision: 'Dhaka Division',
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

// Admin Companion Directory & Contact Power Controls
paymentsAdminRouter.get(
  '/admin/companions',
  requireAdmin,
  requirePermission('manage_customers'),
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
  requirePermission('manage_customers'),
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
      if (updates.photoUrl !== undefined) {
        const userRef = adminDb.collection('users').doc(targetUid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          await userRef.update({ photoUrl: updates.photoUrl });
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
