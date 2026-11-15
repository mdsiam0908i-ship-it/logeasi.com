import crypto from 'node:crypto';
import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin.ts';
import {
  attachAuthIfPresent,
  requireAuth,
  requireProfileUnlocked,
  type AuthenticatedRequest,
} from './middleware.ts';
import { createNotification, isAdminRole, writeAuditLog } from './rbac.ts';
import {
  REFERRER_BONUS_CREDITS,
  REFERRED_WELCOME_CREDITS,
  ensureUserReferralCode,
  findUserByReferralCode,
  recordReferralTransaction,
} from './referrals.ts';
import {
  calculateAgeFromDob,
  maskDocumentNumber,
  sanitizeId,
  sanitizePhotoData,
  sanitizeString,
} from './security.ts';
import type { BookingRecord, CompanionProfile } from '../types/logeasi.ts';
import {
  BANGLADESH_DIVISIONS,
  isKnownBangladeshLocation,
  normalizeDivisionKey,
  resolveDivisionForLocation,
} from '../data/bangladeshRegions.ts';
import {
  containsUnsafeViolenceTerm,
  parseBengaliPreferenceQuery,
  VIOLENCE_SAFETY_MESSAGE_BN,
} from '../data/bookingCategories.ts';

function getCompanionDivision(cmp: CompanionProfile): string {
  const fromField = normalizeDivisionKey(cmp.division);
  if (fromField) return fromField;
  const fromCity = resolveDivisionForLocation(cmp.city);
  if (fromCity) return fromCity;
  for (const area of cmp.areas || []) {
    const fromArea = resolveDivisionForLocation(area);
    if (fromArea) return fromArea;
  }
  return 'Dhaka';
}

function matchesCityOrAlias(value: string, query: string): boolean {
  const v = value.toLowerCase();
  const q = query.toLowerCase();
  if (v.includes(q)) return true;
  if (q === 'chittagong' && v.includes('chattogram')) return true;
  if (q === 'chattogram' && v.includes('chittagong')) return true;
  if (q === 'barisal' && v.includes('barishal')) return true;
  if (q === 'barishal' && v.includes('barisal')) return true;
  return false;
}

export const marketplaceRouter = Router();
marketplaceRouter.use(attachAuthIfPresent);

// Public companion directory with Bangladesh Division, district/area, and Smart Bangla Preference + Rate filtering
marketplaceRouter.get('/companions', async (req: AuthenticatedRequest, res) => {
  try {
    const divisionRaw = sanitizeString(req.query.division, 80);
    const targetDivision = normalizeDivisionKey(divisionRaw);
    const city = sanitizeString(req.query.city, 80).toLowerCase();
    const category = sanitizeString(req.query.category, 120).toLowerCase();
    const language = sanitizeString(req.query.language, 60).toLowerCase();
    const q = sanitizeString(req.query.q, 120).toLowerCase();
    const preference = sanitizeString(req.query.preference, 300);
    const parsedPref = parseBengaliPreferenceQuery(preference);
    const sort = sanitizeString(req.query.sort || 'top', 40).toLowerCase();
    const top100 = req.query.top100 === 'true';
    const minRating = Number(req.query.minRating || 0);
    const maxPrice = Number(req.query.maxPrice || 0);
    const availableOnly = req.query.availableOnly === 'true';
    const verifiedOnly = req.query.verifiedOnly === 'true';

    if (parsedPref.unsafeViolence || containsUnsafeViolenceTerm(q)) {
      return res.json({
        companions: [],
        safetyNotice: VIOLENCE_SAFETY_MESSAGE_BN,
        matchMeta: parsedPref,
        division: targetDivision || 'All Bangladesh Divisions',
        divisions: BANGLADESH_DIVISIONS.map((d) => ({
          id: d.id,
          label: d.label,
          shortLabel: d.shortLabel,
        })),
      });
    }

    const effectiveDivision =
      targetDivision ||
      (parsedPref.detectedDivision ? normalizeDivisionKey(parsedPref.detectedDivision) : '');
    const effectiveMaxPrice = maxPrice > 0 ? maxPrice : parsedPref.extractedMaxRate || 0;
    const effectiveMinPrice = parsedPref.extractedMinRate || 0;

    let blockedSet = new Set<string>();
    if (req.authUser) {
      const blocksSnap = await adminDb
        .collection('reports')
        .where('reporterUid', '==', req.authUser.uid)
        .where('blockUser', '==', true)
        .get();
      blocksSnap.docs.forEach((d) => blockedSet.add(String(d.data().reportedUid)));
    }

    const snap = await adminDb.collection('companion_profiles').get();
    const allCompanions = snap.docs.map((d) => {
      const cmp = d.data() as CompanionProfile;
      return {
        ...cmp,
        division: getCompanionDivision(cmp),
      };
    });

    // Compute canonical Top 100 rank across directory
    const rankedPool = [...allCompanions].sort((a, b) => {
      const av = a.verificationStatus === 'approved' ? 1 : 0;
      const bv = b.verificationStatus === 'approved' ? 1 : 0;
      if (av !== bv) return bv - av;
      const scoreA = (a.ratingAvg || 0) * 100 + (a.completedBookings || 0) * 1.5;
      const scoreB = (b.ratingAvg || 0) * 100 + (b.completedBookings || 0) * 1.5;
      return scoreB - scoreA;
    });
    const rankMap = new Map<string, number>();
    rankedPool.slice(0, 100).forEach((c, idx) => rankMap.set(c.uid, idx + 1));

    const scoreMap = new Map<string, number>();

    const queryTokens = q
      ? q
          .split(/[\s,+/]+/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    let list = allCompanions
      .map((c) => ({ ...c, topRank: rankMap.get(c.uid) }))
      .filter((c) => {
        if (blockedSet.has(c.uid)) return false;
        if (top100 && !c.topRank) return false;
        if (verifiedOnly && c.verificationStatus !== 'approved') return false;
        if (availableOnly && !c.isAvailableNow) return false;
        if (minRating > 0 && (c.ratingAvg || 0) < minRating) return false;
        if (effectiveMaxPrice > 0) {
          const fitsHourly = (c.hourlyRateBdt || 0) <= effectiveMaxPrice;
          const fitsSession =
            Boolean(parsedPref.extractedMaxRate) &&
            effectiveMaxPrice >= 2500 &&
            (c.sessionRateBdt || 0) <= effectiveMaxPrice;
          if (!fitsHourly && !fitsSession) return false;
        }
        if (effectiveMinPrice > 0 && (c.hourlyRateBdt || 0) < effectiveMinPrice * 0.7) {
          return false;
        }
        if (effectiveDivision) {
          const matchesDivision =
            normalizeDivisionKey(c.division) === effectiveDivision ||
            resolveDivisionForLocation(c.city) === effectiveDivision ||
            (c.areas || []).some((a) => resolveDivisionForLocation(a) === effectiveDivision);
          if (!matchesDivision) return false;
        }
        if (city && city !== 'all' && city !== 'dhaka division' && city !== 'dhaka bibhag') {
          const matchCity = matchesCityOrAlias(c.city || '', city);
          const matchArea = (c.areas || []).some((a) => matchesCityOrAlias(a, city));
          const matchDiv = matchesCityOrAlias(c.division || '', city);
          if (!matchCity && !matchArea && !matchDiv) return false;
        }
        if (category && category !== 'all') {
          const catParts = category
            .replace(/[()/,]/g, ' ')
            .split(/\s+/)
            .filter((p) => p.length >= 2);
          const hayCat = `${(c.categories || []).join(' ')} ${(c.interests || []).join(' ')} ${(c.skills || []).join(' ')} ${c.headline || ''} ${c.bio || ''}`.toLowerCase();
          const directMatch = (c.categories || []).some((cat) => cat.toLowerCase().includes(category));
          const fuzzyCatMatch =
            catParts.length > 0 && catParts.some((part) => hayCat.includes(part));
          if (!directMatch && !fuzzyCatMatch) return false;
        }
        if (language && language !== 'all') {
          const matchLang = (c.languages || []).some((l) => l.toLowerCase().includes(language));
          if (!matchLang) return false;
        }

        let totalScore = 0;

        if (queryTokens.length > 0) {
          const nameHay = (c.displayName || '').toLowerCase();
          const skillsInterestsHay = `${(c.skills || []).join(' ')} ${(c.interests || []).join(' ')} ${(c.categories || []).join(' ')}`.toLowerCase();
          const headlineHay = (c.headline || '').toLowerCase();
          const locationLangHay = `${c.division || ''} ${c.city} ${(c.areas || []).join(' ')} ${(c.languages || []).join(' ')}`.toLowerCase();
          const bioHay = (c.bio || '').toLowerCase();
          const fullHay = `${nameHay} ${skillsInterestsHay} ${headlineHay} ${locationLangHay} ${bioHay}`;

          const matchesAllTokens = queryTokens.every((token) => fullHay.includes(token));
          if (!matchesAllTokens) return false;

          if (nameHay.includes(q)) totalScore += 15;
          for (const token of queryTokens) {
            if (nameHay.includes(token)) totalScore += 8;
            if (skillsInterestsHay.includes(token)) totalScore += 6;
            if (headlineHay.includes(token)) totalScore += 4;
            if (locationLangHay.includes(token)) totalScore += 3;
            if (bioHay.includes(token)) totalScore += 2;
          }
        }

        if (preference) {
          let prefScore = 0;
          const hayAll = `${c.displayName} ${c.headline} ${c.bio} ${c.division || ''} ${c.city} ${(c.areas || []).join(' ')} ${(c.categories || []).join(' ')} ${(c.interests || []).join(' ')} ${(c.skills || []).join(' ')}`.toLowerCase();
          const catText = `${(c.categories || []).join(' ')} ${(c.interests || []).join(' ')} ${(c.skills || []).join(' ')} ${c.headline}`.toLowerCase();
          for (const token of parsedPref.searchTokens) {
            if (catText.includes(token)) prefScore += 3;
            else if (hayAll.includes(token)) prefScore += 1.5;
          }
          const isBhai = /\(bhai\)|\bbhai\b|\bbrother\b/i.test(
            `${c.displayName} ${(c.categories || []).join(' ')}`
          );
          if (parsedPref.preferredGender === 'female') {
            if (c.gender === 'female' || (!c.gender && !isBhai)) prefScore += 12;
            else if (c.gender === 'male') prefScore -= 6;
          }
          if (parsedPref.preferredGender === 'male') {
            if (c.gender === 'male' || (!c.gender && isBhai)) prefScore += 12;
            else if (c.gender === 'female') prefScore -= 6;
          }
          if (parsedPref.extractedTargetRate) {
            const diff = Math.abs((c.hourlyRateBdt || 0) - parsedPref.extractedTargetRate);
            prefScore += Math.max(0, 4 - diff / 400);
          }
          totalScore += prefScore;
        }

        if (totalScore > 0) {
          scoreMap.set(c.uid, totalScore);
        }
        return true;
      });

    if ((preference || queryTokens.length > 0) && sort === 'top') {
      list.sort((a, b) => {
        const diff = (scoreMap.get(b.uid) || 0) - (scoreMap.get(a.uid) || 0);
        if (Math.abs(diff) > 0.25) return diff;
        return (a.topRank || 999) - (b.topRank || 999);
      });
    } else if (sort === 'price_asc') {
      list.sort((a, b) => (a.hourlyRateBdt || 0) - (b.hourlyRateBdt || 0));
    } else if (sort === 'price_desc') {
      list.sort((a, b) => (b.hourlyRateBdt || 0) - (a.hourlyRateBdt || 0));
    } else if (sort === 'rating') {
      list.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
    } else if (sort === 'completed') {
      list.sort((a, b) => (b.completedBookings || 0) - (a.completedBookings || 0));
    } else {
      list.sort((a, b) => (a.topRank || 999) - (b.topRank || 999));
    }

    if (top100) {
      list = list.slice(0, 100);
    }

    res.json({
      companions: list,
      matchedKeywords: queryTokens,
      matchMeta: preference ? parsedPref : undefined,
      division: effectiveDivision || 'All Bangladesh Divisions',
      divisions: BANGLADESH_DIVISIONS.map((d) => ({
        id: d.id,
        label: d.label,
        shortLabel: d.shortLabel,
      })),
    });
  } catch (err) {
    console.error('List companions error:', err);
    res.status(500).json({ error: 'Unable to load companion directory.' });
  }
});

// Single companion profile + verified reviews
marketplaceRouter.get('/companions/:uid', async (req, res) => {
  try {
    const uid = sanitizeId(req.params.uid);
    if (!uid) return res.status(400).json({ error: 'Invalid companion ID.' });

    const [cmpSnap, revSnap] = await Promise.all([
      adminDb.collection('companion_profiles').doc(uid).get(),
      adminDb.collection('reviews').where('companionUid', '==', uid).get(),
    ]);

    if (!cmpSnap.exists) {
      return res.status(404).json({ error: 'Companion profile not found.' });
    }

    const reviews = revSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    res.json({ companion: cmpSnap.data(), reviews });
  } catch (err) {
    console.error('Companion detail error:', err);
    res.status(500).json({ error: 'Unable to fetch companion profile.' });
  }
});

// Update personal customer profile
marketplaceRouter.put('/customer/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const fullName = sanitizeString(req.body?.fullName || req.authUser!.fullName, 120);
    const city = sanitizeString(req.body?.city || 'Dhaka', 80);
    if (!isKnownBangladeshLocation(city)) {
      return res.status(400).json({
        error: 'Please select a valid district or city within Bangladesh.',
      });
    }
    const area = sanitizeString(req.body?.area || '', 80);
    const bio = sanitizeString(req.body?.bio || '', 600);
    let photoUrl = req.authUser!.photoUrl || '';
    if (req.body?.photoUrl !== undefined) {
      const cleanPhoto = sanitizePhotoData(req.body.photoUrl);
      if (cleanPhoto === null) {
        return res.status(400).json({ error: 'Invalid photo format or size too large (max ~330 KB after compression).' });
      }
      photoUrl = cleanPhoto;
    }
    const emergencyContactName = sanitizeString(req.body?.emergencyContactName || '', 120);
    const emergencyContactPhone = sanitizeString(req.body?.emergencyContactPhone || '', 30);
    const now = new Date().toISOString();

    await Promise.all([
      adminDb.collection('users').doc(uid).update({
        fullName,
        city,
        area,
        photoUrl,
        profileCompleted: true,
        profileUpdatedAt: now,
      }),
      adminDb.collection('customer_profiles').doc(uid).set(
        {
          uid,
          city,
          area,
          bio,
          emergencyContactName,
          emergencyContactPhone,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);

    res.json({ updated: true });
  } catch (err) {
    console.error('Customer profile update error:', err);
    res.status(500).json({ error: 'Unable to update customer profile.' });
  }
});

// Update companion profile (companions control own pricing, availability, bio, categories, locations)
// Strictly forbids tampering with verificationStatus, ratings, or balances
marketplaceRouter.put('/companion/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const now = new Date().toISOString();
    const existingSnap = await adminDb.collection('companion_profiles').doc(uid).get();
    const existing = existingSnap.exists ? existingSnap.data()! : null;

    const displayName = sanitizeString(req.body?.displayName || req.authUser!.fullName, 120);
    const headline = sanitizeString(req.body?.headline || 'সামাজিক সঙ্গী', 160);
    const bio = sanitizeString(req.body?.bio || '', 1500);
    if (containsUnsafeViolenceTerm(headline) || containsUnsafeViolenceTerm(bio)) {
      return res.status(400).json({ error: VIOLENCE_SAFETY_MESSAGE_BN });
    }
    const city = sanitizeString(req.body?.city || 'Dhaka', 80);
    if (!isKnownBangladeshLocation(city)) {
      return res.status(400).json({
        error: 'দয়া করে বাংলাদেশের একটি সঠিক জেলা বা এলাকা নির্বাচন করুন।',
      });
    }
    const division =
      normalizeDivisionKey(req.body?.division) || resolveDivisionForLocation(city) || 'Dhaka';
    const areas = Array.isArray(req.body?.areas)
      ? req.body.areas.slice(0, 10).map((a: unknown) => sanitizeString(a, 60)).filter(Boolean)
      : ['Gulshan'];
    const languages = Array.isArray(req.body?.languages)
      ? req.body.languages.slice(0, 8).map((l: unknown) => sanitizeString(l, 40)).filter(Boolean)
      : ['Bengali', 'English'];
    const rawCategories = Array.isArray(req.body?.categories)
      ? req.body.categories.slice(0, 12).map((c: unknown) => sanitizeString(c, 120)).filter(Boolean)
      : ['চা ও সিগারেট ব্রেক আড্ডা'];
    if (rawCategories.some((c: string) => containsUnsafeViolenceTerm(c))) {
      return res.status(400).json({ error: VIOLENCE_SAFETY_MESSAGE_BN });
    }
    const categories = rawCategories;
    const rawInterests = Array.isArray(req.body?.interests)
      ? req.body.interests.slice(0, 12).map((i: unknown) => sanitizeString(i, 80)).filter(Boolean)
      : Array.isArray(existing?.interests)
        ? existing.interests
        : [];
    const rawSkills = Array.isArray(req.body?.skills)
      ? req.body.skills.slice(0, 12).map((s: unknown) => sanitizeString(s, 80)).filter(Boolean)
      : Array.isArray(existing?.skills)
        ? existing.skills
        : [];
    if (
      rawInterests.some((i: string) => containsUnsafeViolenceTerm(i)) ||
      rawSkills.some((s: string) => containsUnsafeViolenceTerm(s))
    ) {
      return res.status(400).json({ error: VIOLENCE_SAFETY_MESSAGE_BN });
    }

    const hourlyRateBdt = Math.max(500, Math.min(50000, Number(req.body?.hourlyRateBdt || 1500)));
    const sessionRateBdt = Math.max(1000, Math.min(150000, Number(req.body?.sessionRateBdt || 4000)));
    const availabilityDays = Array.isArray(req.body?.availabilityDays)
      ? req.body.availabilityDays.slice(0, 7).map((d: unknown) => sanitizeString(d, 10)).filter(Boolean)
      : ['Fri', 'Sat'];
    const availabilityHours = sanitizeString(req.body?.availabilityHours || '10:00 AM – 9:00 PM', 80);
    const isAvailableNow = Boolean(req.body?.isAvailableNow);
    let photoUrl = existing?.photoUrl || req.authUser!.photoUrl || '';
    if (req.body?.photoUrl !== undefined) {
      const cleanPhoto = sanitizePhotoData(req.body.photoUrl);
      if (cleanPhoto === null) {
        return res.status(400).json({ error: 'Invalid photo format or size too large (max ~330 KB after compression).' });
      }
      photoUrl = cleanPhoto;
    }
    const instagramHandle = sanitizeString(
      req.body?.instagramHandle ?? existing?.instagramHandle ?? '',
      160
    );
    const whatsappNumber = sanitizeString(
      req.body?.whatsappNumber ?? existing?.whatsappNumber ?? '',
      40
    );
    const contactEmail = sanitizeString(
      req.body?.contactEmail ?? existing?.contactEmail ?? req.authUser!.email ?? '',
      160
    ).toLowerCase();

    const cleanGender: 'male' | 'female' | undefined =
      req.body?.gender === 'female'
        ? 'female'
        : req.body?.gender === 'male'
          ? 'male'
          : existing?.gender || req.authUser!.gender;

    const payload: CompanionProfile = {
      uid,
      displayName,
      headline,
      bio,
      city,
      division,
      ...(cleanGender ? { gender: cleanGender } : {}),
      areas,
      languages,
      categories,
      interests: rawInterests,
      skills: rawSkills,
      hourlyRateBdt,
      sessionRateBdt,
      availabilityDays,
      availabilityHours,
      isAvailableNow,
      verificationStatus: existing?.verificationStatus || 'unverified',
      ratingAvg: existing?.ratingAvg || 0,
      reviewCount: existing?.reviewCount || 0,
      completedBookings: existing?.completedBookings || 0,
      pendingBalanceBdt: existing?.pendingBalanceBdt || 0,
      availableBalanceBdt: existing?.availableBalanceBdt || 0,
      photoUrl,
      instagramHandle,
      whatsappNumber,
      contactEmail,
      updatedAt: now,
    };

    await adminDb.collection('companion_profiles').doc(uid).set(payload, { merge: true });
    if (req.authUser!.role === 'customer') {
      await adminDb.collection('users').doc(uid).update({
        role: 'companion',
        fullName: displayName,
        photoUrl,
        profileCompleted: true,
        profileUpdatedAt: now,
        ...(cleanGender ? { gender: cleanGender } : {}),
      });
    } else {
      await adminDb.collection('users').doc(uid).update({
        fullName: displayName,
        photoUrl,
        profileCompleted: true,
        profileUpdatedAt: now,
        ...(cleanGender ? { gender: cleanGender } : {}),
      });
    }

    res.json({ companionProfile: payload });
  } catch (err) {
    console.error('Companion profile update error:', err);
    res.status(500).json({ error: 'Unable to save companion profile.' });
  }
});

// Submit 18+ Identity Verification Request (for Verification Admin review)
marketplaceRouter.post(
  '/verifications',
  requireAuth,
  requireProfileUnlocked,
  async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { documentType, documentNumber, dateOfBirth, city } = req.body || {};

    if (!['nid', 'school_roll', 'student_id', 'passport', 'driving_license'].includes(documentType)) {
      return res.status(400).json({
        error: 'সঠিক ডকুমেন্ট ধরন দিন: NID, স্কুল রোল (School Roll), Student ID, Passport অথবা Driving License।',
      });
    }
    const trimmedDocNum = String(documentNumber || '').trim();
    const minLen = documentType === 'school_roll' || documentType === 'student_id' ? 1 : 4;
    if (!trimmedDocNum || trimmedDocNum.length < minLen) {
      return res.status(400).json({
        error:
          documentType === 'school_roll' || documentType === 'student_id'
            ? 'সঠিক স্কুল রোল / স্টুডেন্ট আইডি নম্বর দিন।'
            : 'সঠিক ডকুমেন্ট নম্বর দিন (কমপক্ষে ৪ অক্ষর)।',
      });
    }
    const age = calculateAgeFromDob(String(dateOfBirth || ''));
    if (age < 18) {
      return res.status(403).json({
        error: 'Age Verification Failed: Only adults aged 18+ can be verified on LOGEASI.COM.',
      });
    }

    const id = `VER_${uid}_${Date.now()}`;
    const now = new Date().toISOString();
    const record = {
      id,
      uid,
      fullName: req.authUser!.fullName,
      documentType,
      documentNumberMasked: maskDocumentNumber(String(documentNumber)),
      dateOfBirth: String(dateOfBirth),
      calculatedAge: age,
      city: sanitizeString(city || req.authUser!.city || 'Dhaka', 80),
      status: 'pending',
      reviewerNote: '',
      reviewedByUid: '',
      createdAt: now,
    };

    await adminDb.collection('verification_requests').doc(id).set(record);
    const cmpSnap = await adminDb.collection('companion_profiles').doc(uid).get();
    if (cmpSnap.exists) {
      await cmpSnap.ref.update({ verificationStatus: 'pending', updatedAt: now });
    }

    await writeAuditLog({
      actorUid: uid,
      actorRole: req.authUser!.role,
      action: 'VERIFICATION_SUBMITTED',
      targetType: 'verification_request',
      targetId: id,
      details: `${documentType.toUpperCase()} verification submitted (age ${age}).`,
      severity: 'info',
    });

    res.status(201).json({ verification: record });
  } catch (err) {
    console.error('Verification submit error:', err);
    res.status(500).json({ error: 'Failed to submit verification request.' });
  }
});

marketplaceRouter.get('/verifications/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb
      .collection('verification_requests')
      .where('uid', '==', req.authUser!.uid)
      .get();
    const list = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ verifications: list });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch verification status.' });
  }
});

// ========================
// UBER-INSPIRED BOOKING SYSTEM
// ========================

marketplaceRouter.post(
  '/bookings',
  requireAuth,
  requireProfileUnlocked,
  async (req: AuthenticatedRequest, res) => {
  try {
    const customerUid = req.authUser!.uid;
    const companionUid = sanitizeId(req.body?.companionUid);
    if (!companionUid || companionUid === customerUid) {
      return res.status(400).json({ error: 'Select a valid companion other than yourself.' });
    }

    const [cmpSnap, settingsSnap, customerUserSnap] = await Promise.all([
      adminDb.collection('companion_profiles').doc(companionUid).get(),
      adminDb.collection('platform_settings').doc('main').get(),
      adminDb.collection('users').doc(customerUid).get(),
    ]);

    if (!cmpSnap.exists) {
      return res.status(404).json({ error: 'Companion not found.' });
    }
    const cmp = cmpSnap.data() as CompanionProfile;
    const feePercent = Number(settingsSnap.data()?.serviceFeePercent ?? 12);
    const availableCredits = Math.max(
      0,
      Math.round(Number(customerUserSnap.data()?.referralCreditsBdt || 0))
    );

    const pricingType = req.body?.pricingType === 'session' ? 'session' : 'hourly';
    const durationHours =
      pricingType === 'session' ? 4 : Math.max(1, Math.min(12, Number(req.body?.durationHours || 2)));
    const baseTotal =
      pricingType === 'session' ? cmp.sessionRateBdt : cmp.hourlyRateBdt * durationHours;

    const originalTotalBdt = Math.max(500, Number(req.body?.proposedTotalBdt || baseTotal));
    const requestedCredits = Math.max(0, Math.floor(Number(req.body?.creditsToApplyBdt || 0)));
    const maxRedeemableCredits = Math.floor(originalTotalBdt * 0.5);
    const creditsUsedBdt = Math.min(requestedCredits, availableCredits, maxRedeemableCredits);
    const netBookingTotalBdt = Math.max(250, originalTotalBdt - creditsUsedBdt);

    const advanceRequiredBdt = Math.round(netBookingTotalBdt / 2);
    const remainingDueBdt = Math.max(0, netBookingTotalBdt - advanceRequiredBdt);
    const platformFeeBdt = Math.round((netBookingTotalBdt * feePercent) / 100);
    const companionNetBdt = netBookingTotalBdt - platformFeeBdt;

    const venueName = sanitizeString(req.body?.venueName, 160);
    const bookingCity = sanitizeString(req.body?.city || cmp.city || 'Dhaka', 80);
    if (!isKnownBangladeshLocation(bookingCity)) {
      return res.status(400).json({
        error: 'Please choose a valid Bangladesh district or city area for the booking.',
      });
    }
    const bookingDivision =
      normalizeDivisionKey(req.body?.division) ||
      resolveDivisionForLocation(bookingCity) ||
      cmp.division ||
      'Dhaka';
    const bookingDate = sanitizeString(req.body?.bookingDate, 20);
    const startTime = sanitizeString(req.body?.startTime, 20);
    if (!venueName || !bookingDate || !startTime) {
      return res.status(400).json({
        error: 'Public venue name, booking date, and start time are required.',
      });
    }

    const bookingCategory = sanitizeString(
      req.body?.category || cmp.categories?.[0] || 'Social Outings',
      120
    );
    const bookingNotes = sanitizeString(req.body?.notes || '', 600);
    if (containsUnsafeViolenceTerm(bookingCategory) || containsUnsafeViolenceTerm(bookingNotes)) {
      return res.status(400).json({ error: VIOLENCE_SAFETY_MESSAGE_BN });
    }

    const id = `BKG_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const bookingCode = `LGS-${crypto.randomInt(100000, 999999)}`;
    const now = new Date().toISOString();

    const booking: BookingRecord = {
      id,
      bookingCode,
      customerUid,
      customerName: req.authUser!.fullName,
      companionUid,
      companionName: cmp.displayName,
      companionPhoto: cmp.photoUrl,
      category: bookingCategory,
      city: bookingCity,
      division: bookingDivision,
      venueName,
      bookingDate,
      startTime,
      pricingType,
      durationHours,
      proposedTotalBdt: netBookingTotalBdt,
      originalTotalBdt,
      creditsUsedBdt,
      agreedPriceBdt: netBookingTotalBdt,
      advanceRequiredBdt,
      advancePaidBdt: 0,
      remainingDueBdt,
      advanceStatus: 'unpaid',
      platformFeeBdt,
      companionNetBdt,
      status: 'requested',
      customerAgreed: true,
      companionAgreed: false,
      paymentStatus: 'unpaid',
      notes: bookingNotes,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('bookings').doc(id).set(booking);

    if (creditsUsedBdt > 0) {
      const nextCreditsBalance = Math.max(0, availableCredits - creditsUsedBdt);
      await adminDb.collection('users').doc(customerUid).update({
        referralCreditsBdt: nextCreditsBalance,
      });
      await recordReferralTransaction({
        userUid: customerUid,
        type: 'redeemed_booking',
        creditsBdt: -creditsUsedBdt,
        balanceAfterBdt: nextCreditsBalance,
        description: `বুকিং ${bookingCode} (${cmp.displayName})-এ রেফারেল ক্রেডিট পয়েন্ট ব্যবহার।`,
        relatedBookingId: id,
        relatedBookingCode: bookingCode,
      });
    }

    await createNotification({
      userUid: companionUid,
      type: 'booking_request',
      title: `New Booking Request (${bookingCode})`,
      message: `${req.authUser!.fullName} requested ${durationHours}h on ${bookingDate} at ${venueName} for BDT ৳${netBookingTotalBdt.toLocaleString()}.`,
      link: '/dashboard/companion',
    });

    res.status(201).json({ booking });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Unable to submit booking request.' });
  }
});

marketplaceRouter.get('/bookings', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const [asCustomer, asCompanion] = await Promise.all([
      adminDb.collection('bookings').where('customerUid', '==', uid).get(),
      adminDb.collection('bookings').where('companionUid', '==', uid).get(),
    ]);

    const map = new Map<string, BookingRecord>();
    asCustomer.docs.forEach((d) => map.set(d.id, d.data() as BookingRecord));
    asCompanion.docs.forEach((d) => map.set(d.id, d.data() as BookingRecord));

    const bookings = Array.from(map.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    res.json({ bookings });
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({ error: 'Unable to fetch bookings.' });
  }
});

marketplaceRouter.get('/bookings/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const snap = await adminDb.collection('bookings').doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = snap.data() as BookingRecord;

    if (
      booking.customerUid !== req.authUser!.uid &&
      booking.companionUid !== req.authUser!.uid &&
      !isAdminRole(req.authUser!.role)
    ) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load booking.' });
  }
});

// Companion accepts or declines booking (and may adjust agreed price proposal)
marketplaceRouter.post('/bookings/:id/respond', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const { decision, counterPriceBdt } = req.body || {};
    const ref = adminDb.collection('bookings').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = snap.data() as BookingRecord;

    if (booking.companionUid !== req.authUser!.uid) {
      return res.status(403).json({ error: 'Only the requested companion can accept or decline.' });
    }
    if (booking.status !== 'requested') {
      return res.status(400).json({ error: 'Booking has already been responded to.' });
    }

    const now = new Date().toISOString();
    if (decision === 'decline') {
      await ref.update({ status: 'declined', updatedAt: now });
      await createNotification({
        userUid: booking.customerUid,
        type: 'booking_declined',
        title: `Booking Declined (${booking.bookingCode})`,
        message: `${booking.companionName} is unavailable for the requested slot.`,
        link: '/bookings',
      });
      return res.json({ status: 'declined' });
    }

    const settingsSnap = await adminDb.collection('platform_settings').doc('main').get();
    const feePercent = Number(settingsSnap.data()?.serviceFeePercent ?? 12);

    const newPrice = counterPriceBdt ? Math.max(500, Number(counterPriceBdt)) : booking.proposedTotalBdt;
    const priceChanged = newPrice !== booking.proposedTotalBdt;
    const platformFeeBdt = Math.round((newPrice * feePercent) / 100);
    const companionNetBdt = newPrice - platformFeeBdt;
    const advanceRequiredBdt = Math.round(newPrice / 2);
    const advancePaidBdt = Number(booking.advancePaidBdt || 0);
    const remainingDueBdt = Math.max(0, newPrice - advancePaidBdt);

    // If companion accepts exact customer price, both parties have agreed
    const customerAgreed = !priceChanged;
    const companionAgreed = true;
    const nextStatus =
      customerAgreed && companionAgreed
        ? booking.advanceStatus === 'paid'
          ? 'confirmed_paid'
          : 'price_agreed_awaiting_payment'
        : 'accepted_awaiting_agreement';

    await ref.update({
      agreedPriceBdt: newPrice,
      advanceRequiredBdt,
      remainingDueBdt,
      platformFeeBdt,
      companionNetBdt,
      customerAgreed,
      companionAgreed,
      status: nextStatus,
      updatedAt: now,
    });

    await createNotification({
      userUid: booking.customerUid,
      type: 'booking_accepted',
      title: `Booking Accepted (${booking.bookingCode})`,
      message: priceChanged
        ? `${booking.companionName} accepted and proposed BDT ৳${newPrice.toLocaleString()}. Confirm final price to proceed to payment.`
        : `${booking.companionName} accepted your booking at BDT ৳${newPrice.toLocaleString()}. Proceed to payment to confirm.`,
      link: priceChanged ? '/bookings' : `/payment/${booking.id}`,
    });

    res.json({ status: nextStatus, agreedPriceBdt: newPrice });
  } catch (err) {
    console.error('Booking respond error:', err);
    res.status(500).json({ error: 'Failed to update booking response.' });
  }
});

// Both parties confirm agreed final price
marketplaceRouter.post('/bookings/:id/agree', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const ref = adminDb.collection('bookings').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = snap.data() as BookingRecord;

    const uid = req.authUser!.uid;
    if (uid !== booking.customerUid && uid !== booking.companionUid) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const customerAgreed = uid === booking.customerUid ? true : booking.customerAgreed;
    const companionAgreed = uid === booking.companionUid ? true : booking.companionAgreed;
    const nextStatus =
      customerAgreed && companionAgreed
        ? booking.advanceStatus === 'paid'
          ? 'confirmed_paid'
          : 'price_agreed_awaiting_payment'
        : booking.status;

    await ref.update({
      customerAgreed,
      companionAgreed,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });

    res.json({ status: nextStatus, customerAgreed, companionAgreed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm price agreement.' });
  }
});

// Complete booking -> releases pending earnings to companion available balance and unlocks reviews
marketplaceRouter.post('/bookings/:id/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const ref = adminDb.collection('bookings').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = snap.data() as BookingRecord;

    const uid = req.authUser!.uid;
    if (uid !== booking.customerUid && uid !== booking.companionUid && !isAdminRole(req.authUser!.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (
      !['confirmed_paid', 'in_progress'].includes(booking.status) &&
      booking.paymentStatus !== 'cash_pending' &&
      booking.advanceStatus !== 'paid'
    ) {
      return res.status(400).json({
        error: 'Booking must have verified payment (or 50% advance / approved cash arrangement) before completion.',
      });
    }

    const now = new Date().toISOString();
    await ref.update({
      status: 'completed',
      paymentStatus: booking.paymentStatus === 'cash_pending' ? 'paid' : booking.paymentStatus,
      updatedAt: now,
    });

    // Release companion net earnings from pending to available
    const cmpRef = adminDb.collection('companion_profiles').doc(booking.companionUid);
    const cmpSnap = await cmpRef.get();
    if (cmpSnap.exists) {
      const cmp = cmpSnap.data()!;
      const pending = Math.max(0, Number(cmp.pendingBalanceBdt || 0) - booking.companionNetBdt);
      const available =
        booking.paymentStatus === 'cash_pending'
          ? Number(cmp.availableBalanceBdt || 0)
          : Number(cmp.availableBalanceBdt || 0) + booking.companionNetBdt;
      await cmpRef.update({
        pendingBalanceBdt: pending,
        availableBalanceBdt: available,
        completedBookings: Number(cmp.completedBookings || 0) + 1,
        updatedAt: now,
      });
    }

    await createNotification({
      userUid: booking.customerUid,
      type: 'booking_completed',
      title: `Session Completed (${booking.bookingCode})`,
      message: `Your booking with ${booking.companionName} is complete. You can now submit a verified review.`,
      link: '/bookings',
    });

    res.json({ status: 'completed' });
  } catch (err) {
    console.error('Complete booking error:', err);
    res.status(500).json({ error: 'Failed to mark booking completed.' });
  }
});

// Cancel booking (creates refund request automatically if paid)
marketplaceRouter.post('/bookings/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const reason = sanitizeString(req.body?.reason || 'Schedule changed', 500);
    const ref = adminDb.collection('bookings').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = snap.data() as BookingRecord;

    const uid = req.authUser!.uid;
    if (uid !== booking.customerUid && uid !== booking.companionUid && !isAdminRole(req.authUser!.role)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking.` });
    }

    const now = new Date().toISOString();
    await ref.update({
      status: 'cancelled',
      cancellationReason: reason,
      updatedAt: now,
    });

    // If paid digitally, automatically file refund request
    if (booking.paymentStatus === 'paid') {
      const paySnap = await adminDb
        .collection('payments')
        .where('bookingId', '==', booking.id)
        .where('status', '==', 'verified_paid')
        .limit(1)
        .get();
      if (!paySnap.empty) {
        const pay = paySnap.docs[0].data();
        const refundId = `RFD_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        await adminDb.collection('refunds').doc(refundId).set({
          id: refundId,
          paymentId: pay.id,
          bookingId: booking.id,
          customerUid: booking.customerUid,
          amountBdt: pay.amountBdt,
          reason: `Booking cancelled: ${reason}`,
          status: 'requested',
          createdAt: now,
        });
      }
    }

    // Refund used referral credits back to customer upon cancellation
    const usedCredits = Math.max(0, Math.round(Number(booking.creditsUsedBdt || 0)));
    if (usedCredits > 0) {
      const custUserRef = adminDb.collection('users').doc(booking.customerUid);
      const custUserSnap = await custUserRef.get();
      if (custUserSnap.exists) {
        const currentCredits = Math.max(0, Math.round(Number(custUserSnap.data()?.referralCreditsBdt || 0)));
        const restoredBalance = currentCredits + usedCredits;
        await custUserRef.update({ referralCreditsBdt: restoredBalance });
        await recordReferralTransaction({
          userUid: booking.customerUid,
          type: 'refunded_booking',
          creditsBdt: usedCredits,
          balanceAfterBdt: restoredBalance,
          description: `বুকিং ${booking.bookingCode} বাতিল হওয়ায় ব্যবহৃত ${usedCredits} ক্রেডিট ফেরত দেওয়া হয়েছে।`,
          relatedBookingId: booking.id,
          relatedBookingCode: booking.bookingCode,
        });
      }
    }

    const otherUid = uid === booking.customerUid ? booking.companionUid : booking.customerUid;
    await createNotification({
      userUid: otherUid,
      type: 'booking_cancelled',
      title: `Booking Cancelled (${booking.bookingCode})`,
      message: `Booking was cancelled. Reason: ${reason}`,
      link: '/bookings',
    });

    res.json({ status: 'cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
});

// Booking messages
marketplaceRouter.get('/bookings/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const bSnap = await adminDb.collection('bookings').doc(id).get();
    if (!bSnap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = bSnap.data() as BookingRecord;
    if (
      booking.customerUid !== req.authUser!.uid &&
      booking.companionUid !== req.authUser!.uid &&
      !isAdminRole(req.authUser!.role)
    ) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const msgSnap = await adminDb
      .collection('booking_messages')
      .where('bookingId', '==', id)
      .get();
    const messages = msgSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch booking messages.' });
  }
});

marketplaceRouter.post(
  '/bookings/:id/messages',
  requireAuth,
  requireProfileUnlocked,
  async (req: AuthenticatedRequest, res) => {
  try {
    const id = sanitizeId(req.params.id);
    const body = sanitizeString(req.body?.body, 1000);
    if (!body) return res.status(400).json({ error: 'Message text is required.' });

    const bSnap = await adminDb.collection('bookings').doc(id).get();
    if (!bSnap.exists) return res.status(404).json({ error: 'Booking not found.' });
    const booking = bSnap.data() as BookingRecord;
    if (booking.customerUid !== req.authUser!.uid && booking.companionUid !== req.authUser!.uid) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const msgId = `MSG_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const msg = {
      id: msgId,
      bookingId: id,
      senderUid: req.authUser!.uid,
      senderName: req.authUser!.fullName,
      body,
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection('booking_messages').doc(msgId).set(msg);

    const otherUid =
      req.authUser!.uid === booking.customerUid ? booking.companionUid : booking.customerUid;
    await createNotification({
      userUid: otherUid,
      type: 'booking_message',
      title: `New message on ${booking.bookingCode}`,
      message: `${req.authUser!.fullName}: ${body.slice(0, 80)}`,
      link: '/bookings',
    });

    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// Customer & Companion reviews lookup
marketplaceRouter.get('/reviews/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const [writtenSnap, receivedSnap] = await Promise.all([
      adminDb.collection('reviews').where('customerUid', '==', uid).get(),
      adminDb.collection('reviews').where('companionUid', '==', uid).get(),
    ]);

    const sortDesc = (a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    const reviews = writtenSnap.docs.map((d) => d.data()).sort(sortDesc);
    const reviewsReceived = receivedSnap.docs.map((d) => d.data()).sort(sortDesc);

    res.json({ reviews, reviewsReceived });
  } catch (err) {
    console.error('Get my reviews error:', err);
    res.status(500).json({ error: 'রিভিউ তথ্য লোড করা যায়নি।' });
  }
});

// Submit review ONLY for completed booking
marketplaceRouter.post('/reviews', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const bookingId = sanitizeId(req.body?.bookingId);
    const rawRating = Number(req.body?.rating);
    if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) {
      return res.status(400).json({ error: 'দয়া করে ১ থেকে ৫ এর মধ্যে সঠিক স্টার রেটিং নির্বাচন করুন।' });
    }
    const rating = Math.round(rawRating);
    const comment = sanitizeString(req.body?.comment, 800);
    if (!comment || comment.length < 3) {
      return res.status(400).json({ error: 'আপনার অভিজ্ঞতা সম্পর্কে অন্তত কয়েকটি শব্দ লিখুন।' });
    }

    const rawTags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const tags = Array.from(
      new Set<string>(
        rawTags
          .map((t: unknown) => sanitizeString(t, 40))
          .filter((t: string) => t.length > 0)
      )
    ).slice(0, 5);

    const bSnap = await adminDb.collection('bookings').doc(bookingId).get();
    if (!bSnap.exists) return res.status(404).json({ error: 'বুকিং খুঁজে পাওয়া যায়নি।' });
    const booking = bSnap.data() as BookingRecord;

    if (booking.customerUid !== req.authUser!.uid) {
      return res.status(403).json({ error: 'শুধুমাত্র এই বুকিংয়ের কাস্টমার রিভিউ দিতে পারবেন।' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'শুধুমাত্র সম্পন্ন হওয়া (Completed) বুকিংয়ের পর রিভিউ দেওয়া যায়।' });
    }

    const dupSnap = await adminDb
      .collection('reviews')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return res.status(409).json({ error: 'আপনি ইতিমধ্যেই এই বুকিংয়ের জন্য রিভিউ দিয়েছেন।' });
    }

    const revId = `REV_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const review = {
      id: revId,
      bookingId,
      bookingCode: booking.bookingCode || '',
      category: booking.category || '',
      customerUid: booking.customerUid,
      companionUid: booking.companionUid,
      companionName: booking.companionName || '',
      customerName: req.authUser!.fullName,
      rating,
      comment,
      tags,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('reviews').doc(revId).set(review);

    // Recompute companion rating average
    const allRevSnap = await adminDb
      .collection('reviews')
      .where('companionUid', '==', booking.companionUid)
      .get();
    const ratings = allRevSnap.docs.map((d) => Number(d.data().rating || 5));
    const avg = ratings.reduce((s, r) => s + r, 0) / Math.max(1, ratings.length);
    await adminDb.collection('companion_profiles').doc(booking.companionUid).update({
      ratingAvg: Number(avg.toFixed(2)),
      reviewCount: ratings.length,
    });

    await createNotification({
      userUid: booking.companionUid,
      type: 'review_received',
      title: `নতুন ${rating}★ রিভিউ পেয়েছেন (${booking.bookingCode})`,
      message: `${req.authUser!.fullName} আপনার সম্পর্কে "${comment.slice(0, 70)}${comment.length > 70 ? '...' : ''}" রিভিউ দিয়েছেন।`,
      link: `/companions/${booking.companionUid}`,
    });

    res.status(201).json({ review });
  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ error: 'রিভিউ সংরক্ষণ করা যায়নি।' });
  }
});

// Support Tickets
marketplaceRouter.post('/support/tickets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const category = req.body?.category || 'account_help';
    const subject = sanitizeString(req.body?.subject, 180);
    const description = sanitizeString(req.body?.description, 2000);
    const bookingId = sanitizeId(req.body?.bookingId || '');

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required.' });
    }

    const id = `TKT_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const ticket = {
      id,
      ticketCode: `SUP-${crypto.randomInt(10000, 99999)}`,
      userUid: req.authUser!.uid,
      userName: req.authUser!.fullName,
      bookingId,
      category,
      subject,
      description,
      status: 'open',
      adminReply: '',
      assignedAdminUid: '',
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection('support_tickets').doc(id).set(ticket);

    if (category === 'booking_dispute' && bookingId) {
      await adminDb.collection('bookings').doc(bookingId).update({
        status: 'disputed',
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    res.status(201).json({ ticket });
  } catch (err) {
    res.status(500).json({ error: 'Unable to create support ticket.' });
  }
});

marketplaceRouter.get('/support/tickets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb
      .collection('support_tickets')
      .where('userUid', '==', req.authUser!.uid)
      .get();
    const tickets = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load support tickets.' });
  }
});

// Report & Block User
marketplaceRouter.post('/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reportedUid = sanitizeId(req.body?.reportedUid);
    const reason = sanitizeString(req.body?.reason, 800);
    const blockUser = Boolean(req.body?.blockUser);
    if (!reportedUid || !reason) {
      return res.status(400).json({ error: 'Target user and reason are required.' });
    }

    const id = `RPT_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const report = {
      id,
      reporterUid: req.authUser!.uid,
      reportedUid,
      blockUser,
      reason,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    await adminDb.collection('reports').doc(id).set(report);

    await writeAuditLog({
      actorUid: req.authUser!.uid,
      actorRole: req.authUser!.role,
      action: blockUser ? 'USER_REPORTED_AND_BLOCKED' : 'USER_REPORTED',
      targetType: 'user',
      targetId: reportedUid,
      details: reason,
      severity: 'warning',
    });

    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit safety report.' });
  }
});

marketplaceRouter.get('/reports/blocked', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb
      .collection('reports')
      .where('reporterUid', '==', req.authUser!.uid)
      .where('blockUser', '==', true)
      .get();
    res.json({ blocked: snap.docs.map((d) => d.data()) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blocked users.' });
  }
});

// Notifications
marketplaceRouter.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb
      .collection('notifications')
      .where('userUid', '==', req.authUser!.uid)
      .get();
    const notifications = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 40);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch notifications.' });
  }
});

marketplaceRouter.post('/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const snap = await adminDb
      .collection('notifications')
      .where('userUid', '==', req.authUser!.uid)
      .where('read', '==', false)
      .get();
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ updated: snap.size });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

// ========================
// USER REFERRAL & CREDITS SYSTEM
// ========================

marketplaceRouter.get('/referrals/validate', async (req, res) => {
  try {
    const code = sanitizeString(req.query.code, 32).trim().toUpperCase();
    if (!code) {
      return res.json({ valid: false, signupBonusCredits: REFERRED_WELCOME_CREDITS });
    }
    const referrer = await findUserByReferralCode(code);
    if (!referrer) {
      return res.json({ valid: false, signupBonusCredits: REFERRED_WELCOME_CREDITS });
    }
    res.json({
      valid: true,
      referralCode: referrer.referralCode,
      referrerName: referrer.fullName,
      signupBonusCredits: REFERRED_WELCOME_CREDITS,
      referrerBonusCredits: REFERRER_BONUS_CREDITS,
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to validate referral code.' });
  }
});

marketplaceRouter.get('/referrals/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const refMeta = await ensureUserReferralCode(req.authUser!);

    const [refsSnap, txSnap] = await Promise.all([
      adminDb.collection('referrals').where('referrerUid', '==', uid).get(),
      adminDb.collection('referral_transactions').where('userUid', '==', uid).get(),
    ]);

    const referrals = refsSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const transactions = txSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    res.json({
      referralCode: refMeta.referralCode,
      referralCreditsBdt: refMeta.referralCreditsBdt,
      referralCount: refMeta.referralCount || referrals.length,
      referrerBonusCredits: REFERRER_BONUS_CREDITS,
      signupBonusCredits: REFERRED_WELCOME_CREDITS,
      referrals,
      transactions,
    });
  } catch (err) {
    console.error('Get referrals error:', err);
    res.status(500).json({ error: 'Unable to load referral details.' });
  }
});
