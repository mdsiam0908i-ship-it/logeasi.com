import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Key,
  KeyRound,
  LocateFixed,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  Plus,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Shuffle,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DeveloperBanner } from '../components/DeveloperBanner.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { PathaoLiveMap } from '../components/PathaoLiveMap.tsx';
import { PaymentGatewayLogo } from '../components/PaymentGatewayLogo.tsx';
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
  BookingMessage,
  BookingRecord,
  CompanionApplicationRecord,
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
  const [showPassword, setShowPassword] = useState(false);
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
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="অ্যাডমিন ইউজারনেম বা ইমেইল (যেমন: adm_46c6f85e)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="অ্যাডমিন পাসওয়ার্ড"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

      <div className="mt-6">
        <DeveloperBanner variant="card" />
      </div>
    </main>
  );
}

// Page 17: Root Admin Dashboard
export function RootAdminDashboardPage() {
  const { platformPublic, currentPath, refreshPublicPlatform } = useAuth();
  const [days, setDays] = useState('30');
  const [overview, setOverview] = useState<any>(null);
  const [verifications, setVerifications] = useState<VerificationRequestRecord[]>([]);
  const [applications, setApplications] = useState<CompanionApplicationRecord[]>([]);
  const [appCredInputs, setAppCredInputs] = useState<Record<string, { email: string; password: string }>>({});
  const [issuedCompanionCreds, setIssuedCompanionCreds] = useState<{
    uid: string;
    fullName: string;
    whatsappNumber: string;
    email: string;
    issuedPassword: string;
  } | null>(null);
  const [showDirectCreateCmp, setShowDirectCreateCmp] = useState(false);
  const [newCmpForm, setNewCmpForm] = useState({
    fullName: '',
    email: '',
    password: '',
    whatsappNumber: '',
    division: 'Dhaka',
    city: 'Dhaka',
    dateOfBirth: '2000-01-01',
    hourlyRateBdt: 1800,
    sessionRateBdt: 4500,
    bio: '',
    photoUrl: '',
  });
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
  const [reports, setReports] = useState<any[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [banner, setBanner] = useState(platformPublic.announcementBanner || '');
  const [safetyNote, setSafetyNote] = useState(platformPublic.safetyNotice || '');
  const [headline, setHeadline] = useState(platformPublic.featuredHeadline || '');
  const [noticeBoardTitle, setNoticeBoardTitle] = useState(
    platformPublic.noticeBoardTitle || 'জরুরি নোটিশ বোর্ড — LOGEASI.COM'
  );
  const [noticeBoardMessage, setNoticeBoardMessage] = useState(
    platformPublic.noticeBoardMessage || ''
  );
  const [adminContactUsername, setAdminContactUsername] = useState(
    platformPublic.adminContactUsername || 'sheik_siam0077'
  );
  const [adminContactEmail, setAdminContactEmail] = useState(
    platformPublic.adminContactEmail || 'mdsiam0908i@gmail.com'
  );
  const [adminContactInstagram, setAdminContactInstagram] = useState(
    platformPublic.adminContactInstagram || '@sheik_siam0077'
  );
  const [categoriesList, setCategoriesList] = useState<string[]>(
    platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0
      ? platformPublic.bookingCategories
      : DEFAULT_BENGALI_BOOKING_CATEGORIES
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<'success' | 'error'>('success');
  const [busyActionId, setBusyActionId] = useState('');

  // User & Companion control table filters (no truncation)
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'customer' | 'companion' | 'unverified'>('all');

  // Read-Only Admin Live Location & Customer-Companion Discussion Monitor state
  const [dispatchBookingId, setDispatchBookingId] = useState<string>(() => {
    const q = currentPath.includes('?') ? currentPath.split('?')[1] : '';
    return new URLSearchParams(q).get('dispatchBooking') || '';
  });
  const [monitorMessages, setMonitorMessages] = useState<BookingMessage[]>([]);
  const [monitorMessagesLoading, setMonitorMessagesLoading] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setNoticeType(type);
    setNotice(msg);
  };

  useEffect(() => {
    const q = currentPath.includes('?') ? currentPath.split('?')[1] : '';
    const requestedDispatch = new URLSearchParams(q).get('dispatchBooking');
    if (requestedDispatch) {
      setDispatchBookingId(requestedDispatch);
    }
  }, [currentPath]);

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
    apiRequest<{ applications: CompanionApplicationRecord[] }>('/api/admin/companion-applications')
      .then((r) => setApplications(r.applications || []))
      .catch(() => {});
    apiRequest<{ users: UserAccount[] }>('/api/admin/users')
      .then((r) => setUsers(r.users || []))
      .catch(() => {});
    apiRequest<{ companions: CompanionProfile[] }>('/api/admin/companions')
      .then((r) => setCompanions(r.companions || []))
      .catch(() => {});
    apiRequest<{ bookings: BookingRecord[] }>('/api/admin/bookings')
      .then((r) => {
        const list = r.bookings || [];
        setBookings(list);
        if (!dispatchBookingId && list.length > 0) {
          const prioritized =
            list.find((b) => b.advanceStatus === 'paid' || b.advanceStatus === 'pending_verification') ||
            list[0];
          setDispatchBookingId(prioritized.id);
        }
      })
      .catch(() => {});
    apiRequest<{ tickets: SupportTicketRecord[]; reports?: any[] }>('/api/admin/tickets')
      .then((r) => {
        setTickets(r.tickets || []);
        setReports(r.reports || []);
      })
      .catch(() => {});
  };

  const toWaDigits = (raw?: string) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('01') ? `88${digits}` : digits;
  };

  const approveApplicationAndCreate = async (app: CompanionApplicationRecord) => {
    setNotice('');
    setBusyActionId(`app_ok_${app.id}`);
    try {
      const creds = appCredInputs[app.id] || { email: '', password: '' };
      const res = await apiRequest<{
        companionUid: string;
        issuedPassword: string;
        email: string;
      }>(`/api/admin/companion-applications/${app.id}/approve-create`, {
        method: 'POST',
        body: JSON.stringify({
          email: creds.email?.trim() || app.contactEmail || undefined,
          password: creds.password?.trim() || undefined,
        }),
      });
      setIssuedCompanionCreds({
        uid: res.companionUid,
        fullName: app.fullName,
        whatsappNumber: app.whatsappNumber,
        email: res.email,
        issuedPassword: res.issuedPassword,
      });
      showToast(
        `${app.fullName}-এর সঙ্গী অ্যাকাউন্ট তৈরি হয়েছে! নিচে থাকা ইমেইল ও পাসওয়ার্ডটি WhatsApp-এ বুঝিয়ে দিন।`,
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'সঙ্গী আবেদন অনুমোদন ও অ্যাকাউন্ট তৈরি ব্যর্থ হয়েছে।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const rejectApplication = async (app: CompanionApplicationRecord) => {
    setNotice('');
    setBusyActionId(`app_rej_${app.id}`);
    try {
      await apiRequest(`/api/admin/companion-applications/${app.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ adminNote: 'অ্যাডমিন পোর্টাল থেকে আবেদন প্রত্যাখ্যাত হয়েছে।' }),
      });
      showToast(`${app.fullName}-এর সঙ্গী আবেদন প্রত্যাখ্যান করা হয়েছে।`, 'success');
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'আবেদন প্রত্যাখ্যান করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const createCompanionDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    setBusyActionId('direct_cmp_create');
    try {
      const res = await apiRequest<{
        companionUid: string;
        email: string;
        issuedPassword: string;
      }>('/api/admin/companions/create', {
        method: 'POST',
        body: JSON.stringify(newCmpForm),
      });
      setIssuedCompanionCreds({
        uid: res.companionUid,
        fullName: newCmpForm.fullName,
        whatsappNumber: newCmpForm.whatsappNumber,
        email: res.email,
        issuedPassword: res.issuedPassword,
      });
      setShowDirectCreateCmp(false);
      setNewCmpForm({
        fullName: '',
        email: '',
        password: '',
        whatsappNumber: '',
        division: 'Dhaka',
        city: 'Dhaka',
        dateOfBirth: '2000-01-01',
        hourlyRateBdt: 1800,
        sessionRateBdt: 4500,
        bio: '',
        photoUrl: '',
      });
      showToast('নতুন সঙ্গী অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! নিচে থেকে WhatsApp-এ ক্রেডেনশিয়াল পাঠান।', 'success');
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'নতুন সঙ্গী অ্যাকাউন্ট তৈরি করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const settleCompanionViaWhatsapp = async (c: CompanionProfile) => {
    setNotice('');
    const totalPayable = Math.max(0, (c.availableBalanceBdt || 0) + (c.pendingBalanceBdt || 0));
    setBusyActionId(`settle_wa_${c.uid}`);
    try {
      const res = await apiRequest<{ payout: CompanionPayoutRecord }>(
        `/api/admin/companions/${c.uid}/settle-whatsapp`,
        {
          method: 'POST',
          body: JSON.stringify({
            amountBdt: totalPayable > 0 ? totalPayable : undefined,
            note: `WhatsApp (${c.whatsappNumber || 'যোগাযোগ'})-এর মাধ্যমে অ্যাডমিন টাকা বুঝিয়ে দিয়েছেন।`,
          }),
        }
      );
      showToast(
        `${c.displayName}-কে ${formatBdt(res.payout?.amountBdt || totalPayable)} অ্যাডমিন WhatsApp সেটেলমেন্ট হিসেবে বুঝিয়ে দেওয়া হয়েছে।`,
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'WhatsApp সেটেলমেন্ট সম্পন্ন করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  useEffect(() => {
    loadAll();
  }, [days]);

  const selectedDispatchBooking =
    bookings.find((b) => b.id === dispatchBookingId) || bookings[0] || null;

  const loadMonitorMessages = async (bookingId: string) => {
    if (!bookingId) return;
    try {
      const res = await apiRequest<{ messages: BookingMessage[] }>(`/api/bookings/${bookingId}/messages`);
      setMonitorMessages(res.messages || []);
    } catch {
      setMonitorMessages([]);
    }
  };

  useEffect(() => {
    if (!selectedDispatchBooking?.id) {
      setMonitorMessages([]);
      return;
    }
    setMonitorMessagesLoading(true);
    loadMonitorMessages(selectedDispatchBooking.id).finally(() => setMonitorMessagesLoading(false));
    const timer = window.setInterval(() => {
      loadMonitorMessages(selectedDispatchBooking.id);
      apiRequest<{ bookings: BookingRecord[] }>('/api/admin/bookings')
        .then((r) => setBookings(r.bookings || []))
        .catch(() => {});
    }, 6000);
    return () => window.clearInterval(timer);
  }, [selectedDispatchBooking?.id]);

  useEffect(() => {
    if (platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0) {
      setCategoriesList(platformPublic.bookingCategories);
    }
    if (platformPublic.noticeBoardTitle) setNoticeBoardTitle(platformPublic.noticeBoardTitle);
    if (platformPublic.noticeBoardMessage) setNoticeBoardMessage(platformPublic.noticeBoardMessage);
    if (platformPublic.adminContactUsername) setAdminContactUsername(platformPublic.adminContactUsername);
    if (platformPublic.adminContactEmail) setAdminContactEmail(platformPublic.adminContactEmail);
    if (platformPublic.adminContactInstagram) setAdminContactInstagram(platformPublic.adminContactInstagram);
  }, [platformPublic]);

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
    setBusyActionId(`cmp_${editingCompanion.uid}`);
    try {
      await apiRequest(`/api/admin/companions/${editingCompanion.uid}`, {
        method: 'PATCH',
        body: JSON.stringify(cmpForm),
      });
      showToast(`সঙ্গী ${cmpForm.displayName}-এর তথ্য অ্যাডমিন দ্বারা হালনাগাদ হয়েছে।`, 'success');
      setEditingCompanion(null);
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'সঙ্গীর তথ্য আপডেট করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const reviewVerification = async (id: string, decision: 'approved' | 'rejected') => {
    setNotice('');
    setBusyActionId(`ver_${id}`);
    try {
      await apiRequest(`/api/admin/verifications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reviewerNote: `অ্যাডমিন দ্বারা পর্যালোচিত (${decision})` }),
      });
      showToast(
        `১৮+ ভেরিফিকেশন (${id}) এখন ${decision === 'approved' ? 'অনুমোদিত' : 'বাতিল'} হয়েছে।`,
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'ভেরিফিকেশন আপডেট করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const toggleUserStatus = async (u: UserAccount) => {
    setNotice('');
    setBusyActionId(`usr_status_${u.uid}`);
    try {
      const next = u.status === 'suspended' ? 'active' : 'suspended';
      await apiRequest(`/api/admin/users/${u.uid}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: next }),
      });
      showToast(
        `${u.fullName} (${u.role})-এর অ্যাকাউন্ট ${next === 'suspended' ? 'স্থগিত' : 'পুনরায় সক্রিয়'} করা হয়েছে।`,
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(err.message || 'অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const toggleUserAdultVerify = async (u: UserAccount, decision: 'approved' | 'rejected') => {
    setNotice('');
    setBusyActionId(`usr_ver_${u.uid}`);
    try {
      await apiRequest(`/api/admin/users/${u.uid}/verify-adult`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      showToast(
        `${u.fullName}-এর ১৮+ পরিচয় যাচাই ${decision === 'approved' ? 'অনুমোদিত' : 'বাতিল'} করা হয়েছে।`,
        'success'
      );
      await loadAll();
    } catch (err: any) {
      showToast(err.message || '১৮+ পরিচয় যাচাই আপডেট করা যায়নি।', 'error');
    } finally {
      setBusyActionId('');
    }
  };

  const replyTicket = async (id: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/tickets/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ adminReply: replyMap[id] || 'সাপোর্ট টিম দ্বারা সমাধান করা হয়েছে।', status: 'resolved' }),
      });
      showToast(`সাপোর্ট টিকিট ${id} সমাধান করা হয়েছে।`, 'success');
      await loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const updateAdminBookingStatus = async (id: string, nextStatus: string) => {
    setNotice('');
    setBusyActionId(`bkg_${id}`);
    try {
      await apiRequest(`/api/admin/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast(`বুকিং ${id}-এর অবস্থা "${nextStatus}"-এ হালনাগাদ হয়েছে।`, 'success');
      await loadAll();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setBusyActionId('');
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
          noticeBoardTitle,
          noticeBoardMessage,
          adminContactUsername,
          adminContactEmail,
          adminContactInstagram,
        }),
      });
      await refreshPublicPlatform();
      setNotice('ওয়েবসাইট কন্টেন্ট ও নোটিশ বোর্ড তথ্য সফলভাবে হালনাগাদ হয়েছে।');
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
      setNotice('সব কাস্টমার ও সঙ্গীর জন্য বুকিং ক্যাটাগরি হালনাগাদ হয়েছে।');
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
    <AdminShell activeTab="dashboard" title="রুট ও অপারেশন ড্যাশবোর্ড">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600">বাংলাদেশ জুড়ে মার্কেটপ্লেসের লাইভ পরিসংখ্যান</p>
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
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-md p-3.5 rounded-xl shadow-lg border text-xs font-semibold flex items-start gap-3 ${
            noticeType === 'error'
              ? 'bg-red-950 text-red-100 border-red-700'
              : 'bg-slate-950 text-white border-blue-500'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span className="flex-1 leading-relaxed">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="নোটিশ বন্ধ করুন"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 12 KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: 'মোট কাস্টমার', val: kpis.totalCustomers ?? 0 },
          { label: 'মোট সঙ্গী', val: kpis.totalCompanions ?? 0 },
          { label: 'যাচাইকৃত সঙ্গী', val: kpis.verifiedCompanions ?? 0 },
          { label: 'অপেক্ষমাণ ভেরিফিকেশন', val: kpis.pendingVerifications ?? 0 },
          { label: 'চলমান বুকিং', val: kpis.activeBookings ?? 0 },
          { label: 'সম্পন্ন বুকিং', val: kpis.completedBookings ?? 0 },
          { label: 'বাতিল বুকিং', val: kpis.cancelledBookings ?? 0 },
          { label: 'মোট লেনদেন', val: formatBdt(kpis.totalVolumeBdt ?? 0) },
          { label: 'প্ল্যাটফর্ম আয়', val: formatBdt(kpis.platformRevenueBdt ?? 0) },
          { label: 'অপেক্ষমাণ পেআউট', val: kpis.pendingPayouts ?? 0 },
          { label: 'রিফান্ড অনুরোধ', val: kpis.refundRequests ?? 0 },
          { label: 'খোলা অভিযোগ', val: kpis.openComplaints ?? 0 },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="font-mono text-xl font-bold text-slate-950 tabular-nums mt-1">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Read-Only Admin Live Location & Customer-Companion Discussion Monitor (NO edit options) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-700" />
              কাস্টমার ↔ সঙ্গী লাইভ লোকেশন ও আলাপ-আলোচনা পর্যবেক্ষণ
            </h2>
            <p className="text-xs text-slate-600">
              কাস্টমার সরাসরি সঙ্গীকে লাইভ লোকেশন শেয়ার করেন এবং নিজেদের মধ্যে আলাপ-আলোচনা করেন। অ্যাডমিন এখান থেকে সব বিষয় জানবেন ও দেখবেন — কিন্তু কোনো এডিট বা হস্তক্ষেপ করবেন না।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 border border-slate-300 px-3 py-1 rounded-lg inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-700" /> শুধু দেখার অপশন (Read-Only · কোনো এডিট নেই)
            </span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg tabular-nums">
              {bookings.length} টি বুকিং
            </span>
          </div>
        </div>

        {bookings.length === 0 ? (
          <p className="text-xs text-slate-500">এখনো কোনো বুকিং পর্যবেক্ষণের জন্য আসেনি।</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {[...bookings]
                .sort((a, b) => {
                  const score = (x: BookingRecord) =>
                    (x.customerLiveLocation ? 4 : 0) +
                    (x.advanceStatus === 'paid' ? 2 : x.advanceStatus === 'pending_verification' ? 1 : 0);
                  return score(b) - score(a);
                })
                .map((b) => {
                  const active = selectedDispatchBooking?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setDispatchBookingId(b.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                        active
                          ? 'bg-slate-950 text-white border-slate-950'
                          : 'bg-slate-50/70 text-slate-900 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono font-bold">{b.bookingCode}</span>
                        <span
                          className={`font-semibold ${
                            active
                              ? 'text-emerald-300'
                              : b.advanceStatus === 'paid'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {b.advanceStatus === 'paid'
                            ? '৫০% পেইড'
                            : b.advanceStatus === 'pending_verification'
                              ? '৫০% যাচাই অপেক্ষায়'
                              : 'বুকিং চলমান'}
                        </span>
                      </div>
                      <p className="text-xs font-bold">
                        {b.customerName} ↔ {b.companionName}
                      </p>
                      <p className={`text-[11px] ${active ? 'text-slate-300' : 'text-slate-600'}`}>
                        {b.venueName} ({b.city}) · {formatBdt(b.agreedPriceBdt)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] pt-0.5">
                        <span className={active ? 'text-blue-300' : 'text-blue-700'}>
                          {b.customerLiveLocation
                            ? `📍 কাস্টমার লাইভ লোকেশন শেয়ার করেছেন`
                            : '📍 লাইভ লোকেশন এখনো শেয়ার হয়নি'}
                        </span>
                        {b.companionMilestoneStatus && b.companionMilestoneStatus !== 'pending' && (
                          <span className={active ? 'text-emerald-300' : 'text-emerald-700'}>
                            · 🧳 {b.companionMilestoneStatus}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>

            {selectedDispatchBooking && (
              <div className="lg:col-span-7 space-y-4">
                <PathaoLiveMap
                  title={`পর্যবেক্ষণ ম্যাপ (Read-Only) — ${selectedDispatchBooking.bookingCode}`}
                  city={selectedDispatchBooking.city}
                  division={selectedDispatchBooking.division}
                  venueName={selectedDispatchBooking.venueName}
                  customerLiveLocation={selectedDispatchBooking.customerLiveLocation}
                  meetupLocation={selectedDispatchBooking.meetupLocation}
                  adminDispatchedLocation={selectedDispatchBooking.adminDispatchedLocation}
                  adminInstruction={selectedDispatchBooking.adminLocationMessage}
                  locationStatus={selectedDispatchBooking.adminLocationStatus}
                  pickMode="view"
                  showLiveControls={false}
                  heightPx={270}
                />

                {/* Read-Only Customer <-> Companion Discussion Transcript */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-700" />
                      কাস্টমার ও সঙ্গীর আলাপ-আলোচনা (Read-Only ভিউ)
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">
                      {monitorMessages.length} টি মেসেজ · কোনো এডিট অপশন নেই
                    </span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3 h-56 overflow-y-auto space-y-2.5">
                    {monitorMessagesLoading && monitorMessages.length === 0 ? (
                      <p className="text-xs text-slate-400">আলাপ-আলোচনা লোড হচ্ছে...</p>
                    ) : monitorMessages.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        এই বুকিংয়ে এখনো কোনো আলোচনা বা লাইভ লোকেশন মেসেজ নেই।
                      </p>
                    ) : (
                      monitorMessages.map((m) => (
                        <div key={m.id} className="text-xs border-b border-slate-100 last:border-b-0 pb-2 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{m.senderName}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(m.createdAt).toLocaleString('bn-BD')}
                            </span>
                          </div>
                          <p className="text-slate-700 mt-0.5 whitespace-pre-line">{m.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    অ্যাডমিন শুধুমাত্র কাস্টমার ও সঙ্গীর লাইভ লোকেশন এবং আলোচনা জানতে ও দেখতে পারবেন; এখান থেকে কোনো পরিবর্তন বা মেসেজ পাঠানো যাবে না।
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Chart + Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950">পেমেন্ট গেটওয়ে ভলিউম (BDT)</h2>
          <div className="space-y-3">
            {gateways.map((g) => (
              <div key={g.gateway} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-800 inline-flex items-center gap-2 uppercase">
                    <PaymentGatewayLogo gateway={g.gateway} size="xs" />
                    {g.gateway} ({g.count} লেনদেন)
                  </span>
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
            <Activity className="w-4 h-4 text-blue-700" /> সাম্প্রতিক প্রশাসনিক কার্যক্রম
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

      {/* Companion Applications Queue + Admin Email/Password Provisioning & WhatsApp Handoff */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-700" /> সঙ্গী আবেদন অনুমোদন ও অ্যাকাউন্ট তৈরি (WhatsApp হস্তান্তর)
            </h2>
            <p className="text-xs text-slate-500">
              সঙ্গীরা সরাসরি অ্যাকাউন্ট খুলতে পারেন না। আবেদন যাচাই করে ইমেইল ও পাসওয়ার্ড তৈরি করুন এবং WhatsApp-এ বুঝিয়ে দিন।
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-amber-700 font-bold tabular-nums">
              অপেক্ষমাণ: {applications.filter((a) => a.status === 'pending').length} · মোট: {applications.length}
            </span>
            <button
              type="button"
              onClick={() => setShowDirectCreateCmp((v) => !v)}
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {showDirectCreateCmp ? 'ফর্ম বন্ধ করুন' : 'সরাসরি সঙ্গী অ্যাকাউন্ট তৈরি'}
            </button>
          </div>
        </div>

        {issuedCompanionCreds && (
          <div className="p-4 bg-emerald-950 text-white rounded-xl space-y-3 border border-emerald-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> নতুন সঙ্গী অ্যাকাউন্ট প্রস্তুত — WhatsApp-এ বুঝিয়ে দিন
                </p>
                <p className="text-sm font-bold">
                  {issuedCompanionCreds.fullName} ({issuedCompanionCreds.whatsappNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIssuedCompanionCreds(null)}
                className="text-xs text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-emerald-900/70 rounded-lg p-3 font-mono">
              <div>
                <span className="text-emerald-300 block text-[10px]">লগইন ইমেইল (Email)</span>
                <span className="font-bold select-all">{issuedCompanionCreds.email}</span>
              </div>
              <div>
                <span className="text-emerald-300 block text-[10px]">তৈরিকৃত পাসওয়ার্ড (Password)</span>
                <span className="font-bold select-all">{issuedCompanionCreds.issuedPassword}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = `LOGEASI.COM সঙ্গী অ্যাকাউন্ট অনুমোদিত হয়েছে!\nলগইন লিংক: ${window.location.origin}/auth\nইমেইল: ${issuedCompanionCreds.email}\nপাসওয়ার্ড: ${issuedCompanionCreds.issuedPassword}`;
                  navigator.clipboard?.writeText(text);
                  showToast('ইমেইল ও পাসওয়ার্ড ক্লিপবোর্ডে কপি করা হয়েছে।', 'success');
                }}
                className="px-3.5 py-2 bg-white text-slate-950 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> ইমেইল ও পাসওয়ার্ড কপি করুন
              </button>
              {toWaDigits(issuedCompanionCreds.whatsappNumber) && (
                <a
                  href={`https://wa.me/${toWaDigits(issuedCompanionCreds.whatsappNumber)}?text=${encodeURIComponent(
                    `আসসালামু আলাইকুম ${issuedCompanionCreds.fullName}, LOGEASI.COM-এ আপনার সঙ্গী আবেদন অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে!\n\nলগইন: ${window.location.origin}/auth\nইমেইল: ${issuedCompanionCreds.email}\nপাসওয়ার্ড: ${issuedCompanionCreds.issuedPassword}\n\nলগইন করে আপনার পোস্ট শেয়ার করুন ও বুকিং পরিচালনা করুন। পেমেন্ট অ্যাডমিনের মাধ্যমে রিসিভ হয়ে আপনার WhatsApp-এ বুঝিয়ে দেওয়া হবে।`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp-এ ক্রেডেনশিয়াল পাঠান
                </a>
              )}
            </div>
          </div>
        )}

        {showDirectCreateCmp && (
          <form
            onSubmit={createCompanionDirectly}
            className="p-5 bg-slate-50 border border-blue-200 rounded-xl space-y-4 text-xs"
          >
            <h3 className="font-display text-sm font-bold text-slate-950">
              অ্যাডমিন থেকে সরাসরি নতুন সঙ্গী অ্যাকাউন্ট তৈরি করুন
            </h3>
            <DevicePhotoPicker
              label="সঙ্গীর ছবি (ঐচ্ছিক)"
              value={newCmpForm.photoUrl}
              onChange={(photoUrl) => setNewCmpForm((p) => ({ ...p, photoUrl }))}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                type="text"
                value={newCmpForm.fullName}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="সঙ্গীর পুরো নাম *"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
              <input
                required
                type="tel"
                value={newCmpForm.whatsappNumber}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                placeholder="WhatsApp নম্বর (যেমন 017...) *"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
              <input
                type="date"
                value={newCmpForm.dateOfBirth}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
              <input
                required
                type="email"
                value={newCmpForm.email}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="সঙ্গী লগইন ইমেইল *"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
              <input
                type="text"
                value={newCmpForm.password}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="পাসওয়ার্ড (ফাঁকা রাখলে অটো তৈরি হবে)"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
              <select
                value={newCmpForm.division}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, division: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                {BANGLADESH_DIVISIONS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newCmpForm.city}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="শহর (যেমন Dhaka)"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
              <input
                type="number"
                min={500}
                value={newCmpForm.hourlyRateBdt}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, hourlyRateBdt: Number(e.target.value) }))}
                placeholder="ঘণ্টা রেট (BDT)"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
              <input
                type="number"
                min={1000}
                value={newCmpForm.sessionRateBdt}
                onChange={(e) => setNewCmpForm((p) => ({ ...p, sessionRateBdt: Number(e.target.value) }))}
                placeholder="সেশন রেট (BDT)"
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <textarea
              rows={2}
              value={newCmpForm.bio}
              onChange={(e) => setNewCmpForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="সঙ্গীর বায়ো / সংক্ষিপ্ত পরিচিতি"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              disabled={busyActionId === 'direct_cmp_create'}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg cursor-pointer disabled:opacity-50"
            >
              {busyActionId === 'direct_cmp_create'
                ? 'অ্যাকাউন্ট তৈরি হচ্ছে...'
                : 'ভেরিফায়েড সঙ্গী অ্যাকাউন্ট তৈরি ও পাসওয়ার্ড জেনারেট করুন'}
            </button>
          </form>
        )}

        {applications.length === 0 ? (
          <p className="text-xs text-slate-500">
            এখনো কোনো সঙ্গী আবেদন জমা হয়নি। উপরের বাটন দিয়ে সরাসরি সঙ্গী অ্যাকাউন্ট তৈরি করতে পারবেন অথবা /become-companion থেকে আবেদন এলে এখানে দেখাবে।
          </p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const waDigits = toWaDigits(app.whatsappNumber);
              const credInput = appCredInputs[app.id] || {
                email: app.contactEmail || '',
                password: '',
              };
              const busyApprove = busyActionId === `app_ok_${app.id}`;
              const busyReject = busyActionId === `app_rej_${app.id}`;
              return (
                <div
                  key={app.id}
                  className={`p-4 rounded-xl border text-xs space-y-3 ${
                    app.status === 'pending'
                      ? 'bg-amber-50/40 border-amber-200'
                      : app.status === 'approved'
                        ? 'bg-emerald-50/30 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {app.photoUrl && (
                        <img
                          src={app.photoUrl}
                          alt={app.fullName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-lg object-cover object-top border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-950">{app.fullName}</span>
                          <span className="font-mono text-[11px] text-slate-500">({app.calculatedAge} বছর)</span>
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                              app.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : app.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {app.status === 'approved'
                              ? 'অ্যাকাউন্ট তৈরি সম্পন্ন'
                              : app.status === 'rejected'
                                ? 'প্রত্যাখ্যাত'
                                : 'অপেক্ষমাণ'}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          {app.city} ({app.division}) · রেট: {formatBdt(app.hourlyRateBdt)}/ঘণ্টা · {formatBdt(app.sessionRateBdt)}/সেশন
                        </p>
                        <p className="text-slate-700">{app.bio}</p>
                        {app.issuedEmail && (
                          <p className="font-mono text-[11px] text-emerald-800">
                            প্রদত্ত লগইন ইমেইল: {app.issuedEmail}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {waDigits && (
                        <a
                          href={`https://wa.me/${waDigits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> WhatsApp ({app.whatsappNumber})
                        </a>
                      )}
                    </div>
                  </div>

                  {app.status === 'pending' && (
                    <div className="pt-2 border-t border-amber-200/70 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="email"
                        value={credInput.email}
                        onChange={(e) =>
                          setAppCredInputs((prev) => ({
                            ...prev,
                            [app.id]: { ...credInput, email: e.target.value },
                          }))
                        }
                        placeholder="তৈরিকৃত ইমেইল (ফাঁকা থাকলে অটো)"
                        className="sm:col-span-4 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono"
                      />
                      <input
                        type="text"
                        value={credInput.password}
                        onChange={(e) =>
                          setAppCredInputs((prev) => ({
                            ...prev,
                            [app.id]: { ...credInput, password: e.target.value },
                          }))
                        }
                        placeholder="তৈরিকৃত পাসওয়ার্ড (ফাঁকা থাকলে শক্তিশালী পাসওয়ার্ড)"
                        className="sm:col-span-4 bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono"
                      />
                      <div className="sm:col-span-4 flex flex-wrap gap-2 justify-end">
                        <button
                          type="button"
                          disabled={busyApprove || busyReject}
                          onClick={() => approveApplicationAndCreate(app)}
                          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          {busyApprove ? 'তৈরি হচ্ছে...' : 'অনুমোদন ও অ্যাকাউন্ট তৈরি'}
                        </button>
                        <button
                          type="button"
                          disabled={busyApprove || busyReject}
                          onClick={() => rejectApplication(app)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg cursor-pointer disabled:opacity-50"
                        >
                          প্রত্যাখ্যান
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 18+ Verification Queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950">১৮+ পরিচয় যাচাই অনুমোদন</h2>
            <p className="text-xs text-slate-500">
              নতুন NID / স্কুল রোল আবেদন অনুমোদন বা বাতিল করুন। অনুমোদন করলে ব্যবহারকারী ও সঙ্গী প্রোফাইল উভয়ই সাথে সাথে ভেরিফায়েড হবে।
            </p>
          </div>
          <span className="text-xs font-mono text-amber-700 font-bold tabular-nums">
            অপেক্ষমাণ: {verifications.filter((v) => v.status === 'pending').length} টি · মোট: {verifications.length} টি
          </span>
        </div>
        {verifications.length === 0 ? (
          <p className="text-xs text-slate-500">এখনো কোনো ১৮+ ভেরিফিকেশন আবেদন নেই। নিচের কাস্টমার ও সঙ্গী তালিকা থেকেও সরাসরি ১৮+ অনুমোদন দিতে পারবেন।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">আবেদনকারী</th>
                  <th className="py-2 px-3">ডকুমেন্ট (NID / রোল)</th>
                  <th className="py-2 px-3">বয়স</th>
                  <th className="py-2 px-3">অবস্থা</th>
                  <th className="py-2 pl-3 text-right">সিদ্ধান্ত</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verifications.map((v) => {
                  const rowBusy = busyActionId === `ver_${v.id}`;
                  return (
                    <tr key={v.id} className={v.status === 'pending' ? 'bg-amber-50/40' : ''}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">
                        {v.fullName} ({v.city})
                      </td>
                      <td className="py-2.5 px-3 font-mono uppercase">
                        {v.documentType.replace(/_/g, ' ')} {v.documentNumberMasked}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">{v.calculatedAge} বছর</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            v.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : v.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {v.status === 'approved'
                            ? 'অনুমোদিত'
                            : v.status === 'rejected'
                              ? 'বাতিল'
                              : 'অপেক্ষমাণ'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right space-x-2">
                        <button
                          type="button"
                          disabled={rowBusy || v.status === 'approved'}
                          onClick={() => reviewVerification(v.id, 'approved')}
                          className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded font-semibold cursor-pointer disabled:opacity-45"
                        >
                          {rowBusy ? '...' : 'অনুমোদন'}
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || v.status === 'rejected'}
                          onClick={() => reviewVerification(v.id, 'rejected')}
                          className="px-2.5 py-1 border border-red-200 text-red-700 hover:bg-red-50 rounded font-semibold cursor-pointer disabled:opacity-45"
                        >
                          {rowBusy ? '...' : 'বাতিল'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Companion Directory & Contact Power Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-700" /> সঙ্গী ডিরেক্টরি ও অ্যাডমিন পাওয়ার কন্ট্রোল
            </h2>
            <p className="text-xs text-slate-500">
              যেকোনো সঙ্গীর ছবি, Instagram, WhatsApp, Email, ভেরিফিকেশন অবস্থা, রেট ও প্রাপ্যতা সরাসরি পরিবর্তন করুন।
            </p>
          </div>
          <span className="text-xs font-mono text-blue-700">{companions.length} জন সঙ্গী</span>
        </div>

        {editingCompanion && (
          <form
            onSubmit={saveCompanionPowerEdits}
            className="bg-slate-50 border-2 border-blue-700 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-[11px] font-mono text-blue-700 font-bold">
                  অ্যাডমিন সঙ্গী পাওয়ার এডিটর ({editingCompanion.uid})
                </p>
                <h3 className="font-display text-base font-bold text-slate-950">
                  সম্পাদনা চলছে: {editingCompanion.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCompanion(null)}
                className="px-3 py-1 border border-slate-300 bg-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                বাতিল
              </button>
            </div>

            <DevicePhotoPicker
              label="সঙ্গীর ছবি (ডিভাইস থেকে যুক্ত / পরিবর্তন করুন)"
              helperText="ফোন বা কম্পিউটার থেকে সরাসরি সঙ্গীর ছবি আপলোড করুন — কোনো ইমেজ URL লাগবে না।"
              value={cmpForm.photoUrl}
              onChange={(photoUrl) => setCmpForm((p) => ({ ...p, photoUrl }))}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">প্রদর্শিত নাম</label>
                <input
                  required
                  type="text"
                  value={cmpForm.displayName}
                  onChange={(e) => setCmpForm((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">বিভাগ</label>
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
                <label className="font-semibold text-slate-700">শহর / জেলা</label>
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
                <label className="font-semibold text-slate-700">ইনস্টাগ্রাম হ্যান্ডেল</label>
                <input
                  type="text"
                  value={cmpForm.instagramHandle}
                  onChange={(e) => setCmpForm((p) => ({ ...p, instagramHandle: e.target.value }))}
                  placeholder="@username"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">হোয়াটসঅ্যাপ নম্বর</label>
                <input
                  type="text"
                  value={cmpForm.whatsappNumber}
                  onChange={(e) => setCmpForm((p) => ({ ...p, whatsappNumber: e.target.value }))}
                  placeholder="+88017..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">পাবলিক যোগাযোগের ইমেইল</label>
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
                <label className="font-semibold text-slate-700">ঘণ্টাপ্রতি BDT</label>
                <input
                  type="number"
                  min={500}
                  value={cmpForm.hourlyRateBdt}
                  onChange={(e) => setCmpForm((p) => ({ ...p, hourlyRateBdt: Number(e.target.value) }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">সেশন BDT</label>
                <input
                  type="number"
                  min={1000}
                  value={cmpForm.sessionRateBdt}
                  onChange={(e) => setCmpForm((p) => ({ ...p, sessionRateBdt: Number(e.target.value) }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">ভেরিফিকেশন অবস্থা</label>
                <select
                  value={cmpForm.verificationStatus}
                  onChange={(e) => setCmpForm((p) => ({ ...p, verificationStatus: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
                >
                  <option value="approved">অনুমোদিত (ভেরিফায়েড)</option>
                  <option value="pending">অপেক্ষমাণ (Pending)</option>
                  <option value="unverified">অযাচাইকৃত</option>
                  <option value="rejected">বাতিল</option>
                </select>
              </div>
              <label className="flex items-center gap-2 font-semibold text-slate-800 py-2">
                <input
                  type="checkbox"
                  checked={cmpForm.isAvailableNow}
                  onChange={(e) => setCmpForm((p) => ({ ...p, isAvailableNow: e.target.checked }))}
                />
                এখনই উপলব্ধ
              </label>
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              অ্যাডমিন পরিবর্তন সংরক্ষণ করুন
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">সঙ্গী</th>
                <th className="py-2 px-3">অবস্থান</th>
                <th className="py-2 px-3">সোশ্যাল ও যোগাযোগ</th>
                <th className="py-2 px-3">রেট ও পাওনা</th>
                <th className="py-2 px-3">ভেরিফিকেশন</th>
                <th className="py-2 pl-3 text-right">পাওয়ার ও পেআউট অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companions.slice(0, 100).map((c) => {
                const payableBdt = (c.availableBalanceBdt || 0) + (c.pendingBalanceBdt || 0);
                const cmpWaDigits = toWaDigits(c.whatsappNumber);
                return (
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
                          'ছবি নেই'
                        )}
                      </div>
                      <span className="font-semibold text-slate-900">{c.displayName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{c.city} ({c.division || 'Dhaka'})</td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-600 font-mono">
                    {c.instagramHandle || '—'} · {c.whatsappNumber || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums">
                    <div>{formatBdt(c.hourlyRateBdt)}/ঘণ্টা</div>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      পাওনা: {formatBdt(payableBdt)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 capitalize font-semibold text-blue-700">{c.verificationStatus}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      {cmpWaDigits && (
                        <a
                          href={`https://wa.me/${cmpWaDigits}?text=${encodeURIComponent(
                            `আসসালামু আলাইকুম ${c.displayName}, LOGEASI.COM অ্যাডমিন টিম থেকে আপনার বুকিং ও পেআউট (${formatBdt(payableBdt)}) নিয়ে যোগাযোগ করছি।`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                      {payableBdt > 0 && (
                        <button
                          type="button"
                          disabled={busyActionId === `settle_wa_${c.uid}`}
                          onClick={() => settleCompanionViaWhatsapp(c)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {busyActionId === `settle_wa_${c.uid}` ? 'সেটেল হচ্ছে...' : 'টাকা বুঝিয়ে দিন'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openCompanionPowerEditor(c)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer"
                      >
                        সম্পাদনা / ছবি
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Suspension / Reinstatement & Direct 18+ Verification Controls (ALL accounts, searchable) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950">কাস্টমার ও সঙ্গী অ্যাকাউন্ট নিয়ন্ত্রণ</h2>
            <p className="text-xs text-slate-500">
              সব কাস্টমার ও সঙ্গী অ্যাকাউন্ট (মোট {users.length} টি) এখান থেকে ১৮+ অনুমোদন, স্থগিত অথবা পুনরায় সক্রিয় করুন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="নাম, ইমেইল বা ফোন দিয়ে খুঁজুন..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-56"
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value as any)}
              aria-label="ব্যবহারকারী ফিল্টার"
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white cursor-pointer"
            >
              <option value="all">সবাই ({users.length})</option>
              <option value="customer">শুধু কাস্টমার</option>
              <option value="companion">শুধু সঙ্গী</option>
              <option value="unverified">১৮+ অনুমোদন বাকি</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">নাম ও যোগাযোগ</th>
                <th className="py-2 px-3">ভূমিকা</th>
                <th className="py-2 px-3">১৮+ যাচাই</th>
                <th className="py-2 px-3">অবস্থা</th>
                <th className="py-2 pl-3 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users
                .filter((u) => {
                  if (userRoleFilter === 'customer' && u.role !== 'customer') return false;
                  if (userRoleFilter === 'companion' && u.role !== 'companion') return false;
                  if (userRoleFilter === 'unverified' && u.isAdultVerified18Plus) return false;
                  const q = userSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (u.fullName || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q) ||
                    (u.phone || '').toLowerCase().includes(q) ||
                    (u.username || '').toLowerCase().includes(q)
                  );
                })
                .map((u) => {
                  const statusBusy = busyActionId === `usr_status_${u.uid}`;
                  const verBusy = busyActionId === `usr_ver_${u.uid}`;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-900">{u.fullName}</p>
                        <p className="text-[11px] font-mono text-slate-500">
                          {u.email || u.phone || u.username || u.uid}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 capitalize font-medium">{u.role}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            u.isAdultVerified18Plus
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {u.isAdultVerified18Plus ? '১৮+ অনুমোদিত' : '১৮+ বাকি'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            u.status === 'suspended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {u.status === 'suspended' ? 'স্থগিত' : 'সক্রিয়'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={verBusy}
                          onClick={() =>
                            toggleUserAdultVerify(u, u.isAdultVerified18Plus ? 'rejected' : 'approved')
                          }
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer disabled:opacity-50 ${
                            u.isAdultVerified18Plus
                              ? 'border border-amber-300 text-amber-800 hover:bg-amber-50'
                              : 'bg-blue-700 hover:bg-blue-800 text-white'
                          }`}
                        >
                          {verBusy
                            ? '...'
                            : u.isAdultVerified18Plus
                              ? '১৮+ বাতিল'
                              : '১৮+ অনুমোদন'}
                        </button>
                        <button
                          type="button"
                          disabled={statusBusy}
                          onClick={() => toggleUserStatus(u)}
                          className={`px-2.5 py-1 border rounded font-semibold cursor-pointer disabled:opacity-50 ${
                            u.status === 'suspended'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-red-200 text-red-700 hover:bg-red-50'
                          }`}
                        >
                          {statusBusy ? '...' : u.status === 'suspended' ? 'পুনরায় সক্রিয়' : 'স্থগিত করুন'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bookings Monitor & Control */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-slate-950">বুকিং তদারকি ও অবস্থা নিয়ন্ত্রণ</h2>
          <span className="text-xs font-mono text-blue-700 tabular-nums">{bookings.length} টি বুকিং</span>
        </div>
        {bookings.length === 0 ? (
          <p className="text-xs text-slate-500">এখনো কোনো বুকিং রেকর্ড পাওয়া যায়নি।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">কোড</th>
                  <th className="py-2 px-3">কাস্টমার / সঙ্গী</th>
                  <th className="py-2 px-3">শহর / তারিখ</th>
                  <th className="py-2 px-3 text-right">মোট ফি</th>
                  <th className="py-2 px-3">অবস্থা</th>
                  <th className="py-2 pl-3 text-right">অ্যাডমিন নিয়ন্ত্রণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.slice(0, 20).map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">{b.bookingCode}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-900">{b.customerName}</span>
                      <span className="text-slate-400"> → </span>
                      <span className="text-slate-700">{b.companionName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono tabular-nums">
                      {b.city} · {b.bookingDate}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatBdt(b.agreedPriceBdt || b.proposedTotalBdt)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-700">{b.status}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <select
                        value={b.status}
                        onChange={(e) => updateAdminBookingStatus(b.id, e.target.value)}
                        aria-label={`বুকিং ${b.bookingCode} স্ট্যাটাস পরিবর্তন`}
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white cursor-pointer"
                      >
                        <option value="requested">requested</option>
                        <option value="accepted_awaiting_agreement">accepted_awaiting_agreement</option>
                        <option value="price_agreed_awaiting_payment">price_agreed_awaiting_payment</option>
                        <option value="payment_pending">payment_pending</option>
                        <option value="confirmed_paid">confirmed_paid</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                        <option value="disputed">disputed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Support Tickets Queue + Website Content Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950">সাপোর্ট টিকিট ও নিরাপত্তা রিপোর্ট</h2>
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-500">কোনো খোলা সাপোর্ট টিকিট নেই।</p>
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
                      placeholder="অ্যাডমিনের সমাধান নোট..."
                      className="flex-1 border border-slate-200 rounded px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => replyTicket(t.id)}
                      className="px-3 py-1 bg-slate-900 text-white rounded font-semibold cursor-pointer"
                    >
                      সমাধান
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {reports.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-bold text-red-700">নিরাপত্তা রিপোর্টসমূহ ({reports.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
                {reports.slice(0, 5).map((r, idx) => (
                  <div key={r.id || idx} className="p-2.5 bg-red-50/70 border border-red-200 rounded-lg">
                    <p className="font-mono font-semibold text-slate-900">
                      রিপোর্টেড: {r.reportedUid} · রিপোর্টার: {r.reporterUid}
                    </p>
                    <p className="text-slate-700">{r.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={saveContent} className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950">ওয়েবসাইট কন্টেন্ট ও নোটিশ বোর্ড ম্যানেজমেন্ট</h2>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">ঘোষণা ব্যানার (Announcement)</label>
            <input
              type="text"
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">হিরো হেডলাইন লেখা</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">নিরাপত্তা হেল্পলাইন নোটিশ</label>
            <input
              type="text"
              value={safetyNote}
              onChange={(e) => setSafetyNote(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <p className="text-xs font-bold text-blue-800">টপ ১০০ নোটিশ বোর্ড পপ-আপ ও অ্যাডমিন কন্টাক্ট</p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">নোটিশ বোর্ড শিরোনাম</label>
              <input
                type="text"
                value={noticeBoardTitle}
                onChange={(e) => setNoticeBoardTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">নোটিশ বোর্ড বার্তা</label>
              <textarea
                rows={2}
                value={noticeBoardMessage}
                onChange={(e) => setNoticeBoardMessage(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">অ্যাডমিন ইউজারনেম</label>
                <input
                  type="text"
                  value={adminContactUsername}
                  onChange={(e) => setAdminContactUsername(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">অ্যাডমিন ইমেইল</label>
                <input
                  type="email"
                  value={adminContactEmail}
                  onChange={(e) => setAdminContactEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Instagram আইডি</label>
                <input
                  type="text"
                  value={adminContactInstagram}
                  onChange={(e) => setAdminContactInstagram(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            কন্টেন্ট ও নোটিশ বোর্ড প্রকাশ করুন
          </button>
        </form>
      </div>

      {/* Admin Dynamic Bengali Booking Categories Manager */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950">
              বুকিং ক্যাটাগরি ম্যানেজার (অ্যাডমিন কন্ট্রোল)
            </h2>
            <p className="text-xs text-slate-500">
              কাস্টমার বুকিং ও সার্চ ফিল্টারের জন্য বাংলা ও ইংরেজি ক্যাটাগরি যুক্ত বা বাদ দিন (শুধুমাত্র ১৮+ শান্তিপূর্ণ ও আইনসম্মত সামাজিক সঙ্গী সেবা)।
            </p>
          </div>
          <span className="text-xs font-mono text-blue-700">{categoriesList.length} টি ক্যাটাগরি চালু</span>
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
            ক্যাটাগরি যোগ করুন
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
                title="ক্যাটাগরি মুছুন"
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
  const [editNewPassword, setEditNewPassword] = useState('');

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
      setNewName(`অ্যাডমিন ${hex.slice(0, 4).toUpperCase()}`);
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
          fullName: newName || 'LOGEASI অ্যাডমিনিস্ট্রেটর',
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
      setNotice(`অ্যাডমিনিস্ট্রেটর ${res.adminId} সফলভাবে তৈরি হয়েছে।`);
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
      setNotice(`${roleDef.label}-এর ক্ষমতা আপডেট করা হয়েছে।`);
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
    setEditNewPassword('');
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
            ...(editNewPassword.trim() ? { newPassword: editNewPassword.trim() } : {}),
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
      setNotice(`অ্যাডমিনিস্ট্রেটর ${editingAdmin.adminId}-এর অ্যাকাউন্ট ও ক্ষমতা আপডেট হয়েছে।`);
      setEditingAdmin(null);
      setEditNewPassword('');
      loadData();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  return (
    <AdminShell activeTab="management" title="অ্যাডমিন ম্যানেজমেন্ট ও RBAC ক্ষমতা">
      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {issuedCredentials && (
        <div className="p-4 bg-slate-950 text-white border border-blue-500 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-mono text-blue-300 font-semibold">
              এককালীন অ্যাডমিন লগইন তথ্য ({issuedCredentials.adminId}) — এখনই সংরক্ষণ করুন
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(
                  `Username: ${issuedCredentials.username}\nPassword: ${issuedCredentials.password}`
                );
                setNotice('অ্যাডমিন ইউজারনেম ও পাসওয়ার্ড ক্লিপবোর্ডে কপি করা হয়েছে।');
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" /> লগইন তথ্য কপি করুন
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-slate-900 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-400">ইউজারনেম: </span>
              <span className="text-white font-bold">{issuedCredentials.username}</span>
            </div>
            <div>
              <span className="text-slate-400">পাসওয়ার্ড: </span>
              <span className="text-emerald-300 font-bold">{issuedCredentials.password}</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Additional Admin */}
      <form onSubmit={(e) => createAdmin(e, false)} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-slate-950">নতুন অ্যাডমিনিস্ট্রেটর তৈরি করুন</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateClientCredentials}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" /> র‍্যান্ডম ইউজারনেম ও পাসওয়ার্ড বসান
            </button>
            <button
              type="button"
              onClick={(e) => createAdmin(e, true)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> তাৎক্ষণিক র‍্যান্ডম অ্যাডমিন
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            required
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="পূর্ণ নাম"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="অ্যাডমিন ইউজারনেম (যেমন: adm_8f2a1b)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Google / অ্যাডমিন ইমেইল (ঐচ্ছিক)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="ফোন (+880..., ঐচ্ছিক)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="প্রাথমিক পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)"
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserRole)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
          >
            <option value="super_admin">সুপার অ্যাডমিন / অ্যাডমিনিস্ট্রেটর</option>
            <option value="finance_admin">ফিন্যান্স অ্যাডমিন</option>
            <option value="support_admin">কাস্টমার সাপোর্ট অ্যাডমিন</option>
            <option value="verification_admin">ভেরিফিকেশন অ্যাডমিন</option>
            <option value="content_manager">কন্টেন্ট ম্যানেজার</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          অ্যাডমিন অ্যাকাউন্ট তৈরি করুন
        </button>
      </form>

      {/* Admin Roster */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-slate-950">অ্যাডমিনিস্ট্রেটর অ্যাকাউন্টস ({accounts.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">অ্যাডমিন আইডি</th>
                <th className="py-2 px-3">নাম, ইউজারনেম ও যোগাযোগ</th>
                <th className="py-2 px-3">রোল</th>
                <th className="py-2 px-3">সুরক্ষা / অবস্থা</th>
                <th className="py-2 pl-3 text-right">অ্যাকশন</th>
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
                      <span className="ml-1.5 text-[10px] font-mono text-blue-700">(কাস্টম ক্ষমতা)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {a.isRootOwner ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                        <Lock className="w-3.5 h-3.5" /> সুরক্ষিত রুট মালিক
                      </span>
                    ) : (
                      <span className="text-slate-600">{a.status === 'suspended' ? 'সাসপেন্ডেড' : 'সক্রিয়'}</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right space-x-2">
                    {a.isRootOwner ? (
                      <span className="text-[11px] font-mono text-slate-400">অপরিবর্তনীয়</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openAdminEditor(a)}
                          className="px-2.5 py-1 bg-slate-900 text-white rounded font-semibold cursor-pointer"
                        >
                          সম্পাদনা / ক্ষমতা
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAdminStatus(a)}
                          className="px-2.5 py-1 border border-slate-300 rounded font-semibold cursor-pointer"
                        >
                          {a.status === 'suspended' ? 'পুনর্বহাল করুন' : 'সাসপেন্ড করুন'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAdmin(a.uid)}
                          className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                        >
                          সরান
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
                অ্যাডমিন অ্যাকাউন্ট ও ব্যক্তিগত ক্ষমতা পরিবর্তন ({editingAdmin.adminId})
              </p>
              <h3 className="font-display text-lg font-bold text-slate-950">
                সম্পাদনা চলছে: {editingAdmin.fullName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => saveAdminEdits(e, true)}
                className="px-3 py-1.5 bg-slate-950 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" /> নতুন র‍্যান্ডম পাসওয়ার্ড দিন
              </button>
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">পূর্ণ নাম</label>
              <input
                required
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">ইউজারনেম</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">অ্যাডমিন ইমেইল</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">ফোন</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">রোল</label>
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
                <option value="super_admin">সুপার অ্যাডমিন / অ্যাডমিনিস্ট্রেটর</option>
                <option value="finance_admin">ফিন্যান্স অ্যাডমিন</option>
                <option value="support_admin">কাস্টমার সাপোর্ট অ্যাডমিন</option>
                <option value="verification_admin">ভেরিফিকেশন অ্যাডমিন</option>
                <option value="content_manager">কন্টেন্ট ম্যানেজার</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">অবস্থা</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="active">সক্রিয় (Active)</option>
                <option value="suspended">সাসপেন্ডেড (Suspended)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1 text-xs max-w-sm">
            <label className="font-semibold text-slate-700">নতুন কাস্টম পাসওয়ার্ড (ঐচ্ছিক, কমপক্ষে ৮ অক্ষর)</label>
            <input
              type="text"
              value={editNewPassword}
              onChange={(e) => setEditNewPassword(e.target.value)}
              placeholder="পাসওয়ার্ড পরিবর্তন করতে চাইলে এখানে লিখুন..."
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  ব্যক্তিগত অ্যাডমিন ক্ষমতা ({useCustomPerms ? 'কাস্টম ওভাররাইড চালু' : 'রোলের ডিফল্ট ক্ষমতা'})
                </p>
                <p className="text-[11px] text-slate-500">
                  মূল রোলের বাইরে এই অ্যাডমিনের জন্য নির্দিষ্ট ক্ষমতা আলাদাভাবে চালু বা বন্ধ করুন।
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
                রোলের ডিফল্টে রিসেট করুন
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
                    <span className="truncate">{p.description || p.key.replace(/_/g, ' ')}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            অ্যাডমিন পরিবর্তন ও ক্ষমতা সংরক্ষণ করুন
          </button>
        </form>
      )}

      {/* Customizable RBAC Permission Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-700" /> RBAC রোল পারমিশন ম্যাট্রিক্স
          </h2>
          <span className="text-xs text-slate-500">
            {user?.isRootOwner ? 'রুট সুপার অ্যাডমিন নন-রুট রোলের ক্ষমতা কাস্টমাইজ করতে পারবেন' : 'শুধুমাত্র দেখার অনুমতি'}
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
                      <span className="truncate">{p.description || p.key.replace(/_/g, ' ')}</span>
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
  const [customPaymentLabel, setCustomPaymentLabel] = useState(
    platformPublic.customPaymentLabel || '৩. অ্যাডমিন পার্সোনাল রকেট / কাস্টম সেন্ড মানি'
  );
  const [customPaymentNumber, setCustomPaymentNumber] = useState(
    platformPublic.customPaymentNumber || '01700-000000'
  );
  const [customPaymentInstructions, setCustomPaymentInstructions] = useState(
    platformPublic.customPaymentInstructions ||
      'বুকিং নিশ্চিত করতে মোট টাকার ৫০% অ্যাডমিন পার্সোনাল নম্বরে সেন্ড মানি করে TrxID জমা দিন।'
  );
  const [bensonPaymentLabel, setBensonPaymentLabel] = useState(
    platformPublic.bensonPaymentLabel || '৪. বেনসন সিগারেট পেমেন্ট (১,০০০৳ = ৩ প্যাকেট)'
  );
  const [bensonBaseBdt, setBensonBaseBdt] = useState(platformPublic.bensonBaseBdt ?? 1000);
  const [bensonPacketsPerBase, setBensonPacketsPerBase] = useState(
    platformPublic.bensonPacketsPerBase ?? 3
  );
  const [bensonItemName, setBensonItemName] = useState(
    platformPublic.bensonItemName || 'প্যাকেট বেনসন সিগারেট'
  );
  const [bensonContactNumber, setBensonContactNumber] = useState(
    platformPublic.bensonContactNumber || platformPublic.bkashPersonalNumber || '01700-000000'
  );
  const [bensonPaymentInstructions, setBensonPaymentInstructions] = useState(
    platformPublic.bensonPaymentInstructions ||
      'প্রতি ১,০০০ টাকা সমান ৩ প্যাকেট বেনসন সিগারেট। নির্ধারিত প্যাকেট হস্তান্তর করে ডেলিভারি রেফারেন্স/ফোন নম্বর লিখে জমা দিন।'
  );
  const [notice, setNotice] = useState('');
  const [proofPreviewPayment, setProofPreviewPayment] = useState<PaymentRecord | null>(null);

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
    if (platformPublic.customPaymentLabel) setCustomPaymentLabel(platformPublic.customPaymentLabel);
    if (platformPublic.customPaymentNumber) setCustomPaymentNumber(platformPublic.customPaymentNumber);
    if (platformPublic.customPaymentInstructions) setCustomPaymentInstructions(platformPublic.customPaymentInstructions);
    if (platformPublic.bensonPaymentLabel) setBensonPaymentLabel(platformPublic.bensonPaymentLabel);
    if (platformPublic.bensonBaseBdt) setBensonBaseBdt(platformPublic.bensonBaseBdt);
    if (platformPublic.bensonPacketsPerBase) setBensonPacketsPerBase(platformPublic.bensonPacketsPerBase);
    if (platformPublic.bensonItemName) setBensonItemName(platformPublic.bensonItemName);
    if (platformPublic.bensonContactNumber) setBensonContactNumber(platformPublic.bensonContactNumber);
    if (platformPublic.bensonPaymentInstructions) setBensonPaymentInstructions(platformPublic.bensonPaymentInstructions);
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
    setNotice(`রিফান্ড ${id} — ${status === 'processed' ? 'সম্পন্ন (Processed)' : 'প্রত্যাখ্যাত (Rejected)'} হিসেবে চিহ্নিত হয়েছে।`);
    loadFinance();
  };

  const processPayout = async (id: string, status: 'approved' | 'paid' | 'rejected') => {
    await apiRequest(`/api/admin/payouts/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    setNotice(
      `পেআউট ${id} — ${
        status === 'paid' ? 'পরিশোধিত (Paid)' : status === 'approved' ? 'অনুমোদিত' : 'প্রত্যাখ্যাত'
      } হিসেবে চিহ্নিত হয়েছে।`
    );
    loadFinance();
  };

  const verifyPersonalTrx = async (id: string, decision: 'approve' | 'reject') => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/payments/${id}/verify-personal`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setNotice(
        `পার্সোনাল পেমেন্ট ${id} ${
          decision === 'approve' ? 'যাচাই ও নিশ্চিত করা হয়েছে' : 'প্রত্যাখ্যান করা হয়েছে'
        }।`
      );
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
          customPaymentLabel,
          customPaymentNumber,
          customPaymentInstructions,
          bensonPaymentLabel,
          bensonBaseBdt: Number(bensonBaseBdt),
          bensonPacketsPerBase: Number(bensonPacketsPerBase),
          bensonItemName,
          bensonContactNumber,
          bensonPaymentInstructions,
        }),
      });
      await refreshPublicPlatform();
      setNotice('বিকাশ, নগদ, কাস্টম পার্সোনাল ও বেনসন সিগারেট পেমেন্ট অপশন সংরক্ষিত হয়েছে।');
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
      setNotice('প্ল্যাটফর্মের আর্থিক নীতিমালা সংরক্ষিত হয়েছে।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const pendingPersonal = payments.filter((p) => p.status === 'pending_manual_verification');

  return (
    <AdminShell activeTab="finance" title="ফিন্যান্স, রিকনসিলিয়েশন ও পেআউট">
      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {/* Personal 1. bKash, 2. Nagad & 3. Admin Custom Personal Receiving Numbers */}
      <form onSubmit={savePersonalNumbers} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-slate-950">
            পার্সোনাল ও কাস্টম পেমেন্ট অপশন (৫০% অ্যাডভান্স চেকআউটে বাধ্যতামূলক)
          </h2>
          <span className="text-xs font-mono text-blue-700">চেকআউট পেজে প্রদর্শিত হয়</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 inline-flex items-center gap-2">
              <PaymentGatewayLogo gateway="bkash" size="xs" /> ১. বিকাশ পার্সোনাল নম্বর
            </label>
            <input
              required
              type="text"
              value={bkashPersonal}
              onChange={(e) => setBkashPersonal(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 inline-flex items-center gap-2">
              <PaymentGatewayLogo gateway="nagad" size="xs" /> ২. নগদ পার্সোনাল নম্বর
            </label>
            <input
              required
              type="text"
              value={nagadPersonal}
              onChange={(e) => setNagadPersonal(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 inline-flex items-center gap-2">
              <PaymentGatewayLogo gateway="custom" size="xs" /> ৩. কাস্টম পার্সোনাল অপশনের নাম
            </label>
            <input
              type="text"
              value={customPaymentLabel}
              onChange={(e) => setCustomPaymentLabel(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold text-slate-700">কাস্টম পার্সোনাল নম্বর / অ্যাকাউন্ট</label>
            <input
              type="text"
              value={customPaymentNumber}
              onChange={(e) => setCustomPaymentNumber(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
            />
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <label className="font-semibold text-slate-700">কাস্টম পেমেন্ট নির্দেশনা</label>
          <input
            type="text"
            value={customPaymentInstructions}
            onChange={(e) => setCustomPaymentInstructions(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
          <div className="flex items-center gap-3">
            <PaymentGatewayLogo gateway="benson" size="md" />
            <p className="font-bold text-amber-900">
              ৪. বেনসন সিগারেট / পণ্য বিনিময় পেমেন্ট রেট (যেমন: ১,০০০ টাকা = ৩ প্যাকেট বেনসন সিগারেট)
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">অপশনের নাম</label>
              <input
                type="text"
                value={bensonPaymentLabel}
                onChange={(e) => setBensonPaymentLabel(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">ভিত্তি টাকা (BDT)</label>
              <input
                type="number"
                min={100}
                value={bensonBaseBdt}
                onChange={(e) => setBensonBaseBdt(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">সমপরিমাণ সংখ্যা (প্যাকেট)</label>
              <input
                type="number"
                min={1}
                value={bensonPacketsPerBase}
                onChange={(e) => setBensonPacketsPerBase(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">হস্তান্তর নম্বর</label>
              <input
                type="text"
                value={bensonContactNumber}
                onChange={(e) => setBensonContactNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">পণ্যের বিবরণ (যেমন: প্যাকেট বেনসন সিগারেট)</label>
              <input
                type="text"
                value={bensonItemName}
                onChange={(e) => setBensonItemName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">হস্তান্তর নির্দেশনা</label>
              <input
                type="text"
                value={bensonPaymentInstructions}
                onChange={(e) => setBensonPaymentInstructions(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          সব পার্সোনাল ও সিগারেট পেমেন্ট অপশন আপডেট করুন
        </button>
      </form>

      {/* Pending Personal bKash/Nagad/Custom/Benson TrxID Verification Queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-slate-950">
          পেন্ডিং পার্সোনাল, কাস্টম ও বেনসন সিগারেট পেমেন্ট যাচাই ({pendingPersonal.length})
        </h2>
        {pendingPersonal.length === 0 ? (
          <p className="text-xs text-slate-500">যাচাইয়ের অপেক্ষায় কোনো পার্সোনাল MFS / সিগারেট পেমেন্ট নেই।</p>
        ) : (
          <div className="space-y-2.5">
            {pendingPersonal.map((p) => (
              <div
                key={p.id}
                className="p-3.5 border border-blue-200 bg-blue-50/60 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <PaymentGatewayLogo gateway={p.gateway} size="sm" />
                  <div className="space-y-1">
                    <p className="font-mono font-bold text-slate-950">
                      {p.gateway.toUpperCase()} {p.gateway === 'benson' ? 'ITEM' : 'PERSONAL'} · {p.paymentStage === 'advance_50' ? '৫০% অ্যাডভান্স' : 'পেমেন্ট'} · Ref/TrxID: {p.senderReferenceTrxId}
                    </p>
                    <p className="text-slate-600 font-mono tabular-nums">
                      {p.transactionId} · বুকিং {p.bookingCode || p.bookingId} · {formatBdt(p.amountBdt)}
                      {p.equivalentItemLabel ? ` (${p.equivalentItemLabel})` : ''}
                    </p>
                    {p.bensonDeliveryMode && (
                      <p className="text-amber-900 font-semibold">
                        হস্তান্তরের ধরন:{' '}
                        {p.bensonDeliveryMode === 'in_person'
                          ? 'দেখা করে হাতে হাতে'
                          : 'রাইডার / কুরিয়ারে সেন্ড'}
                      </p>
                    )}
                    {p.proofPhotoUrl && (
                      <div className="pt-1 flex items-center gap-3">
                        <img
                          src={p.proofPhotoUrl}
                          alt="কেনা সিগারেটের প্রমাণ"
                          className="w-16 h-16 rounded-lg border border-slate-300 object-cover bg-white shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => setProofPreviewPayment(p)}
                          className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-700" /> সিগারেটের ছবি দেখুন
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => verifyPersonalTrx(p.id, 'approve')}
                    className="px-3 py-1.5 bg-blue-700 text-white font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    অনুমোদন ও পরিশোধিত নিশ্চিত করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyPersonalTrx(p.id, 'reject')}
                    className="px-3 py-1.5 border border-red-200 text-red-700 font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    বাতিল করুন
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {proofPreviewPayment && proofPreviewPayment.proofPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="bg-slate-950 text-white px-5 py-3.5 flex items-center justify-between gap-2">
              <div className="text-xs">
                <p className="font-mono text-amber-300">{proofPreviewPayment.transactionId}</p>
                <p className="font-bold text-sm">
                  কেনা বেনসন সিগারেটের প্রমাণ ({proofPreviewPayment.equivalentItemLabel || formatBdt(proofPreviewPayment.amountBdt)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofPreviewPayment(null)}
                aria-label="বন্ধ করুন"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-700">
                পদ্ধতি:{' '}
                <strong>
                  {proofPreviewPayment.bensonDeliveryMode === 'in_person'
                    ? 'দেখা করে হাতে হাতে'
                    : 'রাইডার / কুরিয়ারে সেন্ড'}
                </strong>{' '}
                · রেফারেন্স: <span className="font-mono font-semibold">{proofPreviewPayment.senderReferenceTrxId}</span>
              </p>
              <img
                src={proofPreviewPayment.proofPhotoUrl}
                alt="বেনসন সিগারেটের প্রমাণ ছবি"
                className="w-full max-h-96 object-contain rounded-xl border border-slate-200 bg-slate-50"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const id = proofPreviewPayment.id;
                    setProofPreviewPayment(null);
                    verifyPersonalTrx(id, 'approve');
                  }}
                  className="px-4 py-2 bg-blue-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  অনুমোদন করুন
                </button>
                <button
                  type="button"
                  onClick={() => setProofPreviewPayment(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Root-only Fee & Payment Gateway Mode Config */}
      {user?.isRootOwner && (
        <form onSubmit={saveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950">
            প্ল্যাটফর্ম ফি ও পেমেন্ট গেটওয়ে মোড (শুধুমাত্র রুট মালিক)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">সার্ভিস ফি (%)</label>
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
              <label className="font-semibold text-slate-700">গেটওয়ে মোড</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as 'sandbox' | 'live')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="sandbox">স্যান্ডবক্স / টেস্ট মোড</option>
                <option value="live">লাইভ মার্চেন্ট মোড</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">সর্বোচ্চ ক্যাশ (BDT)</label>
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
                <span>মার্চেন্ট অনুমোদিত</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cashEnabled}
                  onChange={(e) => setCashEnabled(e.target.checked)}
                />
                <span>ক্যাশ পেমেন্ট চালু</span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            আর্থিক নীতিমালা সংরক্ষণ করুন
          </button>
        </form>
      )}

      {/* Transactions Reconciliation + CSV Download */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950">পেমেন্ট রিকনসিলিয়েশন লেজার</h2>
          <button
            type="button"
            onClick={exportCsv}
            className="px-3.5 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV রিপোর্ট ডাউনলোড করুন
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">ট্রানজেকশন আইডি</th>
                <th className="py-2 px-3">গেটওয়ে</th>
                <th className="py-2 px-3 text-right">পরিমাণ</th>
                <th className="py-2 px-3 text-right">ফি</th>
                <th className="py-2 px-3">ওয়েবহুক</th>
                <th className="py-2 pl-3">অবস্থা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3 font-mono text-slate-900">{p.transactionId}</td>
                  <td className="py-2.5 px-3 uppercase">
                    <span className="inline-flex items-center gap-2">
                      <PaymentGatewayLogo gateway={p.gateway} size="xs" />
                      <span>{p.gateway} ({p.mode})</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatBdt(p.amountBdt)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatBdt(p.platformFeeBdt)}</td>
                  <td className="py-2.5 px-3">{p.webhookVerified ? 'HMAC যাচাইকৃত' : 'অপেক্ষমান'}</td>
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
          <h2 className="font-display text-base font-bold text-slate-950">সঙ্গীর পেআউট অনুরোধসমূহ</h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-slate-500">কোনো পেআউট অনুরোধ নেই।</p>
          ) : (
            payouts.map((p) => (
              <div key={p.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <PaymentGatewayLogo gateway={p.method} size="sm" />
                  <div>
                    <p className="font-semibold text-slate-900">{p.companionName || p.companionUid}</p>
                    <p className="font-mono text-slate-600 uppercase">
                      {p.method} {p.accountMasked} · {formatBdt(p.amountBdt)} · {p.status}
                    </p>
                  </div>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => processPayout(p.id, 'paid')}
                      className="px-2.5 py-1 bg-blue-700 text-white rounded font-semibold cursor-pointer"
                    >
                      পরিশোধিত দেখান
                    </button>
                    <button
                      type="button"
                      onClick={() => processPayout(p.id, 'rejected')}
                      className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                    >
                      বাতিল
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950">রিফান্ড অনুরোধসমূহ</h2>
          {refunds.length === 0 ? (
            <p className="text-xs text-slate-500">কোনো রিফান্ড অনুরোধ নেই।</p>
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
                      রিফান্ড অনুমোদন
                    </button>
                    <button
                      type="button"
                      onClick={() => processRefund(r.id, 'rejected')}
                      className="px-2.5 py-1 border border-red-200 text-red-700 rounded font-semibold cursor-pointer"
                    >
                      প্রত্যাখ্যান
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

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  // Secret rotation state
  const [rotBusy, setRotBusy] = useState(false);
  const [rotMsg, setRotMsg] = useState('');
  const [rotErr, setRotErr] = useState('');

  const loadAuditLogs = () => {
    apiRequest<{ logs: AuditLogRecord[] }>('/api/admin/audit-logs')
      .then((res) => setLogs(res.logs || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadAuditLogs();
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (newPassword.length < 10) {
      setPwErr('নতুন পাসওয়ার্ড কমপক্ষে ১০ অক্ষরের হতে হবে।');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না।');
      return;
    }
    setPwBusy(true);
    try {
      await apiRequest('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg('অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।');
      loadAuditLogs();
    } catch (err: any) {
      setPwErr(err?.message || 'পাসওয়ার্ড পরিবর্তন করা যায়নি।');
    } finally {
      setPwBusy(false);
    }
  };

  const handleRotateSecrets = async () => {
    setRotMsg('');
    setRotErr('');
    setRotBusy(true);
    try {
      const res = await apiRequest<{ rotated: boolean; rotatedAt: string; sessionToken?: string }>(
        '/api/admin/security/rotate-secrets',
        { method: 'POST' }
      );
      if (res.sessionToken) {
        setStoredSessionToken(res.sessionToken);
      }
      setRotMsg('সব পুরোনো সেশন টোকেন ও ওয়েবহুক সিক্রেট বাতিল করে নতুন ২৫৬-বিট কী চালু করা হয়েছে।');
      loadAuditLogs();
    } catch (err: any) {
      setRotErr(err?.message || 'সিক্রেট রোটেট করা যায়নি।');
    } finally {
      setRotBusy(false);
    }
  };

  const filtered = logs.filter((l) => severityFilter === 'all' || l.severity === severityFilter);

  return (
    <AdminShell activeTab="security" title="নিরাপত্তা কেন্দ্র ও অডিট লগ">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">পাসওয়ার্ড ও ক্রেডেনশিয়াল সুরক্ষা</p>
          <p className="text-sm font-bold text-slate-950 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Bcrypt (১২ রাউন্ড) + AES-256-GCM
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">ওয়েবহুক ও সেশন অখণ্ডতা</p>
          <p className="text-sm font-bold text-slate-950 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> র‍্যান্ডম ২৫৬-বিট HMAC + HttpOnly কুকি
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">ডিজাস্টার রিকভারি ব্যাকআপ</p>
            <p className="text-xs text-slate-700 mt-0.5">সম্পূর্ণ JSON স্ন্যাপশট এক্সপোর্ট</p>
          </div>
          {user?.isRootOwner && (
            <button
              type="button"
              onClick={exportBackup}
              className="px-3 py-2 bg-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              ব্যাকআপ এক্সপোর্ট করুন
            </button>
          )}
        </div>
      </div>

      {/* Credential & Secret Rotation Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleChangePassword} className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-700" /> অ্যাডমিন পাসওয়ার্ড পরিবর্তন করুন
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                কোথাও পাসওয়ার্ড শেয়ার বা ফাঁস হওয়ার আশঙ্কা থাকলে সাথে সাথে নতুন পাসওয়ার্ড সেট করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPasswords ? 'লুকান' : 'দেখুন'}
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">বর্তমান পাসওয়ার্ড</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
                placeholder="বর্তমান পাসওয়ার্ড লিখুন"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">নতুন পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর)</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  minLength={10}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="শক্তিশালী নতুন পাসওয়ার্ড"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  minLength={10}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  placeholder="আবার লিখুন"
                />
              </div>
            </div>
          </div>

          {pwErr && <p className="text-xs text-red-700 font-semibold">{pwErr}</p>}
          {pwMsg && <p className="text-xs text-emerald-700 font-semibold">{pwMsg}</p>}

          <button
            type="submit"
            disabled={pwBusy}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            {pwBusy ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
          </button>
        </form>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700" /> GitHub ও API কী নিরাপত্তা (জরুরি করণীয়)
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              সার্ভার কোড থেকে সব হার্ডকোডেড পাসওয়ার্ড ও পাবলিক কনফিগ-ভিত্তিক সিক্রেট সরানো হয়েছে। যদি GitHub-এ আপনার রিপোজিটরি পাবলিক হয়ে থাকে:
            </p>
          </div>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
            <li>GitHub Repository Settings থেকে রিপোজিটরিটি অবিলম্বে <strong>Private</strong> করুন।</li>
            <li>Google Cloud Console -&gt; Credentials-এ গিয়ে Firebase Browser API Key-তে <strong>HTTP Referrer Restriction</strong> যোগ করুন এবং প্রয়োজনে Gemini API Key নতুন করে তৈরি (Regenerate) করুন।</li>
            <li>নিচের বাটনে ক্লিক করে পুরোনো সব সেশন ও ওয়েবহুক সিগনেচার বাতিল (Rotate) করুন।</li>
          </ul>

          {rotErr && <p className="text-xs text-red-700 font-semibold">{rotErr}</p>}
          {rotMsg && <p className="text-xs text-emerald-700 font-semibold">{rotMsg}</p>}

          {user?.isRootOwner && (
            <button
              type="button"
              disabled={rotBusy}
              onClick={handleRotateSecrets}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              {rotBusy ? 'রোটেট হচ্ছে...' : 'সেশন ও ওয়েবহুক সিক্রেট রোটেট করুন'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950">অপরিবর্তনীয় অডিট লগসমূহ</h2>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
            {[
              { id: 'all', label: 'সব' },
              { id: 'info', label: 'তথ্য (Info)' },
              { id: 'warning', label: 'সতর্কতা (Warning)' },
              { id: 'critical', label: 'গুরুত্বপূর্ণ (Critical)' },
            ].map((sev) => (
              <button
                key={sev.id}
                type="button"
                onClick={() => setSeverityFilter(sev.id)}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  severityFilter === sev.id ? 'bg-white font-semibold text-slate-950 shadow-sm' : 'text-slate-600'
                }`}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3">সময়</th>
                <th className="py-2 px-3">অ্যাকশন</th>
                <th className="py-2 px-3">অ্যাক্টর</th>
                <th className="py-2 px-3">গুরুত্ব</th>
                <th className="py-2 pl-3">বিস্তারিত</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 pr-3 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString('bn-BD')}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{l.action}</td>
                  <td className="py-2.5 px-3 text-slate-700">{l.actorRole}</td>
                  <td className={`py-2.5 px-3 font-semibold uppercase ${
                    l.severity === 'critical' ? 'text-red-700' : l.severity === 'warning' ? 'text-amber-700' : 'text-slate-600'
                  }`}>
                    {l.severity === 'critical' ? 'গুরুত্বপূর্ণ' : l.severity === 'warning' ? 'সতর্কতা' : 'তথ্য'}
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
