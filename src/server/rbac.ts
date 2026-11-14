import crypto from 'node:crypto';
import { adminDb } from '../lib/firebase-admin.ts';
import type { UserRole } from '../types/logeasi.ts';

export const ALL_PERMISSIONS = [
  { key: 'manage_customers', category: 'Operations', description: 'View, suspend, and reinstate customer accounts' },
  { key: 'manage_companions', category: 'Operations', description: 'Manage companion profiles and listings' },
  { key: 'approve_verifications', category: 'Trust & Safety', description: 'Approve or reject 18+ identity verification requests' },
  { key: 'manage_bookings', category: 'Operations', description: 'Inspect, update, or resolve disputed bookings' },
  { key: 'handle_complaints', category: 'Support', description: 'Respond to support tickets and safety reports' },
  { key: 'process_refunds', category: 'Finance', description: 'Approve or reject customer refund requests' },
  { key: 'manage_payments', category: 'Finance', description: 'Reconcile payments and export financial reports' },
  { key: 'review_payouts', category: 'Finance', description: 'Approve and settle companion payout withdrawals' },
  { key: 'manage_content', category: 'Content', description: 'Update platform banners, safety notices, and announcements' },
  { key: 'create_admins', category: 'Governance', description: 'Create new operational administrator accounts' },
  { key: 'manage_non_root_admins', category: 'Governance', description: 'Modify or suspend non-root admin accounts' },
  { key: 'view_analytics', category: 'Analytics', description: 'Access marketplace analytics and revenue dashboards' },
  { key: 'manage_platform_config', category: 'Root Exclusive', description: 'Configure service fee %, live payment mode, and core settings' },
  { key: 'customize_role_permissions', category: 'Root Exclusive', description: 'Customize permissions assigned to admin roles' },
  { key: 'manage_backups', category: 'Root Exclusive', description: 'Export and manage database backup & disaster recovery snapshots' },
  { key: 'view_audit_logs', category: 'Security', description: 'Inspect immutable security and administrative audit logs' },
] as const;

export const DEFAULT_ROLE_DEFINITIONS: Record<
  Exclude<UserRole, 'customer' | 'companion'>,
  { label: string; permissions: string[]; isSystemProtected: boolean }
> = {
  root_super_admin: {
    label: 'Root Super Admin',
    permissions: ALL_PERMISSIONS.map((p) => p.key),
    isSystemProtected: true,
  },
  super_admin: {
    label: 'Super Admin / Administrator',
    permissions: [
      'manage_customers',
      'manage_companions',
      'approve_verifications',
      'manage_bookings',
      'handle_complaints',
      'process_refunds',
      'manage_payments',
      'review_payouts',
      'manage_content',
      'create_admins',
      'manage_non_root_admins',
      'view_analytics',
      'view_audit_logs',
    ],
    isSystemProtected: false,
  },
  finance_admin: {
    label: 'Finance Admin',
    permissions: ['process_refunds', 'manage_payments', 'review_payouts', 'view_analytics'],
    isSystemProtected: false,
  },
  support_admin: {
    label: 'Customer Support Admin',
    permissions: ['manage_customers', 'manage_bookings', 'handle_complaints', 'process_refunds'],
    isSystemProtected: false,
  },
  verification_admin: {
    label: 'Verification Admin',
    permissions: ['approve_verifications', 'manage_companions', 'view_analytics'],
    isSystemProtected: false,
  },
  content_manager: {
    label: 'Content Manager',
    permissions: ['manage_content', 'view_analytics'],
    isSystemProtected: false,
  },
};

export function isAdminRole(role: string): boolean {
  return [
    'root_super_admin',
    'super_admin',
    'finance_admin',
    'support_admin',
    'verification_admin',
    'content_manager',
  ].includes(role);
}

export async function getRolePermissions(role: UserRole): Promise<string[]> {
  if (role === 'customer' || role === 'companion') return [];
  if (role === 'root_super_admin') {
    return ALL_PERMISSIONS.map((p) => p.key);
  }
  try {
    const snap = await adminDb.collection('admin_roles').doc(role).get();
    if (snap.exists) {
      const data = snap.data();
      if (Array.isArray(data?.permissions)) {
        return data.permissions as string[];
      }
    }
  } catch {
    // Fallback to default static mapping
  }
  return DEFAULT_ROLE_DEFINITIONS[role]?.permissions || [];
}

export async function getRootLockUid(): Promise<string | null> {
  const snap = await adminDb.collection('platform_settings').doc('root_lock').get();
  if (!snap.exists) return null;
  return (snap.data()?.rootAdminUid as string) || null;
}

export async function writeAuditLog(params: {
  actorUid: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  severity?: 'info' | 'warning' | 'critical';
}) {
  const id = `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  await adminDb.collection('audit_logs').doc(id).set({
    id,
    actorUid: params.actorUid,
    actorRole: params.actorRole,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    severity: params.severity || 'info',
    createdAt: new Date().toISOString(),
  });
}

export async function createNotification(params: {
  userUid: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  const id = `NTF-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const createdAt = new Date().toISOString();
  await adminDb.collection('notifications').doc(id).set({
    id,
    userUid: params.userUid,
    type: params.type,
    title: params.title,
    message: params.message,
    read: false,
    link: params.link || '',
    createdAt,
  });

  // Dispatch external Email or SMS webhooks if configured in server environment
  if (process.env.EMAIL_WEBHOOK_URL) {
    fetch(process.env.EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).catch(() => {});
  }
  if (process.env.SMS_WEBHOOK_URL) {
    fetch(process.env.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).catch(() => {});
  }
}

export async function assertRootProtection(params: {
  targetUid: string;
  actorUid: string;
  actorRole: string;
  action: string;
}): Promise<{ allowed: boolean; reason?: string }> {
  const rootUid = await getRootLockUid();
  if (!rootUid) return { allowed: true };

  // Also check if target is flagged as root owner
  const targetAdmin = await adminDb.collection('admin_accounts').doc(params.targetUid).get();
  const isTargetRoot =
    params.targetUid === rootUid || targetAdmin.data()?.isRootOwner === true;

  if (!isTargetRoot) return { allowed: true };

  // No other admin can ever touch the Root Super Admin account
  if (params.actorUid !== rootUid) {
    await writeAuditLog({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: `BLOCKED_ROOT_PROTECTION_${params.action}`,
      targetType: 'admin_account',
      targetId: params.targetUid,
      details: `Unauthorized attempt by ${params.actorUid} to perform ${params.action} on protected Root Super Admin.`,
      severity: 'critical',
    });
    return {
      allowed: false,
      reason:
        'PROTECTED ROOT ACCOUNT VIOLATION: No administrator can delete, deactivate, suspend, modify credentials, or revoke privileges of the permanent Root Super Admin.',
    };
  }

  // Even the root owner cannot delete, suspend, or remove their own root_super_admin role
  if (['DELETE', 'SUSPEND', 'DEACTIVATE', 'REMOVE_ROOT_ROLE'].includes(params.action)) {
    return {
      allowed: false,
      reason:
        'The permanent Root Super Admin account cannot be deleted, deactivated, suspended, or stripped of Root ownership.',
    };
  }

  return { allowed: true };
}
