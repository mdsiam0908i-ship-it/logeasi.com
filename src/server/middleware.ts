import type { NextFunction, Request, Response } from 'express';
import { adminAuth, adminDb } from '../lib/firebase-admin.ts';
import { getRolePermissions, isAdminRole } from './rbac.ts';
import { checkRateLimit, parseCookies, verifySessionToken } from './security.ts';
import type { UserAccount, UserRole } from '../types/logeasi.ts';

export interface AuthenticatedRequest extends Request {
  authUser?: UserAccount;
}

export function rateLimitMiddleware(maxReq: number, windowMs: number, bucketName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const allowed = checkRateLimit(`${bucketName}:${ip}`, maxReq, windowMs);
    if (!allowed) {
      return res.status(429).json({
        error: 'Too many requests. Rate limit exceeded; please wait and try again.',
      });
    }
    next();
  };
}

export async function attachAuthIfPresent(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    let uid = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const localVerified = verifySessionToken(token);
        if (localVerified) {
          uid = localVerified.uid;
        } else {
          try {
            const decoded = await adminAuth.verifyIdToken(token);
            uid = decoded.uid;
          } catch {
            // Ignore invalid bearer if cookie is present
          }
        }
      }
    }

    if (!uid) {
      const cookies = parseCookies(req.headers.cookie);
      const sessionCookie = cookies['logeasi_session'];
      if (sessionCookie) {
        const verified = verifySessionToken(sessionCookie);
        if (verified) {
          uid = verified.uid;
        }
      }
    }

    if (uid) {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const userData = userSnap.data() as UserAccount;
        let permissions: string[] = [];
        let isRootOwner = false;
        let adminId: string | undefined;

        if (isAdminRole(userData.role)) {
          const adminSnap = await adminDb.collection('admin_accounts').doc(uid).get();
          if (adminSnap.exists) {
            const adm = adminSnap.data()!;
            if (adm.status === 'active') {
              isRootOwner = Boolean(adm.isRootOwner);
              adminId = adm.adminId;
              permissions =
                adm.role !== 'root_super_admin' && Array.isArray(adm.customPermissions)
                  ? (adm.customPermissions as string[])
                  : await getRolePermissions(adm.role as UserRole);
              userData.role = adm.role as UserRole;
            }
          }
        }

        req.authUser = {
          ...userData,
          isRootOwner,
          adminId,
          permissions,
        };
      }
    }
  } catch (err) {
    console.error('Auth resolution warning:', err);
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  if (req.authUser.status !== 'active') {
    return res.status(403).json({
      error: `Account is ${req.authUser.status}. Contact support for assistance.`,
    });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: 'Administrator authentication required.' });
  }
  if (!isAdminRole(req.authUser.role)) {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  if (req.authUser.status !== 'active') {
    return res.status(403).json({ error: 'Administrator account is suspended.' });
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Administrator authentication required.' });
    }
    if (req.authUser.isRootOwner || req.authUser.role === 'root_super_admin') {
      return next();
    }
    const perms = req.authUser.permissions || [];
    if (!perms.includes(permission)) {
      return res.status(403).json({
        error: `Forbidden: Missing required permission (${permission}).`,
      });
    }
    next();
  };
}

export function requireAnyPermission(allowedPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Administrator authentication required.' });
    }
    if (req.authUser.isRootOwner || req.authUser.role === 'root_super_admin') {
      return next();
    }
    const perms = req.authUser.permissions || [];
    if (!allowedPermissions.some((p) => perms.includes(p))) {
      return res.status(403).json({
        error: `Forbidden: Missing required permission (${allowedPermissions.join(' or ')}).`,
      });
    }
    next();
  };
}

export function requireRootOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || !req.authUser.isRootOwner || req.authUser.role !== 'root_super_admin') {
    return res.status(403).json({
      error: 'Forbidden: Only the permanent Root Super Admin can perform this operation.',
    });
  }
  next();
}

export const PROFILE_UPDATE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function getProfileDeadlineMs(user: UserAccount): number {
  if (user.profileDeadlineAt) {
    const parsed = new Date(user.profileDeadlineAt).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  const createdMs = new Date(user.createdAt || Date.now()).getTime();
  return (Number.isNaN(createdMs) ? Date.now() : createdMs) + PROFILE_UPDATE_GRACE_MS;
}

export function isProfileLockExpired(user?: UserAccount | null): boolean {
  if (!user) return false;
  if (isAdminRole(user.role)) return false;
  if (user.uid.startsWith('cmp_') || user.uid.startsWith('root_')) return false;
  if (user.profileCompleted === true) return false;
  return Date.now() > getProfileDeadlineMs(user);
}

export function requireProfileUnlocked(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (isProfileLockExpired(req.authUser)) {
    return res.status(403).json({
      error:
        '৩ দিনের মধ্যে প্রোফাইল আপডেট না করায় আপনার অ্যাকাউন্টের সকল কার্যক্রম সাময়িকভাবে লক করা হয়েছে। অনুগ্রহ করে প্রথমে আপনার প্রোফাইল আপডেট করুন।',
      profileLockExpired: true,
    });
  }
  next();
}
