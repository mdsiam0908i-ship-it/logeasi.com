import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Key,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  Shuffle,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
import {
  containsUnsafeViolenceTerm,
  DEFAULT_BENGALI_BOOKING_CATEGORIES,
  VIOLENCE_SAFETY_MESSAGE_BN,
} from '../data/bookingCategories.ts';
import { apiRequest, formatBdt, getStoredSessionToken, setStoredSessionToken } from '../lib/api.ts';
import type {
  AdminAccountRecord,
  AdminRoleDefinition,
  AuditLogRecord,
  CompanionPayoutRecord,
  CompanionProfile,
  PaymentRecord,
  RefundRecord,
  SupportTicketRecord,
  UserAccount,
  UserRole,
  VerificationRequestRecord,
} from '../types/logeasi.ts';

function AdminShell({
  activeTab,
  title,
  children,
}: {
  activeTab: string;
  title: string;
  children: React.ReactNode;
}) {
  const { user, logout, navigate } = useAuth();
  const nav = [
    { key: 'dashboard', label: 'Overview & Ops', path: '/admin/dashboard', icon: BarChart3 },
    { key: 'management', label: 'Admin & RBAC', path: '/admin/management', icon: Users },
    { key: 'finance', label: 'Finance & Payouts', path: '/admin/finance', icon: FileSpreadsheet },
    { key: 'security', label: 'Security & Audit', path: '/admin/security', icon: ShieldAlert },
  ];

  const isAdmin =
    user &&
    [
      'root_super_admin',
      'super_admin',
      'finance_admin',
      'support_admin',
      'verification_admin',
      'content_manager',
    ].includes(user.role);

  if (!user || !isAdmin) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <Shield className="w-10 h-10 text-blue-700 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-slate-950">Administrator Access Required</h1>
        <p className="text-sm text-slate-600">
          Please authenticate with an authorized LOGEASI.COM administrator account.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/login')}
          className="px-5 py-2.5 bg-slate-950 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          Go to Admin Login
        </button>
      </main>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 bg-slate-950 text-white rounded-2xl p-5 space-y-6 border border-slate-800 shadow-lg">
          <div className="space-y-1 border-b border-slate-800 pb-4">
            <p className="text-[11px] font-mono text-blue-400">
              {user.isRootOwner ? 'PERMANENT ROOT OWNER' : 'OPERATIONAL ADMIN'}
            </p>
            <p className="font-display text-base font-bold truncate">{user.fullName}</p>
            <p className="text-xs text-slate-400 font-mono">{user.adminId || user.role}</p>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    active ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-300 hover:text-white hover:bg-red-950/60 border border-red-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out of Admin
            </button>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs text-slate-500">LOGEASI.COM Governance / {title}</p>
              <h1 className="font-display text-2xl font-bold text-slate-950 tracking-tight">{title}</h1>
            </div>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}

// Page 16: Admin Login & Secure First-Time Root Bootstrap
export function AdminLoginPage() {
  const { user, platformPublic, loginWithGoogle, refreshSession, navigate } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [authView, setAuthView] = useState<'signin' | 'bootstrap'>('signin');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin =
    user &&
    [
      'root_super_admin',
      'super_admin',
      'finance_admin',
      'support_admin',
      'verification_admin',
      'content_manager',
    ].includes(user.role);

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isAdmin]);

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleanId = email.trim();
      const res = await apiRequest<{ user?: UserAccount; requires2FA?: boolean; sessionToken?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email: cleanId,
            identifier: cleanId,
            password,
            totpCode: totpCode || undefined,
          }),
        }
      );
      if (res.requires2FA) {
        setNeeds2FA(true);
      } else if (res.user) {
        if (res.sessionToken) setStoredSessionToken(res.sessionToken);
        await refreshSession();
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleAdmin = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await loginWithGoogle('customer', undefined, totpCode || undefined);
      if (res.requires2FA) {
        setNeeds2FA(true);
      } else if (res.user) {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBootstrapRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ user?: UserAccount; sessionToken?: string }>(
        '/api/admin/bootstrap-root',
        {
          method: 'POST',
          body: JSON.stringify({
            setupKey,
            fullName,
            email,
            password,
          }),
        }
      );
      if (res.sessionToken) setStoredSessionToken(res.sessionToken);
      await refreshSession();
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-slate-950 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-6">
        <div className="space-y-1.5">
          <p className="text-xs font-mono text-blue-400">RESTRICTED GOVERNANCE PORTAL</p>
          <h1 className="font-display text-2xl font-bold">LOGEASI.COM Admin Login</h1>
          <p className="text-xs text-slate-400">
            All administrative actions and login attempts are recorded in immutable security audit logs.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-200">
            {error}
          </div>
        )}

        {!platformPublic.rootInitialized && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setAuthView('signin')}
              className={`py-2 rounded-lg font-semibold cursor-pointer ${
                authView === 'signin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthView('bootstrap')}
              className={`py-2 rounded-lg font-semibold cursor-pointer ${
                authView === 'bootstrap' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Root Owner Setup
            </button>
          </div>
        )}

        {!platformPublic.rootInitialized && authView === 'bootstrap' ? (
          <form onSubmit={handleBootstrapRoot} className="space-y-4 border-t border-slate-800 pt-5">
            <div className="p-3 bg-blue-950/60 border border-blue-800 rounded-lg text-xs text-blue-200">
              First-Time Setup: Initialize the permanent Root Super Admin using your server-side <code className="font-mono">ROOT_ADMIN_SETUP_KEY</code> (or runtime console setup token).
            </div>
            <input
              required
              type="password"
              value={setupKey}
              onChange={(e) => setSetupKey(e.target.value)}
              placeholder="Server Root Setup Key"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
            />
            <input
              required
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Root Owner Legal Name"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Root Owner Email"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <input
              required
              minLength={10}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Root Password (min 10 characters)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              Initialize Permanent Root Super Admin
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleAdmin}
              className="w-full py-2.5 bg-white text-slate-950 hover:bg-slate-100 rounded-lg text-sm font-semibold cursor-pointer"
            >
              Continue with Authorized Google Account
            </button>

            <form onSubmit={handleAdminEmailLogin} className="space-y-3 border-t border-slate-800 pt-5">
              <input
                required
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin Username or Email"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin Password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              />
              {needs2FA && (
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6-Digit 2FA Code"
                  className="w-full bg-slate-900 border border-blue-500 rounded-lg px-3 py-2 text-sm font-mono"
                />
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Sign In to Admin Console
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

// Page 17: Root Admin Dashboard
export function RootAdminDashboardPage() {
  const { platformPublic, refreshPublicPlatform } = useAuth();
  const [days, setDays] = useState('30');
  const [overview, setOverview] = useState<any>(null);
  const [verifications, setVerifications] = useState<VerificationRequestRecord[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [companions, setCompanions] = useState<CompanionProfile[]>([]);
  const [editingCompanion, setEditingCompanion] = useState<CompanionProfile | null>(null);
  const [cmpForm, setCmpForm] = useState({
    displayName: '',
    headline: '',
    division: 'Dhaka',
    city: 'Dhaka',
    hourlyRateBdt: 1500,
    sessionRateBdt: 4000,
    instagramHandle: '',
    whatsappNumber: '',
    contactEmail: '',
    verificationStatus: 'approved',
    isAvailableNow: true,
    photoUrl: '',
  });
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [banner, setBanner] = useState(platformPublic.announcementBanner || '');
  const [safetyNote, setSafetyNote] = useState(platformPublic.safetyNotice || '');
  const [headline, setHeadline] = useState(platformPublic.featuredHeadline || '');
  const [categoriesList, setCategoriesList] = useState<string[]>(
    platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0
      ? platformPublic.bookingCategories
      : DEFAULT_BENGALI_BOOKING_CATEGORIES
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const loadAll = async () => {
    try {
      const ov = await apiRequest(`/api/admin/overview?days=${days}`);
      setOverview(ov);
    } catch {
      // Permission-scoped
    }
    apiRequest<{ verifications: VerificationRequestRecord[] }>('/api/admin/verifications')
      .then((r) => setVerifications(r.verifications || []))
      .catch(() => {});
    apiRequest<{ users: UserAccount[] }>('/api/admin/users')
      .then((r) => setUsers(r.users || []))
      .catch(() => {});
    apiRequest<{ companions: CompanionProfile[] }>('/api/admin/companions')
      .then((r) => setCompanions(r.companions || []))
      .catch(() => {});
    apiRequest<{ tickets: SupportTicketRecord[] }>('/api/admin/tickets')
      .then((r) => setTickets(r.tickets || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadAll();
  }, [days]);

  useEffect(() => {
    if (platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0) {
      setCategoriesList(platformPublic.bookingCategories);
    }
  }, [platformPublic.bookingCategories]);

  const openCompanionPowerEditor = (cmp: CompanionProfile) => {
    setEditingCompanion(cmp);
    setCmpForm({
      displayName: cmp.displayName || '',
      headline: cmp.headline || '',
      division: cmp.division || 'Dhaka',
      city: cmp.city || 'Dhaka',
      hourlyRateBdt: cmp.hourlyRateBdt || 1500,
      sessionRateBdt: cmp.sessionRateBdt || 4000,
      instagramHandle: cmp.instagramHandle || '',
      whatsappNumber: cmp.whatsappNumber || '',
      contactEmail: cmp.contactEmail || '',
      verificationStatus: cmp.verificationStatus || 'approved',
      isAvailableNow: Boolean(cmp.isAvailableNow),
      photoUrl: cmp.photoUrl || '',
    });
  };

  const saveCompanionPowerEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompanion) return;
    setNotice('');
    try {
      await apiRequest(`/api/admin/companions/${editingCompanion.uid}`, {
        method: 'PATCH',
        body: JSON.stringify(cmpForm),
      });
      setNotice(`Companion ${cmpForm.displayName} updated by Admin.`);
      setEditingCompanion(null);
      loadAll();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const reviewVerification = async (id: string, decision: 'approved' | 'rejected') => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/verifications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reviewerNote: `Reviewed by admin (${decision})` }),
      });
      setNotice(`Verification ${id} marked ${decision}.`);
      loadAll();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const toggleUserStatus = async (uid: string, currentStatus: string) => {
    setNotice('');
    try {
      const next = currentStatus === 'suspended' ? 'active' : 'suspended';
      await apiRequest(`/api/admin/users/${uid}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: next }),
      });
      setNotice(`User ${uid} updated to ${next}.`);
      loadAll();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const replyTicket = async (id: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/tickets/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ adminReply: replyMap[id] || 'Resolved by support.', status: 'resolved' }),
      });
      setNotice(`Support ticket ${id} resolved.`);
      loadAll();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const saveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/admin/content', {
        method: 'PUT',
        body: JSON.stringify({
          announcementBanner: banner,
          safetyNotice: safetyNote,
          featuredHeadline: headline,
        }),
      });
      await refreshPublicPlatform();
      setNotice('Website content settings updated.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const persistBookingCategories = async (nextList: string[]) => {
    setNotice('');
    try {
      const res = await apiRequest<{ bookingCategories: string[] }>('/api/admin/categories', {
        method: 'PUT',
        body: JSON.stringify({ categories: nextList }),
      });
      setCategoriesList(res.bookingCategories || nextList);
      await refreshPublicPlatform();
      setNotice('Booking categories updated for all customers & companions.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const handleAddAdminCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (containsUnsafeViolenceTerm(trimmed)) {
      setNotice(VIOLENCE_SAFETY_MESSAGE_BN);
      return;
    }
    const next = Array.from(new Set([...categoriesList, trimmed]));
    setNewCategoryInput('');
    await persistBookingCategories(next);
  };

  const handleRemoveAdminCategory = async (cat: string) => {
    const next = categoriesList.filter((c) => c !== cat);
    await persistBookingCategories(next);
  };

  const kpis = overview?.kpis || {};
  const gateways: Array<{ gateway: string; volumeBdt: number; count: number }> =
    overview?.gatewayBreakdown || [];
  const maxGatewayVol = Math.max(1, ...gateways.map((g) => g.volumeBdt));

  return (
    <AdminShell activeTab="dashboard" title="Root & Operations Dashboard">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600">Live marketplace telemetry across Bangladesh</p>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          {['7', '30', '90', '365'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded cursor-pointer ${days === d ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {/* 12 KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', val: kpis.totalCustomers ?? 0 },
          { label: 'Total Companions', val: kpis.totalCompanions ?? 0 },
          { label: 'Verified Companions', val: kpis.verifiedCompanions ?? 0 },
          { label: 'Pending Verifications', val: kpis.pendingVerifications ?? 0 },
          { label: 'Active Bookings', val: kpis.activeBookings ?? 0 },
          { label: 'Completed Bookings', val: kpis.completedBookings ?? 0 },
          { label: 'Cancelled Bookings', val: kpis.cancelledBookings ?? 0 },
          { label: 'Total Volume', val: formatBdt(kpis.totalVolumeBdt ?? 0) },
          { label: 'Platform Revenue', val: formatBdt(kpis.platformRevenueBdt ?? 0) },
          { label: 'Pending Payouts', val: kpis.pendingPayouts ?? 0 },
          { label: 'Refund Requests', val: kpis.refundRequests ?? 0 },
          { label: 'Open Complaints', val: kpis.openComplaints ?? 0 },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="font-mono text-xl font-bold text-slate-950 tabular-nums mt-1">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Interactive Chart + Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950">Payment Gateway Volume (BDT)</h2>
          <div className="space-y-3">
            {gateways.map((g) => (
              <div key={g.gateway} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-800">{g.gateway} ({g.count} txns)</span>
                  <span className="font-mono tabular-nums text-slate-900">{formatBdt(g.volumeBdt)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-700 rounded-full"
                    style={{ width: `${Math.max(3, Math.round((g.volumeBdt / maxGatewayVol) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-700" /> Recent Governance Activity
          </h2>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto text-xs">
            {(overview?.recentActivity || []).map((a: AuditLogRecord) => (
              <div key={a.id} className="py-2">
                <p className="font-mono font-semibold text-slate-900">{a.action}</p>
                <p className="text-slate-600">{a.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 18+ Verification Queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-950">18+ Identity Verification Approvals</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Applicant</th>
                <th className="py-2 px-3">Document</th>
                <th className="py-2 px-3">Age</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {verifications.map((v) => (
                <tr key={v.id}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">{v.fullName} ({v.city})</td>
                  <td className="py-2.5 px-3 font-mono uppercase">{v.documentType} {v.documentNumberMasked}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums">{v.calculatedAge} yrs</td>
                  <td className="py-2.5 px-3 capitalize font-medium">{v.status}</td>
                  <td className="py-2.5 pl-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => reviewVerification(v.id, 'approved')}
                      className="px-2.5 py-1 bg-blue-700 text-white rounded font-semibold cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewVerification(v.id, 'rejected')}
                      className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Companion Directory & Contact Power Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-700" /> Companion Directory & Contact Power Controls
            </h2>
            <p className="text-xs text-slate-500">
              Directly edit any companion’s Instagram, WhatsApp, Email, verification status, rates, and availability.
            </p>
          </div>
          <span className="text-xs font-mono text-blue-700">{companions.length} companions</span>
        </div>

        {editingCompanion && (
          <form
            onSubmit={saveCompanionPowerEdits}
            className="bg-slate-50 border-2 border-blue-700 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-[11px] font-mono text-blue-700 font-bold">
                  ADMIN COMPANION POWER OVERRIDE ({editingCompanion.uid})
                </p>
                <h3 className="font-display text-base font-bold text-slate-950">
                  Editing: {editingCompanion.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCompanion(null)}
                className="px-3 py-1 border border-slate-300 bg-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <DevicePhotoPicker
              label="Companion Picture (Add / Change Directly from Device)"
              helperText="Upload this companion's portrait straight from your phone or computer — no image URL needed."
              value={cmpForm.photoUrl}
              onChange={(photoUrl) => setCmpForm((p) => ({ ...p, photoUrl }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Display Name</label>
                <input
                  required
                  type="text"
                  value={cmpForm.displayName}
                  onChange={(e) => setCmpForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Division</label>
                <select
                  value={cmpForm.division}
                  onChange={(e) => setCmpForm((p) => ({ ...p, division: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                >
                  {BANGLADESH_DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">City / District</label>
                <input
                  type="text"
                  value={cmpForm.city}
                  onChange={(e) => setCmpForm((p) => ({ ...p, city: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Instagram Handle</label>
                <input
                  type="text"
                  value={cmpForm.instagramHandle}
                  onChange={(e) => setCmpForm((p) => ({ ...p, instagramHandle: e.target.value }))}
                  placeholder="@username"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">WhatsApp Number</label>
                <input
                  type="text"
                  value={cmpForm.whatsappNumber}
                  onChange={(e) => setCmpForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                  placeholder="+88017..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Public Contact Email</label>
                <input
                  type="email"
                  value={cmpForm.contactEmail}
                  onChange={(e) => setCmpForm((p) => ({ ...p, contactEmail: e.target.value }))}
                  placeholder="contact@domain.com"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Hourly BDT</label>
                <input
                  type="number"
                  min={500}
                  value={cmpForm.hourlyRateBdt}
                  onChange={(e) => setCmpForm((p) => ({ ...p, hourlyRateBdt: Number(e.target.value) }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Session BDT</label>
                <input
                  type="number"
                  min={1000}
                  value={cmpForm.sessionRateBdt}
                  onChange={(e) => setCmpForm((p) => ({ ...p, sessionRateBdt: Number(e.target.value) }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Verification Status</label>
                <select
                  value={cmpForm.verificationStatus}
                  onChange={(e) => setCmpForm((p) => ({ ...p, verificationStatus: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                >
                  <option value="approved">Approved (Verified)</option>
                  <option value="pending">Pending</option>
                  <option value="unverified">Unverified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <label className="flex items-center gap-2 font-semibold text-slate-800 py-2">
                <input
                  type="checkbox"
                  checked={cmpForm.isAvailableNow}
                  onChange={(e) => setCmpForm((p) => ({ ...p, isAvailableNow: e.target.checked }))}
                />
                Available Now
              </label>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Save Companion Admin Changes
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Companion</th>
                <th className="py-2 px-3">Location</th>
                <th className="py-2 px-3">Social & Contact</th>
                <th className="py-2 px-3">Rates</th>
                <th className="py-2 px-3">Verification</th>
                <th className="py-2 pl-3 text-right">Power Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companions.slice(0, 100).map((c) => (
                <tr key={c.uid} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {c.photoUrl ? (
                          <img
                            src={c.photoUrl}
                            alt={c.displayName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          'NO PIC'
                        )}
                      </div>
                      <span className="font-semibold text-slate-900">{c.displayName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{c.city} ({c.division || 'Dhaka'})</td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono">
                    {c.instagramHandle || '—'} · {c.whatsappNumber || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums">{formatBdt(c.hourlyRateBdt)}/hr</td>
                  <td className="py-2.5 px-3 capitalize font-semibold text-blue-700">{c.verificationStatus}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => openCompanionPowerEditor(c)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer"
                    >
                      Edit / Photo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Suspension / Reinstatement */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-950">Customer & Companion Account Control</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.slice(0, 15).map((u) => (
                <tr key={u.uid}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">{u.fullName}</td>
                  <td className="py-2.5 px-3 capitalize">{u.role}</td>
                  <td className="py-2.5 px-3 capitalize">{u.status}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleUserStatus(u.uid, u.status)}
                      className="px-2.5 py-1 border border-slate-300 rounded font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      {u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Support Tickets Queue + Website Content Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950">Support & Dispute Tickets</h2>
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-500">No open support tickets.</p>
          ) : (
            <div className="space-y-3">
              {tickets.slice(0, 6).map((t) => (
                <div key={t.id} className="p-3 border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="font-mono">{t.ticketCode}</span>
                    <span className="capitalize text-blue-700">{t.status}</span>
                  </div>
                  <p className="font-medium text-slate-900">{t.subject}</p>
                  <p className="text-slate-600">{t.description}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyMap[t.id] || ''}
                      onChange={(e) => setReplyMap((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Admin resolution note..."
                      className="flex-1 border border-slate-200 rounded px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => replyTicket(t.id)}
                      className="px-3 py-1 bg-slate-900 text-white rounded font-semibold cursor-pointer"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={saveContent} className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950">Website Content Management</h2>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Announcement Banner</label>
            <input
              type="text"
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Hero Headline Copy</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Safety Helpline Notice</label>
            <input
              type="text"
              value={safetyNote}
              onChange={(e) => setSafetyNote(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Publish Content Updates
          </button>
        </form>
      </div>

      {/* Admin Dynamic Bengali Booking Categories Manager */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950">
              Booking Categories Manager (বাংলা ও English — Admin Control)
            </h2>
            <p className="text-xs text-slate-500">
              Add or remove booking categories shown to customers in Booking Checkout & Explore filters (18+ peaceful social companionship only).
            </p>
          </div>
          <span className="text-xs font-mono text-blue-700">{categoriesList.length} categories live</span>
        </div>

        <form onSubmit={handleAddAdminCategory} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newCategoryInput}
            onChange={(e) => setNewCategoryInput(e.target.value)}
            placeholder="নতুন বাংলা/English ক্যাটাগরি লিখুন (যেমন: রিক্সা ও ক্যাম্পাস আড্ডা)..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-950 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            Add Category
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {categoriesList.map((cat) => (
            <div
              key={cat}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <span>{cat}</span>
              <button
                type="button"
                onClick={() => handleRemoveAdminCategory(cat)}
                className="text-red-600 hover:text-red-800 font-bold cursor-pointer"
                title="Remove category"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

// Page 18: Admin Management & RBAC Matrix (Protected Root Super Admin Rules)
export function AdminManagementPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<{ key: string; category: string; description: string }[]>([]);

  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('super_admin');
  const [issuedCredentials, setIssuedCredentials] = useState<{
    adminId: string;
    username: string;
    password: string;
  } | null>(null);

  // Edit / modify existing non-root admin account & individual powers
  const [editingAdmin, setEditingAdmin] = useState<AdminAccountRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('super_admin');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [useCustomPerms, setUseCustomPerms] = useState(false);

  const [notice, setNotice] = useState('');

  const loadData = async () => {
    try {
      const [accRes, roleRes] = await Promise.all([
        apiRequest<{ accounts: AdminAccountRecord[] }>('/api/admin/accounts'),
        apiRequest<{ roles: AdminRoleDefinition[]; permissions: any[] }>('/api/admin/roles'),
      ]);
      setAccounts(accRes.accounts || []);
      setRoles(roleRes.roles || []);
      setPermissions(roleRes.permissions || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateClientCredentials = () => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    const uname = `adm_${hex}`;

    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const pwBytes = new Uint8Array(16);
    crypto.getRandomValues(pwBytes);
    const pw = Array.from(pwBytes, (b) => charset[b % charset.length]).join('');

    setNewUsername(uname);
    setNewPassword(pw);
    if (!newName.trim()) {
      setNewName(`Admin ${hex.slice(0, 4).toUpperCase()}`);
    }
  };

  const createAdmin = async (e: React.FormEvent, useServerRandom = false) => {
    e.preventDefault();
    setNotice('');
    setIssuedCredentials(null);
    try {
      const res = await apiRequest<{
        adminId: string;
        username?: string;
        generatedPassword?: string;
      }>('/api/admin/accounts', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newName || 'LOGEASI Administrator',
          username: useServerRandom ? '' : newUsername,
          email: newEmail,
          phone: newPhone,
          password: useServerRandom ? '' : newPassword,
          role: newRole,
          generateRandom: useServerRandom || (!newEmail && !newPhone && !newUsername),
        }),
      });
      const shownUsername = res.username || newUsername;
      const shownPassword = res.generatedPassword || newPassword;
      if (shownUsername && shownPassword) {
        setIssuedCredentials({
          adminId: res.adminId,
          username: shownUsername,
          password: shownPassword,
        });
      }
      setNewName('');
      setNewUsername('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNotice(`Administrator ${res.adminId} created.`);
      loadData();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const toggleAdminStatus = async (adm: AdminAccountRecord) => {
    setNotice('');
    try {
      const next = adm.status === 'suspended' ? 'active' : 'suspended';
      await apiRequest(`/api/admin/accounts/${adm.uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      loadData();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const deleteAdmin = async (uid: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/accounts/${uid}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const toggleRolePermission = async (roleDef: AdminRoleDefinition, permKey: string) => {
    setNotice('');
    const has = roleDef.permissions.includes(permKey);
    const updated = has
      ? roleDef.permissions.filter((p) => p !== permKey)
      : [...roleDef.permissions, permKey];
    try {
      await apiRequest(`/api/admin/roles/${roleDef.roleKey}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: updated }),
      });
      loadData();
      setNotice(`Permissions updated for ${roleDef.label}.`);
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const openAdminEditor = (adm: AdminAccountRecord) => {
    setEditingAdmin(adm);
    setEditName(adm.fullName || '');
    setEditUsername(adm.username || '');
    setEditEmail(adm.email || '');
    setEditPhone(adm.phone || '');
    setEditRole(adm.role);
    setEditStatus(adm.status);
    setUseCustomPerms(Array.isArray(adm.customPermissions));
    setEditPerms(adm.customPermissions || adm.permissions || []);
  };

  const toggleEditAdminPerm = (permKey: string) => {
    setUseCustomPerms(true);
    setEditPerms((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const saveAdminEdits = async (e: React.FormEvent, regeneratePassword = false) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setNotice('');
    try {
      const res = await apiRequest<{ generatedPassword?: string }>(
        `/api/admin/accounts/${editingAdmin.uid}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: editName,
            username: editUsername,
            email: editEmail,
            phone: editPhone,
            role: editRole,
            status: editStatus,
            customPermissions: useCustomPerms ? editPerms : null,
            regeneratePassword,
          }),
        }
      );
      if (res.generatedPassword) {
        setIssuedCredentials({
          adminId: editingAdmin.adminId,
          username: editUsername || editingAdmin.username || editingAdmin.email || editingAdmin.adminId,
          password: res.generatedPassword,
        });
      }
      setNotice(`Administrator ${editingAdmin.adminId} account & powers updated.`);
      setEditingAdmin(null);
      loadData();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  return (
    <AdminShell activeTab="management" title="Admin Management & RBAC">
      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {issuedCredentials && (
        <div className="p-4 bg-slate-950 text-white border border-blue-500 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-mono text-blue-300 font-semibold">
              ONE-TIME ADMIN CREDENTIALS ({issuedCredentials.adminId}) — SAVE NOW
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(
                  `Username: ${issuedCredentials.username}\nPassword: ${issuedCredentials.password}`
                );
                setNotice('Copied admin username & password to clipboard.');
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" /> Copy Credentials
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-slate-900 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-400">Username: </span>
              <span className="text-white font-bold">{issuedCredentials.username}</span>
            </div>
            <div>
              <span className="text-slate-400">Password: </span>
              <span className="text-emerald-300 font-bold">{issuedCredentials.password}</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Additional Admin */}
      <form onSubmit={(e) => createAdmin(e, false)} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-slate-950">Create Additional Administrator</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateClientCredentials}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" /> Fill Random Username & Password
            </button>
            <button
              type="button"
              onClick={(e) => createAdmin(e, true)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Instant Random Admin
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            required
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full Name"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Admin Username (e.g. adm_8f2a1b)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Google / Admin Email (optional)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone (+880..., optional)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Initial Password (min 8 chars)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
          >
            <option value="super_admin">Super Admin / Administrator</option>
            <option value="finance_admin">Finance Admin</option>
            <option value="support_admin">Customer Support Admin</option>
            <option value="verification_admin">Verification Admin</option>
            <option value="content_manager">Content Manager</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          Provision Admin Account
        </button>
      </form>

      {/* Admin Roster */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-slate-950">Administrator Accounts ({accounts.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Admin ID</th>
                <th className="py-2 px-3">Name, Username & Contact</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Protection</th>
                <th className="py-2 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.uid}>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">{a.adminId}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-900">{a.fullName}</p>
                    <p className="text-slate-500 font-mono">
                      {a.username ? `@${a.username}` : ''}{a.username && (a.email || a.phone) ? ' · ' : ''}{a.email || a.phone}
                    </p>
                  </td>
                  <td className="py-2.5 px-3 capitalize">
                    {a.role.replace(/_/g, ' ')}
                    {Array.isArray(a.customPermissions) && (
                      <span className="ml-1.5 text-[10px] font-mono text-blue-700">(Custom Powers)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {a.isRootOwner ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                        <Lock className="w-3.5 h-3.5" /> Protected Root Owner
                      </span>
                    ) : (
                      <span className="capitalize text-slate-600">{a.status}</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right space-x-2">
                    {a.isRootOwner ? (
                      <span className="text-[11px] font-mono text-slate-400">IMMUTABLE</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openAdminEditor(a)}
                          className="px-2.5 py-1 bg-slate-900 text-white rounded font-semibold cursor-pointer"
                        >
                          Edit / Powers
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAdminStatus(a)}
                          className="px-2.5 py-1 border border-slate-300 rounded font-semibold cursor-pointer"
                        >
                          {a.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAdmin(a.uid)}
                          className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modify Existing Admin Account & Individual Admin Powers */}
      {editingAdmin && (
        <form
          onSubmit={(e) => saveAdminEdits(e, false)}
          className="bg-slate-50 border-2 border-blue-700 rounded-xl p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <p className="text-[11px] font-mono text-blue-700 font-semibold">
                MODIFY ADMIN ACCOUNT & INDIVIDUAL POWERS ({editingAdmin.adminId})
              </p>
              <h3 className="font-display text-lg font-bold text-slate-950">
                Editing: {editingAdmin.fullName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => saveAdminEdits(e, true)}
                className="px-3 py-1.5 bg-slate-950 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" /> Rotate Random Password
              </button>
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Full Name</label>
              <input
                required
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Username</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Admin Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Role</label>
              <select
                value={editRole}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setEditRole(nextRole);
                  if (!useCustomPerms) {
                    const found = roles.find((r) => r.roleKey === nextRole);
                    if (found) setEditPerms(found.permissions);
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="super_admin">Super Admin / Administrator</option>
                <option value="finance_admin">Finance Admin</option>
                <option value="support_admin">Customer Support Admin</option>
                <option value="verification_admin">Verification Admin</option>
                <option value="content_manager">Content Manager</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Individual Admin Powers ({useCustomPerms ? 'Custom Override Active' : 'Using Role Defaults'})
                </p>
                <p className="text-[11px] text-slate-500">
                  Toggle specific powers for this administrator account independently of their base role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseCustomPerms(false);
                  const found = roles.find((r) => r.roleKey === editRole);
                  setEditPerms(found?.permissions || []);
                }}
                className="px-2.5 py-1 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer"
              >
                Reset to Role Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {permissions.map((p) => {
                const isRootOnlyPerm = [
                  'manage_platform_config',
                  'customize_role_permissions',
                  'manage_backups',
                ].includes(p.key);
                const disabled = isRootOnlyPerm && !user?.isRootOwner;
                return (
                  <label
                    key={p.key}
                    className={`flex items-center gap-2 ${disabled ? 'text-slate-400' : 'text-slate-800'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={editPerms.includes(p.key)}
                      onChange={() => toggleEditAdminPerm(p.key)}
                    />
                    <span className="truncate">{p.key.replace(/_/g, ' ')}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Save Admin Changes & Powers
          </button>
        </form>
      )}

      {/* Customizable RBAC Permission Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-700" /> RBAC Role Permission Matrix
          </h2>
          <span className="text-xs text-slate-500">
            {user?.isRootOwner ? 'Root Super Admin can customize non-root role permissions' : 'Read-only view'}
          </span>
        </div>

        <div className="space-y-4">
          {roles
            .filter((r) => r.roleKey !== 'root_super_admin')
            .map((r) => (
              <div key={r.roleKey} className="border border-slate-200 rounded-lg p-4 space-y-2.5">
                <p className="text-sm font-bold text-slate-900">{r.label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {permissions.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-slate-700">
                      <input
                        type="checkbox"
                        disabled={!user?.isRootOwner}
                        checked={r.permissions.includes(p.key)}
                        onChange={() => toggleRolePermission(r, p.key)}
                      />
                      <span className="truncate">{p.key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </AdminShell>
  );
}

// Page 19: Finance Dashboard
export function FinanceDashboardPage() {
  const { user, platformPublic, refreshPublicPlatform } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [payouts, setPayouts] = useState<CompanionPayoutRecord[]>([]);

  const [feePercent, setFeePercent] = useState(platformPublic.serviceFeePercent ?? 12);
  const [paymentMode, setPaymentMode] = useState<'sandbox' | 'live'>(
    (platformPublic.paymentMode as 'sandbox' | 'live') || 'sandbox'
  );
  const [merchantApproved, setMerchantApproved] = useState(Boolean(platformPublic.merchantApproved));
  const [cashEnabled, setCashEnabled] = useState(Boolean(platformPublic.cashPaymentEnabled ?? true));
  const [maxCash, setMaxCash] = useState(platformPublic.maxCashBookingBdt ?? 3000);
  const [bkashPersonal, setBkashPersonal] = useState(
    platformPublic.bkashPersonalNumber || '01700-000000'
  );
  const [nagadPersonal, setNagadPersonal] = useState(
    platformPublic.nagadPersonalNumber || '01877pokpok'
  );
  const [notice, setNotice] = useState('');

  const loadFinance = async () => {
    try {
      const res = await apiRequest<{
        payments: PaymentRecord[];
        refunds: RefundRecord[];
        payouts: CompanionPayoutRecord[];
      }>('/api/admin/finance');
      setPayments(res.payments || []);
      setRefunds(res.refunds || []);
      setPayouts(res.payouts || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

  useEffect(() => {
    if (platformPublic.bkashPersonalNumber) setBkashPersonal(platformPublic.bkashPersonalNumber);
    if (platformPublic.nagadPersonalNumber) setNagadPersonal(platformPublic.nagadPersonalNumber);
  }, [platformPublic]);

  const exportCsv = async () => {
    const csvText = await apiRequest<string>('/api/admin/payments/export-csv');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logeasi-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processRefund = async (id: string, status: 'processed' | 'rejected') => {
    await apiRequest(`/api/admin/refunds/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    setNotice(`Refund ${id} marked ${status}.`);
    loadFinance();
  };

  const processPayout = async (id: string, status: 'approved' | 'paid' | 'rejected') => {
    await apiRequest(`/api/admin/payouts/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    setNotice(`Payout ${id} marked ${status}.`);
    loadFinance();
  };

  const verifyPersonalTrx = async (id: string, decision: 'approve' | 'reject') => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/payments/${id}/verify-personal`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setNotice(`Personal payment ${id} ${decision === 'approve' ? 'verified & settled' : 'rejected'}.`);
      loadFinance();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const savePersonalNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/admin/personal-payment-numbers', {
        method: 'PUT',
        body: JSON.stringify({
          bkashPersonalNumber: bkashPersonal,
          nagadPersonalNumber: nagadPersonal,
        }),
      });
      await refreshPublicPlatform();
      setNotice('Personal bKash & Personal Nagad receiving numbers saved.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/admin/platform-settings', {
        method: 'PUT',
        body: JSON.stringify({
          serviceFeePercent: Number(feePercent),
          paymentMode,
          merchantApproved,
          cashPaymentEnabled: cashEnabled,
          maxCashBookingBdt: Number(maxCash),
          bkashPersonalNumber: bkashPersonal,
          nagadPersonalNumber: nagadPersonal,
        }),
      });
      await refreshPublicPlatform();
      setNotice('Platform financial configuration saved.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const pendingPersonal = payments.filter((p) => p.status === 'pending_manual_verification');

  return (
    <AdminShell activeTab="finance" title="Finance, Reconciliation & Payouts">
      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {/* Personal 1. bKash & 2. Nagad Receiving Numbers */}
      <form onSubmit={savePersonalNumbers} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-slate-950">
            Personal Payment Options (1. bKash Personal · 2. Nagad Personal)
          </h2>
          <span className="text-xs font-mono text-blue-700">Displayed on Checkout Page</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">1. bKash Personal Number</label>
            <input
              required
              type="text"
              value={bkashPersonal}
              onChange={(e) => setBkashPersonal(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">2. Nagad Personal Number</label>
            <input
              required
              type="text"
              value={nagadPersonal}
              onChange={(e) => setNagadPersonal(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          Update Personal Payment Numbers
        </button>
      </form>

      {/* Pending Personal bKash/Nagad TrxID Verification Queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-slate-950">
          Personal bKash / Nagad TrxID Verification Queue ({pendingPersonal.length})
        </h2>
        {pendingPersonal.length === 0 ? (
          <p className="text-xs text-slate-500">No pending manual personal MFS TrxID submissions.</p>
        ) : (
          <div className="space-y-2.5">
            {pendingPersonal.map((p) => (
              <div
                key={p.id}
                className="p-3.5 border border-blue-200 bg-blue-50/60 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-mono font-bold text-slate-950">
                    {p.gateway.toUpperCase()} PERSONAL · TrxID: {p.senderReferenceTrxId}
                  </p>
                  <p className="text-slate-600 font-mono">
                    {p.transactionId} · Booking {p.bookingCode || p.bookingId} · {formatBdt(p.amountBdt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => verifyPersonalTrx(p.id, 'approve')}
                    className="px-3 py-1.5 bg-blue-700 text-white font-semibold rounded-lg cursor-pointer"
                  >
                    Approve & Confirm Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyPersonalTrx(p.id, 'reject')}
                    className="px-3 py-1.5 border border-red-200 text-red-700 font-semibold rounded-lg cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Root-only Fee & Payment Gateway Mode Config */}
      {user?.isRootOwner && (
        <form onSubmit={saveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950">
            Platform Fee & Payment Gateway Mode (Root Exclusive)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Service Fee (%)</label>
              <input
                type="number"
                min={0}
                max={35}
                value={feePercent}
                onChange={(e) => setFeePercent(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Gateway Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as 'sandbox' | 'live')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="sandbox">Sandbox / Test Mode</option>
                <option value="live">Live Merchant Mode</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Max Cash (BDT)</label>
              <input
                type="number"
                value={maxCash}
                onChange={(e) => setMaxCash(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="flex flex-col justify-end space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={merchantApproved}
                  onChange={(e) => setMerchantApproved(e.target.checked)}
                />
                <span>Merchant Approved</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cashEnabled}
                  onChange={(e) => setCashEnabled(e.target.checked)}
                />
                <span>Cash Permitted</span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Save Financial Policy
          </button>
        </form>
      )}

      {/* Transactions Reconciliation + CSV Download */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950">Payment Reconciliation Ledger</h2>
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV Report
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Transaction ID</th>
                <th className="py-2 px-3">Gateway</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3 text-right">Fee</th>
                <th className="py-2 px-3">Webhook</th>
                <th className="py-2 pl-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3 font-mono text-slate-900">{p.transactionId}</td>
                  <td className="py-2.5 px-3 uppercase">{p.gateway} ({p.mode})</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatBdt(p.amountBdt)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatBdt(p.platformFeeBdt)}</td>
                  <td className="py-2.5 px-3">{p.webhookVerified ? 'HMAC Verified' : 'Pending'}</td>
                  <td className="py-2.5 pl-3 capitalize">{p.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Approvals & Refund Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950">Companion Payout Requests</h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-slate-500">No payout requests.</p>
          ) : (
            payouts.map((p) => (
              <div key={p.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{p.companionName || p.companionUid}</p>
                  <p className="font-mono text-slate-600 uppercase">
                    {p.method} {p.accountMasked} · {formatBdt(p.amountBdt)} · {p.status}
                  </p>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => processPayout(p.id, 'paid')}
                      className="px-2.5 py-1 bg-blue-700 text-white rounded font-semibold cursor-pointer"
                    >
                      Mark Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => processPayout(p.id, 'rejected')}
                      className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950">Refund Requests</h2>
          {refunds.length === 0 ? (
            <p className="text-xs text-slate-500">No refund requests.</p>
          ) : (
            refunds.map((r) => (
              <div key={r.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{formatBdt(r.amountBdt)} — {r.status.toUpperCase()}</p>
                  <p className="text-slate-600">{r.reason}</p>
                </div>
                {r.status === 'requested' && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => processRefund(r.id, 'processed')}
                      className="px-2.5 py-1 bg-blue-700 text-white rounded font-semibold cursor-pointer"
                    >
                      Approve Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => processRefund(r.id, 'rejected')}
                      className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AdminShell>
  );
}

// Page 20: Security Dashboard
export function SecurityDashboardPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    apiRequest<{ logs: AuditLogRecord[] }>('/api/admin/audit-logs')
      .then((res) => setLogs(res.logs || []))
      .catch(() => {});
  }, []);

  const exportBackup = async () => {
    const token = getStoredSessionToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/admin/security/backup', {
      credentials: 'include',
      headers,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logeasi-disaster-recovery-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = logs.filter((l) => severityFilter === 'all' || l.severity === severityFilter);

  return (
    <AdminShell activeTab="security" title="Security Center & Audit Logs">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Password & Credential Security</p>
          <p className="text-sm font-bold text-slate-950 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Bcrypt (12 rounds) + AES-256-GCM
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Webhook & Session Integrity</p>
          <p className="text-sm font-bold text-slate-950 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> HMAC-SHA256 + HttpOnly Cookies
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Disaster Recovery Backup</p>
            <p className="text-xs text-slate-700 mt-0.5">Full JSON snapshot export</p>
          </div>
          {user?.isRootOwner && (
            <button
              type="button"
              onClick={exportBackup}
              className="px-3 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Export Backup
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950">Immutable Audit Logs</h2>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            {['all', 'info', 'warning', 'critical'].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded capitalize cursor-pointer ${
                  severityFilter === sev ? 'bg-white font-semibold text-slate-950 shadow-sm' : 'text-slate-600'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 pl-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString('en-BD')}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{l.action}</td>
                  <td className="py-2.5 px-3 text-slate-700">{l.actorRole}</td>
                  <td className={`py-2.5 px-3 font-semibold uppercase ${
                    l.severity === 'critical' ? 'text-red-700' : l.severity === 'warning' ? 'text-amber-700' : 'text-slate-600'
                  }`}>
                    {l.severity}
                  </td>
                  <td className="py-2.5 pl-3 text-slate-700">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
