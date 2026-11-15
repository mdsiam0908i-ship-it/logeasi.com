import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Gift,
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
  const {
    user,
    loginWithGoogle,
    refreshSession,
    openNoticeBoard,
    logout,
    currentPath,
    navigate,
    pendingReferralCode,
    setPendingReferralCode,
  } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const urlTab = params.get('tab');
  const urlMode = params.get('mode');
  const urlRef = (params.get('ref') || '').trim().toUpperCase();
  const pathInviteMatch = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)/);
  const initialRefCode = urlRef || (pathInviteMatch ? pathInviteMatch[1].toUpperCase() : '') || pendingReferralCode || '';
  const initialMode =
    urlMode === 'companion' || urlTab === 'register' || Boolean(urlRef || pathInviteMatch)
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
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [adultConfirmed, setAdultConfirmed] = useState(true);

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

  // Referral invite code
  const [referralCode, setReferralCode] = useState(initialRefCode);
  const [referralCheck, setReferralCheck] = useState<{
    checked: boolean;
    valid: boolean;
    referrerName?: string;
    signupBonusCredits?: number;
  } | null>(null);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const [pathOnly, queryStr = ''] = currentPath.split('?');
    const p = new URLSearchParams(queryStr || window.location.search.replace(/^\?/, ''));
    const t = p.get('tab');
    const m = p.get('mode');
    const r = (p.get('ref') || '').trim().toUpperCase();
    const invMatch = pathOnly.match(/^\/invite\/([A-Za-z0-9_-]+)/);
    const detectedRef = r || (invMatch ? invMatch[1].toUpperCase() : '');
    if (detectedRef) {
      setReferralCode(detectedRef);
      setPendingReferralCode(detectedRef);
    }
    if (m === 'companion') {
      setRole('companion');
      setTab('register');
    } else if (t === 'register' || t === 'login' || t === 'phone' || t === 'forgot') {
      setTab(t);
    } else if (detectedRef) {
      setTab('register');
    }
  }, [currentPath, setPendingReferralCode]);

  useEffect(() => {
    const trimmed = referralCode.trim().toUpperCase();
    if (!trimmed || trimmed.length < 4) {
      setReferralCheck(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      apiRequest<{
        valid: boolean;
        referrerName?: string;
        signupBonusCredits?: number;
      }>(`/api/referrals/validate?code=${encodeURIComponent(trimmed)}`)
        .then((res) => {
          if (!cancelled) {
            setReferralCheck({
              checked: true,
              valid: Boolean(res.valid),
              referrerName: res.referrerName,
              signupBonusCredits: res.signupBonusCredits,
            });
          }
        })
        .catch(() => {
          if (!cancelled) setReferralCheck(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [referralCode]);

  const activeDivisionObj =
    BANGLADESH_DIVISIONS.find((d) => d.id === division) || BANGLADESH_DIVISIONS[0];

  const redirectAfterAuth = (userRole: string) => {
    if (
      ['root_super_admin', 'super_admin', 'finance_admin', 'support_admin', 'verification_admin', 'content_manager'].includes(userRole)
    ) {
      navigate('/admin/dashboard');
    } else {
      openNoticeBoard();
      navigate('/explore');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const res = await loginWithGoogle(role, dateOfBirth, totpCode || undefined, cleanRef || undefined);
      if (res.requires2FA) {
        setNeeds2FA(true);
        setInfo('গুগল সাইন-ইন সম্পন্ন করতে আপনার অথেনটিকেটর অ্যাপ থেকে ৬-সংখ্যার কোড লিখুন।');
      } else if (res.user) {
        setPendingReferralCode('');
        redirectAfterAuth(res.user.role);
      }
    } catch (err: any) {
      setError(err.message || 'গুগল সাইন-ইন ব্যর্থ হয়েছে।');
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
        setInfo('এই অ্যাকাউন্টে 2FA চালু আছে। আপনার ৬-সংখ্যার অথেনটিকেটর কোড দিন।');
      } else if (res.user) {
        if (res.sessionToken) setStoredSessionToken(res.sessionToken);
        await refreshSession();
        redirectAfterAuth(res.user.role);
      }
    } catch (err: any) {
      setError(err.message || 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adultConfirmed) {
      setError('দয়া করে ১৮+ বয়স নিশ্চিতকরণ বক্সে টিক দিন।');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const res = await apiRequest<{ user: any; sessionToken?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          dateOfBirth,
          city,
          division,
          gender,
          role,
          phone: whatsappNumber || phone,
          instagramHandle: role === 'companion' ? instagramHandle : '',
          whatsappNumber: role === 'companion' ? whatsappNumber : '',
          contactEmail: role === 'companion' ? (contactEmail || email) : '',
          ...(cleanRef ? { referralCode: cleanRef } : {}),
        }),
      });
      if (res.sessionToken) setStoredSessionToken(res.sessionToken);
      setPendingReferralCode('');
      await refreshSession();
      redirectAfterAuth(res.user.role);
    } catch (err: any) {
      setError(err.message || 'রেজিস্ট্রেশন সম্পন্ন করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const res = await apiRequest<{ challengeId: string; sandboxOtpPreview?: string }>(
        '/api/auth/phone/request-otp',
        {
          method: 'POST',
          body: JSON.stringify({
            phone,
            fullName,
            dateOfBirth,
            intendedRole: role,
            gender,
            ...(cleanRef ? { referralCode: cleanRef } : {}),
          }),
        }
      );
      setChallengeId(res.challengeId);
      setSandboxOtpNotice(
        res.sandboxOtpPreview
          ? `স্যান্ডবক্স SMS OTP পাঠানো হয়েছে: ${res.sandboxOtpPreview} (৫ মিনিট মেয়াদ)`
          : 'SMS-এর মাধ্যমে OTP পাঠানো হয়েছে।'
      );
    } catch (err: any) {
      setError(err.message || 'OTP পাঠানো যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const cleanRef = referralCode.trim().toUpperCase();
      const res = await apiRequest<{ user: any; sessionToken?: string }>(
        '/api/auth/phone/verify-otp',
        {
          method: 'POST',
          body: JSON.stringify({
            challengeId,
            code: otpCode,
            ...(cleanRef ? { referralCode: cleanRef } : {}),
          }),
        }
      );
      if (res.sessionToken) setStoredSessionToken(res.sessionToken);
      setPendingReferralCode('');
      await refreshSession();
      redirectAfterAuth(res.user.role);
    } catch (err: any) {
      setError(err.message || 'OTP যাচাই ব্যর্থ হয়েছে।');
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
        setSandboxResetNotice(`স্যান্ডবক্স রিকভারি টোকেন: ${res.sandboxResetToken}`);
      }
    } catch (err: any) {
      setError(err.message || 'অনুরোধ পাঠানো যায়নি।');
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
      setError(err.message || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে।');
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
              LOGEASI.COM · বাংলাদেশ ১৮+ প্রবেশাধিকার
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              যাচাইকৃত নিরাপদ সামাজিক সঙ্গী সেবা।
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              বাংলাদেশের ৮টি বিভাগে ১৮+ পরিচয় যাচাই, স্বচ্ছ BDT (৳) রেট এবং এস্ক্রো-সুরক্ষিত পেআউটসহ সহজ লগইন ও সাইন আপ।
            </p>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Google সাইন-ইন, ইমেইল ও পাসওয়ার্ড এবং বাংলাদেশ +880 ফোন OTP—সব মাধ্যমেই ব্যবহারযোগ্য।</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Instagram className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>সঙ্গীরা তাদের প্রোফাইলে Instagram, WhatsApp এবং যোগাযোগের ইমেইল যুক্ত করতে পারবেন।</span>
              </div>
              <div className="flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>শুধুমাত্র ১৮+ প্রাপ্তবয়স্কদের জন্য · মার্জিত ও নিরাপদ পাবলিক স্থান ও দৈনন্দিন সহায়তা।</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-900 border border-blue-700/70 rounded-xl space-y-1.5">
            <p className="text-[11px] font-mono uppercase tracking-widest text-blue-400 font-bold">
              প্ল্যাটফর্ম ডেভেলপার
            </p>
            <p className="font-display text-2xl font-extrabold tracking-tight text-white uppercase">
              DEVELOPER: MD SIAM
            </p>
            <a
              href="https://instagram.com/sheik_siam0077"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-mono font-bold text-blue-300 hover:text-white"
            >
              <Instagram className="w-4 h-4 text-pink-400" />
              Instagram ID: @sheik_siam0077
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>সঙ্গী হিসেবে কাজ করতে চান?</span>
            <button
              type="button"
              onClick={() => navigate('/become-companion')}
              className="font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
            >
              সঙ্গী স্টুডিও <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>

        {/* Right Auth & Session Panel */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {user && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-semibold text-blue-800 uppercase">চলমান সেশন</p>
                <p className="text-sm font-bold text-slate-950">{user.fullName}</p>
                <p className="text-xs text-slate-600">
                  {user.email || (user.username ? `@${user.username}` : '') || user.phone} · ভূমিকা:{' '}
                  <span className="capitalize font-semibold">{user.role.replace(/_/g, ' ')}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => redirectAfterAuth(user.role)}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  ড্যাশবোর্ডে যান
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3.5 py-2 bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> সাইন আউট
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-slate-950 tracking-tight">
              {tab === 'login'
                ? 'LOGEASI.COM-এ লগইন করুন'
                : tab === 'register'
                  ? 'নতুন ১৮+ অ্যাকাউন্ট তৈরি করুন'
                  : tab === 'phone'
                    ? 'বাংলাদেশ ফোন OTP প্রবেশ'
                    : 'পাসওয়ার্ড রিসেট করুন'}
            </h2>
            <p className="text-xs text-slate-600">
              শুরু করার আগে নিচ থেকে কাস্টমার অথবা সঙ্গী অ্যাকাউন্ট ধরন বেছে নিন।
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
              কাস্টমার অ্যাকাউন্ট
            </button>
            <button
              type="button"
              onClick={() => setRole('companion')}
              className={`py-2 rounded-md transition-colors cursor-pointer ${
                role === 'companion' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'
              }`}
            >
              সঙ্গী (কম্প্যানিয়ন) অ্যাকাউন্ট
            </button>
          </div>

          {referralCheck?.valid && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  ইনভাইট কোড যাচাইকৃত ({referralCode.trim().toUpperCase()}) — আমন্ত্রণকারী: {referralCheck.referrerName}
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  নতুন অ্যাকাউন্ট তৈরি করলেই আপনি পাবেন +{referralCheck.signupBonusCredits ?? 150} ক্রেডিট পয়েন্ট (৳{referralCheck.signupBonusCredits ?? 150}) ওয়েলকাম বোনাস!
                </p>
              </div>
            </div>
          )}

          {/* Continue with Google */}
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full py-2.5 px-4 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-900 flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            <span className="font-mono font-bold text-blue-700">G</span>
            Google দিয়ে চালিয়ে যান
          </button>

          <div className="relative flex items-center justify-center text-xs text-slate-400">
            <span className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 shrink-0">অথবা ইমেইল / ফোন ব্যবহার করুন</span>
            <span className="border-t border-slate-200 w-full" />
          </div>

          {/* Method Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); }}
              className={`flex-1 py-2 rounded-md cursor-pointer ${tab === 'login' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'}`}
            >
              লগইন
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(''); }}
              className={`flex-1 py-2 rounded-md cursor-pointer ${tab === 'register' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'}`}
            >
              সাইন আপ
            </button>
            <button
              type="button"
              onClick={() => { setTab('phone'); setError(''); }}
              className={`flex-1 py-2 rounded-md cursor-pointer ${tab === 'phone' ? 'bg-white text-slate-950 shadow-sm font-semibold' : 'text-slate-600'}`}
            >
              ফোন OTP
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
                  <Mail className="w-3.5 h-3.5" /> ইমেইল অথবা অ্যাডমিন ইউজারনেম
                </label>
                <input
                  required
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com অথবা admin ইউজারনেম"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> পাসওয়ার্ড
                </label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড লিখুন"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-700"
                />
              </div>

              {needs2FA && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-blue-800">2FA অথেনটিকেটর কোড</label>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="৬-সংখ্যার কোড"
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {busy ? 'লগইন হচ্ছে...' : 'লগইন করুন'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setTab('forgot')}
                  className="text-blue-700 hover:underline cursor-pointer"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/login')}
                  className="px-2.5 py-1 bg-slate-950 text-white rounded-md font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  অ্যাডমিন পোর্টাল খুলুন →
                </button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleEmailRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">পূর্ণ নাম</label>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="NID / স্কুল রোল অনুযায়ী পূর্ণ নাম"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">জন্ম তারিখ (১৮+)</label>
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
                  <label className="text-xs font-semibold text-slate-700">বাংলাদেশের বিভাগ</label>
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
                  <label className="text-xs font-semibold text-slate-700">জেলা / এলাকা</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  লিঙ্গ নির্বাচন করুন (ছেলে নাকি মেয়ে)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      gender === 'male'
                        ? 'bg-slate-950 text-white border-slate-950'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ছেলে / পুরুষ
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      gender === 'female'
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    মেয়ে / নারী
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">অ্যাকাউন্ট ইমেইল</label>
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
                  <label className="text-xs font-semibold text-slate-700">পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</label>
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর লিখুন"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {role === 'companion' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-slate-900">
                    সঙ্গীর সরাসরি যোগাযোগ ও সোশ্যাল অপশন (ঐচ্ছিক)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <Instagram className="w-3 h-3 text-blue-700" /> ইনস্টাগ্রাম
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
                        <MessageCircle className="w-3 h-3 text-emerald-600" /> হোয়াটসঅ্যাপ
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
                        <Mail className="w-3 h-3 text-blue-700" /> পাবলিক ইমেইল
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-blue-700" /> রেফারেল / ইনভাইট কোড (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="যেমন: LGS-AB12CD (থাকলে লিখুন, +১৫০ পয়েন্ট বোনাস)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                />
                {referralCheck?.checked && !referralCheck.valid && referralCode.trim().length >= 4 && (
                  <p className="text-[11px] text-amber-700">
                    এই রেফারেল কোডটি পাওয়া যায়নি। কোড সঠিক হলে পুনরায় পরীক্ষা করুন অথবা খালি রেখেই এগিয়ে যান।
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={adultConfirmed}
                  onChange={(e) => setAdultConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  আমি নিশ্চিত করছি যে আমার বয়স কমপক্ষে ১৮ বছর এবং আমি LOGEASI.COM-এর নিরাপদ ও আইনসম্মত পাবলিক সঙ্গী শর্তাবলী ও গোপনীয়তা নীতিতে সম্মত।
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                {busy
                  ? 'অ্যাকাউন্ট তৈরি হচ্ছে...'
                  : role === 'companion'
                    ? 'সঙ্গী অ্যাকাউন্ট তৈরি করুন'
                    : 'কাস্টমার অ্যাকাউন্ট তৈরি করুন'}
              </button>
            </form>
          )}

          {tab === 'phone' && (
            <div className="space-y-4">
              {!challengeId ? (
                <form onSubmit={handleRequestOtp} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> বাংলাদেশ মোবাইল নম্বর
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
                      <label className="text-xs font-semibold text-slate-700">পূর্ণ নাম (নতুন ব্যবহারকারী)</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="আপনার নাম"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">জন্ম তারিখ (১৮+)</label>
                      <input
                        required
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">লিঙ্গ (নতুন অ্যাকাউন্টের জন্য)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                          gender === 'male'
                            ? 'bg-slate-950 text-white border-slate-950'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        ছেলে / পুরুষ
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                          gender === 'female'
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        মেয়ে / নারী
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-blue-700" /> রেফারেল কোড (নতুন ব্যবহারকারীর জন্য ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="LGS-XXXXXX"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
                  >
                    ৬-সংখ্যার ফোন OTP পাঠান
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
                    <label className="text-xs font-semibold text-slate-700">৬-সংখ্যার OTP কোড লিখুন</label>
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
                    OTP যাচাই করে লগইন করুন
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === 'forgot' && (
            <div className="space-y-4">
              <form onSubmit={handleForgot} className="space-y-3">
                <label className="text-xs font-semibold text-slate-700">অ্যাকাউন্ট ইমেইল</label>
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
                  রিকভারি টোকেন পাঠান
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
                  placeholder="রিসেট টোকেন পেস্ট করুন"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <input
                  required
                  minLength={6}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  পাসওয়ার্ড রিসেট করুন
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
