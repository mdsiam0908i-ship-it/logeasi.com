import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Instagram,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
import { apiRequest, setStoredSessionToken } from '../lib/api.ts';

export function AuthPage() {
  const { user, loginWithGoogle, refreshSession, logout, navigate } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const urlTab = params.get('tab');
  const urlMode = params.get('mode');
  const initialMode =
    urlMode === 'companion' || urlTab === 'register'
      ? 'register'
      : urlTab === 'phone'
        ? 'phone'
        : urlTab === 'forgot'
          ? 'forgot'
          : 'login';

  const [tab, setTab] = useState<'login' | 'register' | 'phone' | 'forgot'>(initialMode);
  const [role, setRole] = useState<'customer' | 'companion'>(
    urlMode === 'companion' ? 'companion' : 'customer'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1996-01-15');
  const [division, setDivision] = useState('Dhaka');
  const [city, setCity] = useState('Dhaka');
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  // Companion optional direct contact & social options during registration
  const [instagramHandle, setInstagramHandle] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // 2FA challenge
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Phone OTP
  const [phone, setPhone] = useState('+88017');
  const [challengeId, setChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sandboxOtpNotice, setSandboxOtpNotice] = useState('');

  // Forgot password
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sandboxResetNotice, setSandboxResetNotice] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('tab');
    const m = p.get('mode');
    if (m === 'companion') {
      setRole('companion');
      setTab('register');
    } else if (t === 'register' || t === 'login' || t === 'phone' || t === 'forgot') {
      setTab(t);
    }
  }, [window.location.search]);

  const activeDivisionObj =
    BANGLADESH_DIVISIONS.find((d) => d.id === division) || BANGLADESH_DIVISIONS[0];

  const redirectAfterAuth = (userRole: string) => {
    if (userRole === 'companion') navigate('/dashboard/companion');
    else if (
      ['root_super_admin', 'super_admin', 'finance_admin', 'support_admin', 'verification_admin', 'content_manager'].includes(userRole)
    ) {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard/customer');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await loginWithGoogle(role, dateOfBirth, totpCode || undefined);
      if (res.requires2FA) {
        setNeeds2FA(true);
        setInfo('Enter the 6-digit code from your authenticator app to complete Google sign-in.');
      } else if (res.user) {
        redirectAfterAuth(res.user.role);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleanId = email.trim();
      const res = await apiRequest<{ user?: any; requires2FA?: boolean; sessionToken?: string }>(
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
        setInfo('2FA enabled on this account. Enter your 6-digit authenticator code.');
      } else if (res.user) {
        if (res.sessionToken) setStoredSessionToken(res.sessionToken);
        await refreshSession();
        redirectAfterAuth(res.user.role);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adultConfirmed) {
      setError('You must confirm you are aged 18+ to register on LOGEASI.COM.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ user: any; sessionToken?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          dateOfBirth,
          city,
          division,
          role,
          phone: whatsappNumber || phone,
          instagramHandle: role === 'companion' ? instagramHandle : '',
          whatsappNumber: role === 'companion' ? whatsappNumber : '',
          contactEmail: role === 'companion' ? (contactEmail || email) : '',
        }),
      });
      if (res.sessionToken) setStoredSessionToken(res.sessionToken);
      await refreshSession();
      redirectAfterAuth(res.user.role);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ challengeId: string; sandboxOtpPreview?: string }>(
        '/api/auth/phone/request-otp',
        {
          method: 'POST',
          body: JSON.stringify({
            phone,
            fullName,
            dateOfBirth,
            intendedRole: role,
          }),
        }
      );
      setChallengeId(res.challengeId);
      setSandboxOtpNotice(
        res.sandboxOtpPreview
          ? `Sandbox SMS OTP issued: ${res.sandboxOtpPreview} (valid 5 min)`
          : 'OTP dispatched via SMS provider.'
      );
    } catch (err: any) {
      setError(err.message || 'Unable to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ user: any; sessionToken?: string }>(
        '/api/auth/phone/verify-otp',
        {
          method: 'POST',
          body: JSON.stringify({ challengeId, code: otpCode }),
        }
      );
      if (res.sessionToken) setStoredSessionToken(res.sessionToken);
      await refreshSession();
      redirectAfterAuth(res.user.role);
    } catch (err: any) {
      setError(err.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string; sandboxResetToken?: string }>(
        '/api/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) }
      );
      setInfo(res.message);
      if (res.sandboxResetToken) {
        setSandboxResetNotice(`Sandbox recovery token: ${res.sandboxResetToken}`);
      }
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setInfo(res.message);
      setTab('login');
    } catch (err: any) {
      setError(err.message || 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Architectural Trust Panel */}
        <aside className="lg:col-span-5 bg-slate-950 text-white rounded-2xl p-7 sm:p-9 flex flex-col justify-between hero-architectural-grid border border-slate-800">
          <div className="space-y-5">
            <p className="text-xs font-mono uppercase tracking-widest text-blue-400">
              LOGEASI.COM · BANGLADESH 18+ ACCESS
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              Verified Adult Social Companionship.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Seamless authentication across all 8 Bangladesh Divisions with 18+ identity checks, mutual BDT pricing, and escrow-protected payouts.
            </p>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Works across Google Sign-In, Email & Password, and Bangladesh +880 Phone OTP.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Instagram className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Companions can attach Instagram, WhatsApp & Contact Email channels to their verified profile.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Strictly 18+ adults · Non-sexual public venues & everyday assistance only.</span>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Looking for companion onboarding?</span>
            <button
              type="button"
              onClick={() => navigate('/become-companion')}
              className="font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
            >
              Companion Studio <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Right Auth & Session Panel */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {user && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-semibold text-blue-800 uppercase">Active Session</p>
                <p className="text-sm font-bold text-slate-950">{user.fullName}</p>
                <p className="text-xs text-slate-600">
                  {user.email || (user.username ? `@${user.username}` : '') || user.phone} · Role:{' '}
                  <span className="capitalize font-semibold">{user.role.replace(/_/g, ' ')}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => redirectAfterAuth(user.role)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Open Dashboard
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3.5 py-2 bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-slate-950 tracking-tight">
              {tab === 'login'
                ? 'Sign In to LOGEASI.COM'
                : tab === 'register'
                  ? 'Create Your 18+ Account'
                  : tab === 'phone'
                    ? 'Bangladesh Phone OTP Access'
                    : 'Reset Account Password'}
            </h2>
            <p className="text-xs text-slate-600">
              Choose Customer or Companion account type below before continuing.
            </p>
          </div>

          {/* Account type selector */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                role === 'customer' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              Customer Account
            </button>
            <button
              type="button"
              onClick={() => setRole('companion')}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                role === 'companion' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              Companion Account
            </button>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full py-2.5 px-4 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-900 flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            <span className="font-mono font-bold text-blue-700">G</span>
            Continue with Google
          </button>

          <div className="relative flex items-center justify-center text-xs text-slate-400">
            <span className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 shrink-0">or use email / phone</span>
            <span className="border-t border-slate-200 w-full" />
          </div>

          {/* Method Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md cursor-pointer ${tab === 'login' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md cursor-pointer ${tab === 'register' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'}`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => { setTab('phone'); setError(''); }}
              className={`flex-1 py-2 rounded-md cursor-pointer ${tab === 'phone' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'}`}
            >
              Phone OTP
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 font-medium">
              {info}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email or Admin Username
                </label>
                <input
                  required
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com or admin username"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> Password
                </label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-700"
                />
              </div>

              {needs2FA && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-blue-800">2FA Authenticator Code</label>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {busy ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setTab('forgot')}
                  className="text-blue-700 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/login')}
                  className="px-2.5 py-1 bg-slate-950 text-white rounded-md font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Open Admin Portal →
                </button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleEmailRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Full Legal Name</label>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="As on NID / Passport"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Date of Birth (18+)</label>
                  <input
                    required
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Bangladesh Division</label>
                  <select
                    value={division}
                    onChange={(e) => {
                      const nextDiv = e.target.value;
                      setDivision(nextDiv);
                      const found = BANGLADESH_DIVISIONS.find((d) => d.id === nextDiv);
                      if (found && found.districts.length > 0) {
                        setCity(found.districts[0]);
                      }
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {BANGLADESH_DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">District / Area</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {Array.from(new Set([...activeDivisionObj.districts, ...activeDivisionObj.metroAreas])).map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Account Email</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Password (min 8 chars)</label>
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {role === 'companion' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Companion Social & Direct Contact Options (Optional)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <Instagram className="w-3 h-3 text-blue-700" /> Instagram
                      </label>
                      <input
                        type="text"
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        placeholder="@username"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-emerald-600" /> WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="+88017..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-700" /> Public Email
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="contact@domain.com"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={adultConfirmed}
                  onChange={(e) => setAdultConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm I am at least 18 years old and agree to LOGEASI.COM’s non-sexual public companionship Terms & Privacy Policy.
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                {busy ? 'Creating Account...' : `Create ${role === 'companion' ? 'Companion' : 'Customer'} Account`}
              </button>
            </form>
          )}

          {tab === 'phone' && (
            <div className="space-y-4">
              {!challengeId ? (
                <form onSubmit={handleRequestOtp} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Bangladesh Phone Number
                    </label>
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+8801712345678"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Full Name (New Users)</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">DOB (18+ Check)</label>
                      <input
                        required
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    Send 6-Digit Phone OTP
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  {sandboxOtpNotice && (
                    <p className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-800">
                      {sandboxOtpNotice}
                    </p>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Enter 6-Digit OTP</label>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    Verify OTP & Sign In
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === 'forgot' && (
            <div className="space-y-4">
              <form onSubmit={handleForgot} className="space-y-3">
                <label className="text-xs font-semibold text-slate-700">Account Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Request Recovery Token
                </button>
              </form>

              {sandboxResetNotice && (
                <p className="p-2.5 bg-slate-100 rounded text-xs font-mono text-slate-800 break-all">
                  {sandboxResetNotice}
                </p>
              )}

              <form onSubmit={handleReset} className="space-y-3 pt-3 border-t border-slate-200">
                <input
                  required
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <input
                  required
                  minLength={8}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Reset Password
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
