import crypto from 'node:crypto';
import { Router } from 'express';
import { adminDb } from '../lib/firebase-admin.ts';
import { rateLimitMiddleware } from './middleware.ts';
import { hashPassword, sanitizeString } from './security.ts';
import { getRootLockUid, writeAuditLog } from './rbac.ts';

export const adminOwnerRecoveryRouter = Router();

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

function equalSecret(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

/**
 * One-time operational recovery for the existing permanent root owner.
 * Requires a high-entropy secret configured only in the server environment.
 * Remove ROOT_ADMIN_RECOVERY_KEY from the environment immediately after use.
 */
adminOwnerRecoveryRouter.post(
  '/admin/owner/recover-credentials',
  rateLimitMiddleware(3, 60_000, 'root_owner_recovery'),
  async (req, res) => {
    try {
      const recoveryKey = process.env.ROOT_ADMIN_RECOVERY_KEY || '';
      if (recoveryKey.length < 32) {
        return res.status(503).json({ error: 'Root owner recovery is not configured.' });
      }

      const suppliedKey = String(req.get('x-root-recovery-key') || '');
      if (!equalSecret(suppliedKey, recoveryKey)) {
        return res.status(401).json({ error: 'Invalid recovery authorization.' });
      }

      const username = sanitizeString(req.body?.username, 32).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!USERNAME_PATTERN.test(username)) {
        return res.status(400).json({ error: 'Username must be 3–32 characters: a-z, 0-9, dot, underscore, or hyphen.' });
      }
      if (password.length < 12 || password.length > 128) {
        return res.status(400).json({ error: 'Password must be 12–128 characters.' });
      }

      const rootUid = await getRootLockUid();
      if (!rootUid) {
        return res.status(409).json({ error: 'No initialized root owner exists; use the first-time owner setup instead.' });
      }

      const userRef = adminDb.collection('users').doc(rootUid);
      const adminRef = adminDb.collection('admin_accounts').doc(rootUid);
      const [userSnap, adminSnap] = await Promise.all([userRef.get(), adminRef.get()]);
      if (
        !userSnap.exists ||
        !adminSnap.exists ||
        userSnap.data()?.role !== 'root_super_admin' ||
        adminSnap.data()?.isRootOwner !== true
      ) {
        return res.status(409).json({ error: 'Root owner records are inconsistent; recovery was not applied.' });
      }

      const duplicate = await adminDb
        .collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();
      if (!duplicate.empty && duplicate.docs[0].id !== rootUid) {
        return res.status(409).json({ error: 'That username is already in use.' });
      }

      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();
      const securityRef = userRef.collection('private').doc('security');
      await Promise.all([
        userRef.update({ username, status: 'active' }),
        adminRef.update({ username, status: 'active' }),
        securityRef.set(
          { passwordHash, failedLoginAttempts: 0, lockedUntil: '', lastLoginAt: '' },
          { merge: true }
        ),
      ]);

      await writeAuditLog({
        actorUid: rootUid,
        actorRole: 'root_super_admin',
        action: 'ROOT_OWNER_CREDENTIALS_RECOVERED',
        targetType: 'admin_account',
        targetId: rootUid,
        details: `Root owner username/password credentials were reset via the server recovery key at ${now}.`,
        severity: 'critical',
      });

      return res.json({ recovered: true, username });
    } catch (err) {
      console.error('Root owner credential recovery error:', err);
      return res.status(500).json({ error: 'Root owner credential recovery failed.' });
    }
  }
);
