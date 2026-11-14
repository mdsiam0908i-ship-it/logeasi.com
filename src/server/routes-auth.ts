import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { adminAuth, adminDb } from '../lib/firebase-admin.ts';
import {
  attachAuthIfPresent,
  rateLimitMiddleware,
  requireAuth,
  type AuthenticatedRequest,
} from './middleware.ts';
import {
  createNotification,
  getRootLockUid,
  isAdminRole,
  writeAuditLog,
} from './rbac.ts';
import { DEFAULT_BENGALI_BOOKING_CATEGORIES } from '../data/bookingCategories.ts';
import {
  RUNTIME_ROOT_SETUP_TOKEN,
  calculateAgeFromDob,
  decryptSensitive,
  encryptSensitive,
  generateTotpSecret,
  hashOtp,
  hashPassword,
  sanitizePhotoData,
  sanitizeString,
  signSessionToken,
  verifyPassword,
  verifyTotpCode,
} from './security.ts';
import type { UserAccount } from '../types/logeasi.ts';
import {
  isKnownBangladeshLocation,
  normalizeDivisionKey,
  resolveDivisionForLocation,
} from '../data/bangladeshRegions.ts';

export const authRouter = Router();

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return (
    req.secure ||
    proto.includes('https') ||
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.APP_URL?.startsWith('https://'))
  );
}

function setSessionCookie(req: Request, res: Response, uid: string, email: string, role: string): string {
  const token = signSessionToken({ uid, email, role });
  const isHttps = isHttpsRequest(req);
  res.cookie('logeasi_session', token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });
  return token;
}

authRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'LOGEASI.COM', timestamp: new Date().toISOString() });
});

authRouter.get('/platform/public', async (_req, res) => {
  try {
    const [settingsSnap, rootLockUid] = await Promise.all([
      adminDb.collection('platform_settings').doc('main').get(),
      getRootLockUid(),
    ]);
    const data = settingsSnap.data() || {};
    res.json({
      serviceFeePercent: data.serviceFeePercent ?? 12,
      paymentMode: data.paymentMode ?? 'sandbox',
      merchantApproved: Boolean(data.merchantApproved),
      cashPaymentEnabled: Boolean(data.cashPaymentEnabled ?? true),
      maxCashBookingBdt: data.maxCashBookingBdt ?? 3000,
      bkashPersonalNumber: data.bkashPersonalNumber || '01700-000000',
      nagadPersonalNumber: data.nagadPersonalNumber || '01877pokpok',
      allowedDivision: data.allowedDivision || 'All Bangladesh Divisions',
      announcementBanner: data.announcementBanner || '',
      safetyNotice: data.safetyNotice || '',
      featuredHeadline: data.featuredHeadline || '',
      bookingCategories:
        Array.isArray(data.bookingCategories) && data.bookingCategories.length > 0
          ? data.bookingCategories
          : DEFAULT_BENGALI_BOOKING_CATEGORIES,
      rootInitialized: Boolean(rootLockUid),
    });
  } catch (err) {
    console.error('Public platform fetch error:', err);
    res.status(500).json({ error: 'Unable to load platform configuration.' });
  }
});

authRouter.get('/auth/me', attachAuthIfPresent, async (req: AuthenticatedRequest, res) => {
  if (!req.authUser) {
    return res.json({ user: null });
  }
  try {
    let customerProfile = null;
    let companionProfile = null;
    const [custSnap, cmpSnap] = await Promise.all([
      adminDb.collection('customer_profiles').doc(req.authUser.uid).get(),
      adminDb.collection('companion_profiles').doc(req.authUser.uid).get(),
    ]);
    if (custSnap.exists) customerProfile = custSnap.data();
    if (cmpSnap.exists) companionProfile = cmpSnap.data();

    res.json({
      user: req.authUser,
      customerProfile,
      companionProfile,
    });
  } catch (err) {
    console.error('Profile hydration error:', err);
    res.status(500).json({ error: 'Unable to load user profile.' });
  }
});

// Continue with Google (Firebase ID Token verification)
authRouter.post(
  '/auth/google',
  rateLimitMiddleware(25, 60_000, 'auth_google'),
  async (req, res) => {
    try {
      const { idToken, intendedRole, dateOfBirth, totpCode } = req.body || {};
      if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({ error: 'Missing Google authentication token.' });
      }

      const decoded = await adminAuth.verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = (decoded.email || '').toLowerCase();
      const fullName = sanitizeString(decoded.name || email.split('@')[0] || 'LOGEASI User', 120);
      const photoUrl = sanitizeString(decoded.picture || '', 500);

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      const now = new Date().toISOString();

      // Check if ROOT_ADMIN_EMAIL is configured in env and matches first-time root bootstrap
      const envRootEmail = (process.env.ROOT_ADMIN_EMAIL || '').trim().toLowerCase();
      const rootLockUid = await getRootLockUid();

      if (!userSnap.exists) {
        // New user registration via Google
        const safeRole = intendedRole === 'companion' ? 'companion' : 'customer';

        if (dateOfBirth) {
          const age = calculateAgeFromDob(String(dateOfBirth));
          if (age < 18) {
            return res.status(403).json({
              error: 'Eligibility Error: Only verified adults aged 18+ may register on LOGEASI.COM.',
            });
          }
        }

        // Check if this Google user matches pre-provisioned admin email
        const matchingAdmins = email
          ? await adminDb.collection('admin_accounts').where('email', '==', email).limit(1).get()
          : null;

        let assignedRole = safeRole;
        if (!rootLockUid && envRootEmail && email === envRootEmail && decoded.email_verified) {
          assignedRole = 'root_super_admin';
          await adminDb.collection('platform_settings').doc('root_lock').set({
            key: 'root_lock',
            rootAdminUid: uid,
            createdAt: now,
          });
          await adminDb.collection('platform_settings').doc('main').set(
            { rootAdminUid: uid, updatedAt: now },
            { merge: true }
          );
          await adminDb.collection('admin_accounts').doc(uid).set({
            uid,
            adminId: 'ADM-ROOT-0001',
            email,
            phone: '',
            fullName,
            role: 'root_super_admin',
            isRootOwner: true,
            status: 'active',
            createdByUid: 'env_bootstrap',
            createdAt: now,
          });
          await writeAuditLog({
            actorUid: uid,
            actorRole: 'root_super_admin',
            action: 'ROOT_SUPER_ADMIN_INITIALIZED',
            targetType: 'admin_account',
            targetId: uid,
            details: `Permanent Root Super Admin bound via ROOT_ADMIN_EMAIL (${email}).`,
            severity: 'critical',
          });
        } else if (matchingAdmins && !matchingAdmins.empty) {
          const preAdmin = matchingAdmins.docs[0].data();
          assignedRole = preAdmin.role;
          // Bind pre-invited admin to their authenticated Firebase UID
          await adminDb.collection('admin_accounts').doc(uid).set({
            ...preAdmin,
            uid,
            email,
            fullName: preAdmin.fullName || fullName,
          });
          if (matchingAdmins.docs[0].id !== uid) {
            await matchingAdmins.docs[0].ref.delete();
          }
        }

        const newUser: UserAccount = {
          uid,
          email,
          phone: '',
          fullName,
          role: assignedRole as UserAccount['role'],
          isAdultVerified18Plus: true,
          phoneVerified: false,
          emailVerified: Boolean(decoded.email_verified),
          twoFactorEnabled: false,
          status: 'active',
          photoUrl,
          city: 'Dhaka',
          createdAt: now,
        };

        await userRef.set(newUser);
        await adminDb.collection('users').doc(uid).collection('private').doc('security').set({
          uid,
          dateOfBirth: dateOfBirth ? encryptSensitive(String(dateOfBirth)) : '',
          failedLoginAttempts: 0,
          lastLoginAt: now,
        });

        if (assignedRole === 'customer') {
          await adminDb.collection('customer_profiles').doc(uid).set({
            uid,
            city: 'Dhaka',
            area: 'Gulshan',
            bio: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
            updatedAt: now,
          });
        } else if (assignedRole === 'companion') {
          await adminDb.collection('companion_profiles').doc(uid).set({
            uid,
            displayName: fullName,
            headline: 'New Companion Applicant · Pending Identity Verification',
            bio: '',
            city: 'Dhaka',
            division: 'Dhaka',
            areas: ['Gulshan'],
            languages: ['Bengali', 'English'],
            categories: ['Dining & Coffee'],
            hourlyRateBdt: 1500,
            sessionRateBdt: 4000,
            availabilityDays: ['Fri', 'Sat'],
            availabilityHours: '10:00 AM – 8:00 PM',
            isAvailableNow: false,
            verificationStatus: 'unverified',
            ratingAvg: 0,
            reviewCount: 0,
            completedBookings: 0,
            pendingBalanceBdt: 0,
            availableBalanceBdt: 0,
            photoUrl,
            instagramHandle: '',
            whatsappNumber: '',
            contactEmail: email,
            updatedAt: now,
          });
        }

        const sessionToken = setSessionCookie(req, res, uid, email, assignedRole);
        return res.json({ user: newUser, sessionToken });
      }

      const existing = userSnap.data() as UserAccount;
      if (existing.status !== 'active') {
        return res.status(403).json({ error: `Account is currently ${existing.status}.` });
      }

      // Enforce 2FA if enabled
      if (existing.twoFactorEnabled) {
        if (!totpCode) {
          return res.status(200).json({ requires2FA: true });
        }
        const privSnap = await adminDb
          .collection('users')
          .doc(uid)
          .collection('private')
          .doc('security')
          .get();
        const secretEnc = privSnap.data()?.totpSecretEncrypted;
        if (!secretEnc || !verifyTotpCode(decryptSensitive(secretEnc), String(totpCode))) {
          return res.status(401).json({ error: 'Invalid 2FA authenticator code.' });
        }
      }

      // Auto-promote pre-configured ROOT_ADMIN_EMAIL if root_lock not yet set
      if (!rootLockUid && envRootEmail && email === envRootEmail && decoded.email_verified) {
        await adminDb.collection('platform_settings').doc('root_lock').set({
          key: 'root_lock',
          rootAdminUid: uid,
          createdAt: now,
        });
        await adminDb.collection('admin_accounts').doc(uid).set({
          uid,
          adminId: 'ADM-ROOT-0001',
          email,
          phone: existing.phone || '',
          fullName: existing.fullName,
          role: 'root_super_admin',
          isRootOwner: true,
          status: 'active',
          createdByUid: 'env_bootstrap',
          createdAt: now,
        });
        await userRef.update({ role: 'root_super_admin' });
        existing.role = 'root_super_admin';
      }

      await adminDb
        .collection('users')
        .doc(uid)
        .collection('private')
        .doc('security')
        .set({ lastLoginAt: now }, { merge: true });

      const sessionToken = setSessionCookie(req, res, uid, existing.email, existing.role);
      return res.json({ user: existing, sessionToken });
    } catch (err) {
      console.error('Google auth error:', err);
      res.status(401).json({ error: 'Google authentication verification failed.' });
    }
  }
);

// Email + Password Registration (18+ mandatory, strictly customer or companion)
authRouter.post(
  '/auth/register',
  rateLimitMiddleware(10, 60_000, 'auth_register'),
  async (req, res) => {
    try {
      const {
        email,
        password,
        fullName,
        dateOfBirth,
        city,
        division,
        role,
        phone,
        instagramHandle,
        whatsappNumber,
        contactEmail,
        headline,
        bio,
        hourlyRateBdt,
        sessionRateBdt,
        photoUrl,
      } = req.body || {};
      const cleanEmail = sanitizeString(email, 200).toLowerCase();
      const cleanName = sanitizeString(fullName, 120);
      const rawCity = sanitizeString(city || 'Dhaka', 80);
      const cleanCity = isKnownBangladeshLocation(rawCity) ? rawCity : 'Dhaka';
      const cleanDivision =
        normalizeDivisionKey(division) || resolveDivisionForLocation(cleanCity) || 'Dhaka';
      const cleanPhone = sanitizeString(phone || '', 30);
      const cleanInstagram = sanitizeString(instagramHandle || '', 160);
      const cleanWhatsapp = sanitizeString(whatsappNumber || cleanPhone, 40);
      const cleanContactEmail = sanitizeString(contactEmail || cleanEmail, 160).toLowerCase();
      const cleanPhotoUrl = photoUrl !== undefined ? (sanitizePhotoData(photoUrl) ?? '') : '';

      if (!cleanEmail || !cleanEmail.includes('@') || !password || String(password).length < 8) {
        return res.status(400).json({
          error: 'Valid email and password (minimum 8 characters) are required.',
        });
      }
      if (!cleanName || !dateOfBirth) {
        return res.status(400).json({
          error: 'Full name and Date of Birth (18+ verification) are required.',
        });
      }

      const age = calculateAgeFromDob(String(dateOfBirth));
      if (age < 18) {
        return res.status(403).json({
          error: 'Registration Denied: LOGEASI.COM is strictly restricted to verified adults aged 18 and above.',
        });
      }

      // Security invariant: never allow registering admin or root roles publicly
      const safeRole = role === 'companion' ? 'companion' : 'customer';

      const dupCheck = await adminDb
        .collection('users')
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();
      if (!dupCheck.empty) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const uid = `usr_${crypto.randomBytes(10).toString('hex')}`;
      const passwordHash = await hashPassword(String(password));
      const now = new Date().toISOString();

      const newUser: UserAccount = {
        uid,
        email: cleanEmail,
        phone: cleanPhone || cleanWhatsapp,
        fullName: cleanName,
        role: safeRole,
        isAdultVerified18Plus: true,
        phoneVerified: false,
        emailVerified: true,
        twoFactorEnabled: false,
        status: 'active',
        photoUrl: cleanPhotoUrl,
        city: cleanCity,
        createdAt: now,
      };

      await adminDb.collection('users').doc(uid).set(newUser);
      await adminDb.collection('users').doc(uid).collection('private').doc('security').set({
        uid,
        dateOfBirth: encryptSensitive(String(dateOfBirth)),
        passwordHash,
        failedLoginAttempts: 0,
        lastLoginAt: now,
      });

      if (safeRole === 'customer') {
        await adminDb.collection('customer_profiles').doc(uid).set({
          uid,
          city: cleanCity,
          division: cleanDivision,
          area: '',
          bio: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          updatedAt: now,
        });
      } else {
        await adminDb.collection('companion_profiles').doc(uid).set({
          uid,
          displayName: cleanName,
          headline: sanitizeString(headline || 'Social Companion · Verification Pending', 160),
          bio: sanitizeString(bio || '', 1500),
          city: cleanCity,
          division: cleanDivision,
          areas: [cleanCity === 'Dhaka' ? 'Gulshan' : cleanCity],
          languages: ['Bengali', 'English'],
          categories: ['Dining & Coffee'],
          hourlyRateBdt: Math.max(500, Math.min(50000, Number(hourlyRateBdt || 1500))),
          sessionRateBdt: Math.max(1000, Math.min(150000, Number(sessionRateBdt || 4000))),
          availabilityDays: ['Fri', 'Sat'],
          availabilityHours: '10:00 AM – 8:00 PM',
          isAvailableNow: true,
          verificationStatus: 'unverified',
          ratingAvg: 0,
          reviewCount: 0,
          completedBookings: 0,
          pendingBalanceBdt: 0,
          availableBalanceBdt: 0,
          photoUrl: cleanPhotoUrl,
          instagramHandle: cleanInstagram,
          whatsappNumber: cleanWhatsapp,
          contactEmail: cleanContactEmail,
          updatedAt: now,
        });
      }

      const sessionToken = setSessionCookie(req, res, uid, cleanEmail, safeRole);
      res.status(201).json({ user: newUser, sessionToken });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Unable to create account.' });
    }
  }
);

// Email or Username + Password Login (with lockout + suspicious login audit + optional 2FA)
authRouter.post(
  '/auth/login',
  rateLimitMiddleware(15, 60_000, 'auth_login'),
  async (req, res) => {
    try {
      const { email, username, identifier, password, totpCode } = req.body || {};
      const cleanIdentifier = sanitizeString(identifier || username || email, 200).toLowerCase();
      if (!cleanIdentifier || !password) {
        return res.status(400).json({ error: 'Username or email and password are required.' });
      }

      let snap = await adminDb
        .collection('users')
        .where('email', '==', cleanIdentifier)
        .limit(1)
        .get();
      if (snap.empty) {
        snap = await adminDb
          .collection('users')
          .where('username', '==', cleanIdentifier)
          .limit(1)
          .get();
      }
      if (snap.empty) {
        return res.status(401).json({ error: 'Invalid username/email or password.' });
      }

      const userDoc = snap.docs[0];
      const user = userDoc.data() as UserAccount;
      if (user.status !== 'active') {
        return res.status(403).json({ error: `Account is ${user.status}.` });
      }

      const privRef = userDoc.ref.collection('private').doc('security');
      const privSnap = await privRef.get();
      const priv = privSnap.data() || {};

      if (priv.lockedUntil && new Date(priv.lockedUntil).getTime() > Date.now()) {
        return res.status(429).json({
          error: 'Account temporarily locked due to repeated failed login attempts. Try again later.',
        });
      }

      if (!priv.passwordHash) {
        return res.status(400).json({
          error: 'This account uses Google Sign-In or Phone OTP. Please use that method.',
        });
      }

      const valid = await verifyPassword(String(password), priv.passwordHash);
      if (!valid) {
        const attempts = Number(priv.failedLoginAttempts || 0) + 1;
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : '';
        await privRef.set({ failedLoginAttempts: attempts, lockedUntil }, { merge: true });

        if (attempts >= 3) {
          await writeAuditLog({
            actorUid: user.uid,
            actorRole: user.role,
            action: 'SUSPICIOUS_LOGIN_ATTEMPTS',
            targetType: 'user',
            targetId: user.uid,
            details: `${attempts} consecutive failed password attempts from IP ${req.ip || 'unknown'}.`,
            severity: attempts >= 5 ? 'critical' : 'warning',
          });
          await createNotification({
            userUid: user.uid,
            type: 'security_alert',
            title: 'Suspicious Login Activity Detected',
            message: `${attempts} failed sign-in attempts were blocked on your account.`,
          });
        }
        return res.status(401).json({ error: 'Invalid username/email or password.' });
      }

      if (user.twoFactorEnabled) {
        if (!totpCode) {
          return res.json({ requires2FA: true });
        }
        if (
          !priv.totpSecretEncrypted ||
          !verifyTotpCode(decryptSensitive(priv.totpSecretEncrypted), String(totpCode))
        ) {
          return res.status(401).json({ error: 'Invalid 2FA authenticator code.' });
        }
      }

      await privRef.set(
        { failedLoginAttempts: 0, lockedUntil: '', lastLoginAt: new Date().toISOString() },
        { merge: true }
      );
      const sessionToken = setSessionCookie(
        req,
        res,
        user.uid,
        user.email || user.username || '',
        user.role
      );
      res.json({ user, sessionToken });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  }
);

// Phone OTP Request & Verification (+880 Bangladesh phone numbers)
authRouter.post(
  '/auth/phone/request-otp',
  rateLimitMiddleware(6, 60_000, 'phone_otp'),
  async (req, res) => {
    try {
      const { phone, fullName, dateOfBirth, intendedRole } = req.body || {};
      const cleanPhone = sanitizeString(phone, 30).replace(/\s+/g, '');
      if (!/^\+?8801[3-9]\d{8}$/.test(cleanPhone) && !/^\+\d{8,15}$/.test(cleanPhone)) {
        return res.status(400).json({
          error: 'Enter a valid Bangladesh phone number (e.g. +8801712345678).',
        });
      }

      if (dateOfBirth) {
        const age = calculateAgeFromDob(String(dateOfBirth));
        if (age < 18) {
          return res.status(403).json({
            error: 'Only verified adults aged 18+ can register on LOGEASI.COM.',
          });
        }
      }

      const otp = String(crypto.randomInt(100000, 999999));
      const challengeId = `OTP_${crypto.randomBytes(8).toString('hex')}`;
      const now = Date.now();

      await adminDb.collection('otp_challenges').doc(challengeId).set({
        id: challengeId,
        phone: cleanPhone,
        fullName: sanitizeString(fullName || '', 120),
        dateOfBirth: dateOfBirth ? encryptSensitive(String(dateOfBirth)) : '',
        intendedRole: intendedRole === 'companion' ? 'companion' : 'customer',
        otpHash: hashOtp(otp),
        attempts: 0,
        expiresAt: new Date(now + 5 * 60_000).toISOString(),
        verified: false,
      });

      let deliveryChannel = 'sandbox_preview';
      if (process.env.SMS_WEBHOOK_URL) {
        deliveryChannel = 'sms_provider';
        await fetch(process.env.SMS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone,
            message: `Your LOGEASI.COM verification code is ${otp}. Valid for 5 minutes.`,
          }),
        }).catch(() => {});
      }

      res.json({
        challengeId,
        deliveryChannel,
        // Expose sandbox OTP only when SMS provider webhook is not configured
        sandboxOtpPreview: process.env.SMS_WEBHOOK_URL ? undefined : otp,
        expiresInSeconds: 300,
      });
    } catch (err) {
      console.error('OTP request error:', err);
      res.status(500).json({ error: 'Unable to issue phone OTP.' });
    }
  }
);

authRouter.post(
  '/auth/phone/verify-otp',
  attachAuthIfPresent,
  rateLimitMiddleware(10, 60_000, 'verify_otp'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { challengeId, code } = req.body || {};
      const cleanCode = sanitizeString(code, 10);
      if (!challengeId || !cleanCode) {
        return res.status(400).json({ error: 'Challenge ID and 6-digit OTP are required.' });
      }

      const ref = adminDb.collection('otp_challenges').doc(String(challengeId));
      const snap = await ref.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'OTP challenge not found or expired.' });
      }

      const ch = snap.data()!;
      if (ch.verified) {
        return res.status(400).json({ error: 'OTP challenge already used.' });
      }
      if (new Date(ch.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ error: 'OTP expired. Please request a new code.' });
      }
      if (ch.attempts >= 3) {
        return res.status(429).json({ error: 'Maximum OTP attempts exceeded.' });
      }

      if (hashOtp(cleanCode) !== ch.otpHash) {
        await ref.update({ attempts: (ch.attempts || 0) + 1 });
        return res.status(401).json({ error: 'Incorrect OTP code.' });
      }

      await ref.update({ verified: true });

      // If user is already logged in (e.g., verifying phone in dashboard), bind phone
      if (req.authUser) {
        await adminDb.collection('users').doc(req.authUser.uid).update({
          phone: ch.phone,
          phoneVerified: true,
        });
        return res.json({ verified: true, phone: ch.phone, user: { ...req.authUser, phone: ch.phone, phoneVerified: true } });
      }

      // Otherwise sign in or register user by verified phone
      const existingSnap = await adminDb
        .collection('users')
        .where('phone', '==', ch.phone)
        .limit(1)
        .get();

      const now = new Date().toISOString();
      if (!existingSnap.empty) {
        const user = existingSnap.docs[0].data() as UserAccount;
        if (user.status !== 'active') {
          return res.status(403).json({ error: `Account is ${user.status}.` });
        }
        await existingSnap.docs[0].ref.update({ phoneVerified: true });
        const sessionToken = setSessionCookie(req, res, user.uid, user.email, user.role);
        return res.json({ verified: true, user: { ...user, phoneVerified: true }, sessionToken });
      }

      // New phone user registration
      const uid = `phn_${crypto.randomBytes(10).toString('hex')}`;
      const safeRole = ch.intendedRole === 'companion' ? 'companion' : 'customer';
      const newUser: UserAccount = {
        uid,
        email: '',
        phone: ch.phone,
        fullName: ch.fullName || `Member ${ch.phone.slice(-4)}`,
        role: safeRole,
        isAdultVerified18Plus: true,
        phoneVerified: true,
        emailVerified: false,
        twoFactorEnabled: false,
        status: 'active',
        photoUrl: '',
        city: 'Dhaka',
        createdAt: now,
      };

      await adminDb.collection('users').doc(uid).set(newUser);
      await adminDb.collection('users').doc(uid).collection('private').doc('security').set({
        uid,
        dateOfBirth: ch.dateOfBirth || '',
        failedLoginAttempts: 0,
        lastLoginAt: now,
      });

      if (safeRole === 'customer') {
        await adminDb.collection('customer_profiles').doc(uid).set({
          uid,
          city: 'Dhaka',
          division: 'Dhaka',
          area: '',
          bio: '',
          emergencyContactName: '',
          emergencyContactPhone: '',
          updatedAt: now,
        });
      } else {
        await adminDb.collection('companion_profiles').doc(uid).set({
          uid,
          displayName: newUser.fullName,
          headline: 'Social Companion · Verification Pending',
          bio: '',
          city: 'Dhaka',
          division: 'Dhaka',
          areas: ['Gulshan'],
          languages: ['Bengali', 'English'],
          categories: ['Dining & Coffee'],
          hourlyRateBdt: 1500,
          sessionRateBdt: 4000,
          availabilityDays: ['Fri', 'Sat'],
          availabilityHours: '10:00 AM – 8:00 PM',
          isAvailableNow: false,
          verificationStatus: 'unverified',
          ratingAvg: 0,
          reviewCount: 0,
          completedBookings: 0,
          pendingBalanceBdt: 0,
          availableBalanceBdt: 0,
          photoUrl: '',
          instagramHandle: '',
          whatsappNumber: ch.phone,
          contactEmail: '',
          updatedAt: now,
        });
      }

      const sessionToken = setSessionCookie(req, res, uid, '', safeRole);
      res.json({ verified: true, user: newUser, sessionToken });
    } catch (err) {
      console.error('OTP verify error:', err);
      res.status(500).json({ error: 'Unable to verify OTP.' });
    }
  }
);

// Forgot password & reset
authRouter.post(
  '/auth/forgot-password',
  rateLimitMiddleware(5, 60_000, 'forgot_pw'),
  async (req, res) => {
    try {
      const cleanEmail = sanitizeString(req.body?.email, 200).toLowerCase();
      if (!cleanEmail) return res.status(400).json({ error: 'Email is required.' });

      const snap = await adminDb
        .collection('users')
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({
          message: 'If an email account exists, a password recovery token has been issued.',
        });
      }

      const user = snap.docs[0].data() as UserAccount;
      const resetToken = crypto.randomBytes(16).toString('hex');
      await adminDb.collection('password_resets').doc(resetToken).set({
        token: resetToken,
        uid: user.uid,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        used: false,
      });

      res.json({
        message: 'Password reset token generated. Valid for 15 minutes.',
        sandboxResetToken: process.env.EMAIL_WEBHOOK_URL ? undefined : resetToken,
      });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Unable to initiate password reset.' });
    }
  }
);

authRouter.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Valid reset token and 8+ char password required.' });
    }

    const ref = adminDb.collection('password_resets').doc(String(token));
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.used) {
      return res.status(400).json({ error: 'Invalid or already used reset token.' });
    }
    if (new Date(snap.data()!.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset token has expired.' });
    }

    const uid = snap.data()!.uid as string;
    const passwordHash = await hashPassword(String(newPassword));
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('private')
      .doc('security')
      .set({ passwordHash, failedLoginAttempts: 0, lockedUntil: '' }, { merge: true });
    await ref.update({ used: true });

    await writeAuditLog({
      actorUid: uid,
      actorRole: 'user',
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'user',
      targetId: uid,
      details: 'Password updated via recovery token.',
      severity: 'info',
    });

    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// Two-Factor Authentication (TOTP)
authRouter.post('/auth/2fa/setup', attachAuthIfPresent, requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const secret = generateTotpSecret();
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('private')
      .doc('security')
      .set({ pendingTotpSecretEncrypted: encryptSensitive(secret) }, { merge: true });

    const label = encodeURIComponent(req.authUser!.email || req.authUser!.phone || uid);
    const otpauthUri = `otpauth://totp/LOGEASI.COM:${label}?secret=${secret}&issuer=LOGEASI.COM`;
    res.json({ secret, otpauthUri });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: 'Failed to generate 2FA secret.' });
  }
});

authRouter.post('/auth/2fa/enable', attachAuthIfPresent, requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const code = sanitizeString(req.body?.code, 10);
    const privRef = adminDb.collection('users').doc(uid).collection('private').doc('security');
    const privSnap = await privRef.get();
    const pendingEnc = privSnap.data()?.pendingTotpSecretEncrypted;
    if (!pendingEnc) {
      return res.status(400).json({ error: 'Initialize 2FA setup first.' });
    }
    const secret = decryptSensitive(pendingEnc);
    if (!verifyTotpCode(secret, code)) {
      return res.status(400).json({ error: 'Invalid 6-digit authenticator code.' });
    }

    await privRef.set(
      { totpSecretEncrypted: pendingEnc, pendingTotpSecretEncrypted: '' },
      { merge: true }
    );
    await adminDb.collection('users').doc(uid).update({ twoFactorEnabled: true });

    await writeAuditLog({
      actorUid: uid,
      actorRole: req.authUser!.role,
      action: 'TWO_FACTOR_ENABLED',
      targetType: 'user',
      targetId: uid,
      details: 'TOTP Two-Factor Authentication enabled on account.',
      severity: 'info',
    });

    res.json({ twoFactorEnabled: true });
  } catch (err) {
    console.error('2FA enable error:', err);
    res.status(500).json({ error: 'Failed to enable 2FA.' });
  }
});

authRouter.post('/auth/2fa/disable', attachAuthIfPresent, requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('private')
      .doc('security')
      .set({ totpSecretEncrypted: '' }, { merge: true });
    await adminDb.collection('users').doc(uid).update({ twoFactorEnabled: false });
    res.json({ twoFactorEnabled: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable 2FA.' });
  }
});

authRouter.post('/auth/logout', attachAuthIfPresent, async (req: AuthenticatedRequest, res) => {
  res.clearCookie('logeasi_session', { path: '/' });
  res.clearCookie('logeasi_session', { path: '/', sameSite: 'none', secure: true });
  if (req.authUser && isAdminRole(req.authUser.role)) {
    await writeAuditLog({
      actorUid: req.authUser.uid,
      actorRole: req.authUser.role,
      action: 'ADMIN_LOGOUT',
      targetType: 'admin_account',
      targetId: req.authUser.uid,
      details: 'Administrator signed out securely.',
      severity: 'info',
    }).catch(() => {});
  }
  res.json({ loggedOut: true });
});

// Secure First-Time Root Super Admin Initialization (NEVER available after root_lock is created)
authRouter.post(
  '/admin/bootstrap-root',
  rateLimitMiddleware(5, 60_000, 'bootstrap_root'),
  attachAuthIfPresent,
  async (req: AuthenticatedRequest, res) => {
    try {
      const existingRoot = await getRootLockUid();
      if (existingRoot) {
        return res.status(403).json({
          error: 'Forbidden: Permanent Root Super Admin has already been initialized and locked.',
        });
      }

      const { setupKey, idToken, fullName, email, password, dateOfBirth } = req.body || {};
      const expectedKey = process.env.ROOT_ADMIN_SETUP_KEY || RUNTIME_ROOT_SETUP_TOKEN;
      if (!setupKey || String(setupKey) !== expectedKey) {
        return res.status(403).json({ error: 'Invalid server Root Admin Setup Key.' });
      }

      const now = new Date().toISOString();
      let uid = '';
      let rootEmail = '';
      let rootName = sanitizeString(fullName || 'Root Owner', 120);
      let photoUrl = '';

      if (idToken) {
        const decoded = await adminAuth.verifyIdToken(String(idToken));
        uid = decoded.uid;
        rootEmail = (decoded.email || '').toLowerCase();
        rootName = sanitizeString(decoded.name || rootName, 120);
        photoUrl = sanitizeString(decoded.picture || '', 500);
      } else {
        rootEmail = sanitizeString(email, 200).toLowerCase();
        if (!rootEmail || !password || String(password).length < 10) {
          return res.status(400).json({
            error: 'Root account requires either Google Sign-In or a valid email and 10+ character password.',
          });
        }
        const age = calculateAgeFromDob(String(dateOfBirth || '1990-01-01'));
        if (age < 18) {
          return res.status(403).json({ error: 'Root owner must be 18+.' });
        }
        uid = `root_${crypto.randomBytes(8).toString('hex')}`;
        const passwordHash = await hashPassword(String(password));
        await adminDb.collection('users').doc(uid).collection('private').doc('security').set({
          uid,
          passwordHash,
          dateOfBirth: encryptSensitive(String(dateOfBirth || '1990-01-01')),
          failedLoginAttempts: 0,
          lastLoginAt: now,
        });
      }

      // Atomically lock Root Super Admin ownership
      await adminDb.collection('platform_settings').doc('root_lock').set({
        key: 'root_lock',
        rootAdminUid: uid,
        createdAt: now,
      });
      await adminDb.collection('platform_settings').doc('main').set(
        { rootAdminUid: uid, updatedAt: now },
        { merge: true }
      );

      const rootUser: UserAccount = {
        uid,
        email: rootEmail,
        phone: '',
        fullName: rootName,
        role: 'root_super_admin',
        isAdultVerified18Plus: true,
        phoneVerified: false,
        emailVerified: true,
        twoFactorEnabled: false,
        status: 'active',
        photoUrl,
        city: 'Dhaka',
        createdAt: now,
      };

      await adminDb.collection('users').doc(uid).set(rootUser, { merge: true });
      await adminDb.collection('admin_accounts').doc(uid).set({
        uid,
        adminId: 'ADM-ROOT-0001',
        email: rootEmail,
        phone: '',
        fullName: rootName,
        role: 'root_super_admin',
        isRootOwner: true,
        status: 'active',
        createdByUid: 'secure_root_bootstrap',
        createdAt: now,
      });

      await writeAuditLog({
        actorUid: uid,
        actorRole: 'root_super_admin',
        action: 'ROOT_SUPER_ADMIN_INITIALIZED',
        targetType: 'admin_account',
        targetId: uid,
        details: `Permanent Root Super Admin initialized and locked for ${rootEmail}.`,
        severity: 'critical',
      });

      const sessionToken = setSessionCookie(req, res, uid, rootEmail, 'root_super_admin');
      res.status(201).json({
        user: { ...rootUser, isRootOwner: true, adminId: 'ADM-ROOT-0001' },
        sessionToken,
      });
    } catch (err) {
      console.error('Bootstrap root error:', err);
      res.status(500).json({ error: 'Root Super Admin initialization failed.' });
    }
  }
);
