import crypto from 'node:crypto';
import { adminDb } from '../lib/firebase-admin.ts';
import { createNotification, writeAuditLog } from './rbac.ts';
import { sanitizeString } from './security.ts';
import type {
  ReferralRecord,
  ReferralTransactionRecord,
  UserAccount,
} from '../types/logeasi.ts';

export const REFERRER_BONUS_CREDITS = 250; // 250 credit points = ৳250
export const REFERRED_WELCOME_CREDITS = 150; // 150 credit points = ৳150

function buildCandidateCode(fullName: string): string {
  const cleanPrefix = (fullName || 'USER')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const prefix = cleanPrefix.length >= 2 ? cleanPrefix : 'LGSU';
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LGS-${prefix}${suffix}`;
}

export async function ensureUserReferralCode(user: UserAccount): Promise<{
  referralCode: string;
  referralCreditsBdt: number;
  referralCount: number;
}> {
  const existingCode = sanitizeString(user.referralCode || '', 32).toUpperCase();
  const existingCredits = Math.max(0, Math.round(Number(user.referralCreditsBdt || 0)));
  const existingCount = Math.max(0, Math.round(Number(user.referralCount || 0)));

  if (existingCode) {
    return {
      referralCode: existingCode,
      referralCreditsBdt: existingCredits,
      referralCount: existingCount,
    };
  }

  let candidate = buildCandidateCode(user.fullName);
  for (let i = 0; i < 5; i++) {
    const dup = await adminDb
      .collection('users')
      .where('referralCode', '==', candidate)
      .limit(1)
      .get();
    if (dup.empty) break;
    candidate = `LGS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  await adminDb.collection('users').doc(user.uid).update({
    referralCode: candidate,
    referralCreditsBdt: existingCredits,
    referralCount: existingCount,
  });

  return {
    referralCode: candidate,
    referralCreditsBdt: existingCredits,
    referralCount: existingCount,
  };
}

export async function findUserByReferralCode(rawCode: string): Promise<UserAccount | null> {
  const cleanCode = sanitizeString(rawCode || '', 32).trim().toUpperCase();
  if (!cleanCode) return null;

  const snap = await adminDb
    .collection('users')
    .where('referralCode', '==', cleanCode)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const user = snap.docs[0].data() as UserAccount;
  if (user.status !== 'active') return null;
  return user;
}

export async function recordReferralTransaction(input: {
  userUid: string;
  type: ReferralTransactionRecord['type'];
  creditsBdt: number;
  balanceAfterBdt: number;
  description: string;
  relatedReferralId?: string;
  relatedBookingId?: string;
  relatedBookingCode?: string;
}): Promise<ReferralTransactionRecord> {
  const id = `RTX_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const tx: ReferralTransactionRecord = {
    id,
    userUid: input.userUid,
    type: input.type,
    creditsBdt: Math.round(input.creditsBdt),
    balanceAfterBdt: Math.max(0, Math.round(input.balanceAfterBdt)),
    description: sanitizeString(input.description, 300),
    ...(input.relatedReferralId ? { relatedReferralId: input.relatedReferralId } : {}),
    ...(input.relatedBookingId ? { relatedBookingId: input.relatedBookingId } : {}),
    ...(input.relatedBookingCode ? { relatedBookingCode: input.relatedBookingCode } : {}),
    createdAt: new Date().toISOString(),
  };
  await adminDb.collection('referral_transactions').doc(id).set(tx);
  return tx;
}

export async function applyReferralOnSignup(params: {
  newUser: UserAccount;
  rawReferralCode?: string;
}): Promise<{ applied: boolean; bonusCredits: number; referrerName?: string }> {
  const cleanCode = sanitizeString(params.rawReferralCode || '', 32).trim().toUpperCase();
  if (!cleanCode || params.newUser.referredByUid) {
    return { applied: false, bonusCredits: 0 };
  }

  const referrer = await findUserByReferralCode(cleanCode);
  if (!referrer || referrer.uid === params.newUser.uid) {
    return { applied: false, bonusCredits: 0 };
  }

  const now = new Date().toISOString();
  const referralId = `REF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const referrerNewBalance =
    Math.max(0, Math.round(Number(referrer.referralCreditsBdt || 0))) + REFERRER_BONUS_CREDITS;
  const newUserBalance =
    Math.max(0, Math.round(Number(params.newUser.referralCreditsBdt || 0))) +
    REFERRED_WELCOME_CREDITS;

  const referralRecord: ReferralRecord = {
    id: referralId,
    referrerUid: referrer.uid,
    referrerName: referrer.fullName,
    referredUid: params.newUser.uid,
    referredName: params.newUser.fullName,
    referredRole: params.newUser.role,
    referralCode: cleanCode,
    referrerRewardCredits: REFERRER_BONUS_CREDITS,
    referredBonusCredits: REFERRED_WELCOME_CREDITS,
    status: 'credited',
    createdAt: now,
  };

  await Promise.all([
    adminDb.collection('referrals').doc(referralId).set(referralRecord),
    adminDb.collection('users').doc(referrer.uid).update({
      referralCreditsBdt: referrerNewBalance,
      referralCount: Math.max(0, Math.round(Number(referrer.referralCount || 0))) + 1,
    }),
    adminDb.collection('users').doc(params.newUser.uid).update({
      referralCreditsBdt: newUserBalance,
      referredByUid: referrer.uid,
      referredByCode: cleanCode,
    }),
    recordReferralTransaction({
      userUid: referrer.uid,
      type: 'earned_referral',
      creditsBdt: REFERRER_BONUS_CREDITS,
      balanceAfterBdt: referrerNewBalance,
      description: `${params.newUser.fullName} আপনার ইনভাইট কোড (${cleanCode}) দিয়ে যোগ দিয়েছেন।`,
      relatedReferralId: referralId,
    }),
    recordReferralTransaction({
      userUid: params.newUser.uid,
      type: 'earned_welcome_bonus',
      creditsBdt: REFERRED_WELCOME_CREDITS,
      balanceAfterBdt: newUserBalance,
      description: `${referrer.fullName}-এর রেফারেল কোড (${cleanCode}) ব্যবহার করায় স্বাগতম ক্রেডিট বোনাস।`,
      relatedReferralId: referralId,
    }),
    createNotification({
      userUid: referrer.uid,
      type: 'referral_reward',
      title: `রেফারেল বোনাস +${REFERRER_BONUS_CREDITS} ক্রেডিট!`,
      message: `${params.newUser.fullName} আপনার ইনভাইট লিংকে সাইন আপ করায় আপনার অ্যাকাউন্টে ${REFERRER_BONUS_CREDITS} ক্রেডিট পয়েন্ট (৳${REFERRER_BONUS_CREDITS}) যোগ হয়েছে।`,
      link: '/referrals',
    }),
    createNotification({
      userUid: params.newUser.uid,
      type: 'referral_welcome_bonus',
      title: `স্বাগতম +${REFERRED_WELCOME_CREDITS} ক্রেডিট পয়েন্ট!`,
      message: `রেফারেল কোড ${cleanCode} ব্যবহার করায় পরবর্তী সঙ্গী বুকিংয়ে ব্যবহারের জন্য ${REFERRED_WELCOME_CREDITS} ক্রেডিট পয়েন্ট (৳${REFERRED_WELCOME_CREDITS}) পেয়েছেন।`,
      link: '/referrals',
    }),
    writeAuditLog({
      actorUid: params.newUser.uid,
      actorRole: params.newUser.role,
      action: 'REFERRAL_CREDITED',
      targetType: 'referral',
      targetId: referralId,
      details: `Referrer ${referrer.uid} (+${REFERRER_BONUS_CREDITS}) and referred ${params.newUser.uid} (+${REFERRED_WELCOME_CREDITS}) via ${cleanCode}.`,
      severity: 'info',
    }),
  ]);

  return {
    applied: true,
    bonusCredits: REFERRED_WELCOME_CREDITS,
    referrerName: referrer.fullName,
  };
}
