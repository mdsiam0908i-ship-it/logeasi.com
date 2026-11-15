import React, { useEffect, useState } from 'react';
import { Lock, LogOut, PhoneCall, ShieldCheck, Star, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BookingReviewCard } from '../components/BookingReviewCard.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { PaymentGatewayLogo } from '../components/PaymentGatewayLogo.tsx';
import { ReferralInviteWidget } from '../components/ReferralInviteWidget.tsx';
import { BANGLADESH_DIVISIONS, getLocationsForDivision } from '../data/bangladeshRegions.ts';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type {
  BookingRecord,
  PaymentRecord,
  RefundRecord,
  ReviewRecord,
  VerificationRequestRecord,
} from '../types/logeasi.ts';

export function CustomerDashboardPage() {
  const { user, customerProfile, currentPath, refreshSession, logout, navigate } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewRecord[]>([]);
  const [reviewBookingId, setReviewBookingId] = useState<string>('');
  const [blocked, setBlocked] = useState<any[]>([]);
  const [showProfileEditor, setShowProfileEditor] = useState<boolean>(() => {
    const q = currentPath.includes('?') ? currentPath.split('?')[1] : '';
    return new URLSearchParams(q).get('editProfile') === '1';
  });

  useEffect(() => {
    const q = currentPath.includes('?') ? currentPath.split('?')[1] : '';
    if (new URLSearchParams(q).get('editProfile') === '1') {
      setShowProfileEditor(true);
    }
  }, [currentPath]);

  // Profile editor
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [city, setCity] = useState(customerProfile?.city || user?.city || 'Dhaka');
  const [area, setArea] = useState(customerProfile?.area || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
  const [emergencyName, setEmergencyName] = useState(customerProfile?.emergencyContactName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(customerProfile?.emergencyContactPhone || '');

  // Phone verification inside dashboard
  const [phoneInput, setPhoneInput] = useState(user?.phone || '+88017');
  const [otpChallenge, setOtpChallenge] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpPreview, setOtpPreview] = useState('');

  // 2FA setup
  const [totpSecret, setTotpSecret] = useState('');
  const [totpVerifyCode, setTotpVerifyCode] = useState('');

  // Identity verification (NID or School Roll)
  const [verifications, setVerifications] = useState<VerificationRequestRecord[]>([]);
  const [docType, setDocType] = useState<'nid' | 'school_roll' | 'student_id' | 'passport' | 'driving_license'>('nid');
  const [docNumber, setDocNumber] = useState('');
  const [dob, setDob] = useState('1996-05-10');

  const [notice, setNotice] = useState('');

  const loadData = async () => {
    if (!user) return;
    try {
      const [bRes, pRes, blkRes, vRes, rRes] = await Promise.all([
        apiRequest<{ bookings: BookingRecord[] }>('/api/bookings'),
        apiRequest<{ payments: PaymentRecord[]; refunds: RefundRecord[] }>('/api/payments/mine'),
        apiRequest<{ blocked: any[] }>('/api/reports/blocked'),
        apiRequest<{ verifications: VerificationRequestRecord[] }>('/api/verifications/mine'),
        apiRequest<{ reviews: ReviewRecord[] }>('/api/reviews/mine').catch(() => ({ reviews: [] })),
      ]);
      setBookings((bRes.bookings || []).filter((b) => b.customerUid === user.uid));
      setPayments(pRes.payments || []);
      setRefunds(pRes.refunds || []);
      setBlocked(blkRes.blocked || []);
      setVerifications(vRes.verifications || []);
      setMyReviews(rRes.reviews || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhotoUrl(user.photoUrl || '');
      setPhoneInput(user.phone || '+88017');
      setCity(customerProfile?.city || user.city || 'Dhaka');
      setArea(customerProfile?.area || '');
      setEmergencyName(customerProfile?.emergencyContactName || '');
      setEmergencyPhone(customerProfile?.emergencyContactPhone || '');
      loadData();
    }
  }, [user, customerProfile]);

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">কাস্টমার ড্যাশবোর্ড</h1>
        <p className="text-sm text-slate-600">আপনার বুকিং, পেমেন্ট, রিফান্ড ও প্রোফাইল পরিচালনা করতে সাইন ইন করুন।</p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          সাইন ইন করুন
        </button>
      </main>
    );
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/customer/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          city,
          area,
          photoUrl,
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
        }),
      });
      await refreshSession();
      setNotice('কাস্টমার প্রোফাইল সফলভাবে হালনাগাদ হয়েছে।');
    } catch (err: any) {
      setNotice(err.message || 'প্রোফাইল আপডেট ব্যর্থ হয়েছে।');
    }
  };

  const requestPhoneBind = async () => {
    setNotice('');
    try {
      const res = await apiRequest<{ challengeId: string; sandboxOtpPreview?: string }>(
        '/api/auth/phone/request-otp',
        { method: 'POST', body: JSON.stringify({ phone: phoneInput }) }
      );
      setOtpChallenge(res.challengeId);
      setOtpPreview(res.sandboxOtpPreview || '');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const verifyPhoneBind = async () => {
    try {
      await apiRequest('/api/auth/phone/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ challengeId: otpChallenge, code: otpCode }),
      });
      setOtpChallenge('');
      setOtpCode('');
      await refreshSession();
      setNotice('ফোন নম্বর যাচাই ও আপনার প্রোফাইলে যুক্ত হয়েছে।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const start2FA = async () => {
    const res = await apiRequest<{ secret: string }>('/api/auth/2fa/setup', { method: 'POST' });
    setTotpSecret(res.secret);
  };

  const confirm2FA = async () => {
    try {
      await apiRequest('/api/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: totpVerifyCode }),
      });
      setTotpSecret('');
      setTotpVerifyCode('');
      await refreshSession();
      setNotice('দুই-স্তর নিরাপত্তা (TOTP 2FA) চালু হয়েছে।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const disable2FA = async () => {
    await apiRequest('/api/auth/2fa/disable', { method: 'POST' });
    await refreshSession();
    setNotice('দুই-স্তর নিরাপত্তা (2FA) বন্ধ করা হয়েছে।');
  };

  const confirmAgreement = async (bookingId: string) => {
    await apiRequest(`/api/bookings/${bookingId}/agree`, { method: 'POST' });
    await loadData();
    navigate(`/payment/${bookingId}`);
  };

  const markBookingCompleted = async (bookingId: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
      await loadData();
      setReviewBookingId(bookingId);
      setNotice('বুকিং সম্পন্ন হয়েছে! এখন নিচে আপনার সঙ্গীকে রেটিং ও রিভিউ দিন।');
    } catch (err: any) {
      setNotice(err.message || 'বুকিং সম্পন্ন করা যায়নি।');
    }
  };

  const submitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/verifications', {
        method: 'POST',
        body: JSON.stringify({
          documentType: docType,
          documentNumber: docNumber,
          dateOfBirth: dob,
          city,
        }),
      });
      setDocNumber('');
      await loadData();
      setNotice('NID / স্কুল রোল ভেরিফিকেশন সফলভাবে অ্যাডমিন রিভিউয়ের জন্য জমা হয়েছে।');
    } catch (err: any) {
      setNotice(err.message || 'ভেরিফিকেশন জমা ব্যর্থ হয়েছে।');
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
            কাস্টমার ড্যাশবোর্ড
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {user.email || user.phone} · ইমেইল {user.emailVerified ? 'যাচাইকৃত' : 'অযাচাইকৃত'} · ফোন {user.phoneVerified ? 'যাচাইকৃত' : 'অযাচাইকৃত'} · ১৮+ নিশ্চিত
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            সঙ্গী খুঁজুন
          </button>
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            সম্পূর্ণ বুকিং ইতিহাস
          </button>
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            পেমেন্ট ও রসিদ ইতিহাস
          </button>
          <button
            type="button"
            onClick={() => navigate('/referrals')}
            className="px-4 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            রেফারেল ও ক্রেডিট
          </button>
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> সাইন আউট
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">মোট বুকিং</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">{bookings.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">চলমান / নিশ্চিত বুকিং</p>
          <p className="font-mono text-2xl font-bold text-blue-700 tabular-nums mt-1">
            {bookings.filter((b) => ['requested', 'accepted_awaiting_agreement', 'price_agreed_awaiting_payment', 'confirmed_paid'].includes(b.status)).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">যাচাইকৃত পেমেন্ট</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {payments.filter((p) => p.status === 'verified_paid').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">রিফান্ড অনুরোধ</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">{refunds.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Personal Profile (collapsed by default unless ?editProfile=1) + Referral + Phone OTP + 2FA */}
        <div className="lg:col-span-5 space-y-6">
          <ReferralInviteWidget />
          {!showProfileEditor ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-700" /> প্রোফাইল তথ্য
                </h2>
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(true)}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 rounded-lg cursor-pointer"
                >
                  প্রোফাইল আপডেট / এডিট
                </button>
              </div>
              <p className="text-xs text-slate-600">
                {user.fullName} · {city}{area ? `, ${area}` : ''}
              </p>
            </div>
          ) : (
            <form onSubmit={saveProfile} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-700" /> ব্যক্তিগত প্রোফাইল ও জরুরি যোগাযোগ
                </h2>
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  সংক্ষিপ্ত করুন
                </button>
              </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">পূর্ণ নাম</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">জেলা / শহর</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {Array.from(
                    new Set(
                      BANGLADESH_DIVISIONS.flatMap((d) =>
                        d.districts.filter((x) => x !== 'Chittagong' && x !== 'Barisal')
                      )
                    )
                  ).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">এলাকা / মহল্লা</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">এলাকা নির্বাচন করুন</option>
                  {getLocationsForDivision('').map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            <DevicePhotoPicker
              compact
              label="প্রোফাইল ছবি (ডিভাইস থেকে দিন)"
              helperText="ফোন গ্যালারি বা কম্পিউটার থেকে সরাসরি ছবি বেছে নিন।"
              value={photoUrl}
              onChange={setPhotoUrl}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">জরুরি যোগাযোগের নাম</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">জরুরি ফোন নম্বর</label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              প্রোফাইল সংরক্ষণ করুন
            </button>
          </form>
          )}

          {/* Phone OTP Verification */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-700" /> ফোন OTP যাচাই
            </h2>
            <p className="text-xs text-slate-600">
              বর্তমান অবস্থা: {user.phoneVerified ? `যাচাইকৃত (${user.phone})` : 'এখনো যাচাই করা হয়নি'}
            </p>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={requestPhoneBind}
                className="px-3 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                OTP পাঠান
              </button>
            </div>
            {otpChallenge && (
              <div className="space-y-2 pt-2">
                {otpPreview && (
                  <p className="text-xs font-mono bg-slate-100 p-2 rounded">স্যান্ডবক্স OTP: {otpPreview}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="৬-সংখ্যার OTP"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={verifyPhoneBind}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    যাচাই করুন
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2FA Security */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-700" /> দুই-স্তর নিরাপত্তা (2FA)
            </h2>
            {user.twoFactorEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> TOTP 2FA চালু আছে
                </span>
                <button
                  type="button"
                  onClick={disable2FA}
                  className="px-3 py-1.5 border border-red-200 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  2FA বন্ধ করুন
                </button>
              </div>
            ) : !totpSecret ? (
              <button
                type="button"
                onClick={start2FA}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                অথেনটিকেটর 2FA চালু করুন
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Google Authenticator / Authy অ্যাপে এই Base32 সিক্রেটটি যুক্ত করুন:
                </p>
                <p className="font-mono text-xs bg-slate-100 p-2 rounded break-all">{totpSecret}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value)}
                    placeholder="৬-সংখ্যার কোড"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={confirm2FA}
                    className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    সক্রিয় করুন
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 18+ Identity Verification (NID or School Roll) */}
          <form onSubmit={submitVerification} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" /> ১৮+ পরিচয় যাচাই (NID / স্কুল রোল)
            </h2>
            <p className="text-xs text-slate-600">
              জাতীয় পরিচয়পত্র (NID) ছাড়াও স্কুল রোল বা স্টুডেন্ট আইডি দিয়ে ভেরিফিকেশন জমা দিতে পারবেন।
            </p>
            <div className="space-y-2.5">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="nid">জাতীয় পরিচয়পত্র (NID)</option>
                <option value="school_roll">স্কুল রোল (School Roll)</option>
                <option value="student_id">স্টুডেন্ট আইডি (Student ID)</option>
                <option value="passport">পাসপোর্ট (Passport)</option>
                <option value="driving_license">ড্রাইভিং লাইসেন্স</option>
              </select>
              <input
                required
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="NID নম্বর অথবা স্কুল রোল লিখুন"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
              />
              <input
                required
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              NID / স্কুল রোল যাচাইয়ের জন্য পাঠান
            </button>
            {verifications.length > 0 && (
              <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                সর্বশেষ অবস্থা: <span className="font-semibold capitalize">{verifications[0].status}</span> ({verifications[0].documentType.toUpperCase()} {verifications[0].documentNumberMasked})
              </div>
            )}
          </form>
        </div>

        {/* Right: Pending Review Prompt, Active Bookings, Payments, Refunds, Blocked Users */}
        <div className="lg:col-span-7 space-y-6">
          {(() => {
            const reviewsByBooking = new Map<string, ReviewRecord>();
            for (const r of myReviews) reviewsByBooking.set(r.bookingId, r);
            const unreviewedCompleted = bookings.filter(
              (b) => b.status === 'completed' && !reviewsByBooking.has(b.id)
            );
            const targetReviewBooking =
              bookings.find((b) => b.id === reviewBookingId && b.status === 'completed') ||
              unreviewedCompleted[0] ||
              null;

            return (
              <>
                {targetReviewBooking && (
                  <div className="bg-white border border-blue-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          বুকিং শেষে সঙ্গীকে রেটিং ও রিভিউ দিন
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          সম্পন্ন হওয়া বুকিংয়ে আপনার অভিজ্ঞতা অন্য গ্রাহকদের সঠিক সঙ্গী বেছে নিতে সাহায্য করে।
                        </p>
                      </div>
                      {unreviewedCompleted.length > 1 && (
                        <span className="text-xs font-mono text-blue-700 tabular-nums">
                          আরও {unreviewedCompleted.length}টি রিভিউ বাকি
                        </span>
                      )}
                    </div>

                    <BookingReviewCard
                      booking={targetReviewBooking}
                      existingReview={reviewsByBooking.get(targetReviewBooking.id) || null}
                      onReviewSubmitted={(rev) => {
                        setMyReviews((prev) => [rev, ...prev]);
                        setReviewBookingId('');
                        setNotice('আপনার যাচাইকৃত রেটিং ও রিভিউ সফলভাবে প্রকাশিত হয়েছে।');
                      }}
                      onViewCompanion={(uid) => navigate(`/companions/${uid}`)}
                    />
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-950">সাম্প্রতিক বুকিং অনুরোধ</h2>
                  {bookings.length === 0 ? (
                    <p className="text-sm text-slate-500">আপনি এখনো কোনো সঙ্গী বুকিং অনুরোধ পাঠাননি।</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {bookings.slice(0, 6).map((b) => {
                        const existingRev = reviewsByBooking.get(b.id);
                        const canComplete =
                          (['confirmed_paid', 'in_progress'].includes(b.status) || b.advanceStatus === 'paid') &&
                          !['completed', 'cancelled', 'declined'].includes(b.status);

                        return (
                          <div key={b.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono font-semibold text-slate-900">{b.bookingCode}</span>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize font-medium text-blue-700">{b.status.replace(/_/g, ' ')}</span>
                                {existingRev && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono font-semibold text-amber-700 tabular-nums">
                                      ★ {existingRev.rating}/৫ রিভিউ দেওয়া হয়েছে
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-slate-950">
                                {b.companionName} — {b.venueName} ({b.city})
                              </p>
                              <p className="text-xs text-slate-500 font-mono tabular-nums">
                                {b.bookingDate} · {b.startTime} · {formatBdt(b.agreedPriceBdt)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {b.status === 'accepted_awaiting_agreement' && !b.customerAgreed && (
                                <button
                                  type="button"
                                  onClick={() => confirmAgreement(b.id)}
                                  className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  মূল্য মেনে পেমেন্ট করুন
                                </button>
                              )}
                              {b.advanceStatus !== 'paid' && !['declined', 'cancelled', 'completed'].includes(b.status) && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/payment/${b.id}`)}
                                  className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  ৫০% অ্যাডভান্স পেমেন্ট
                                </button>
                              )}
                              {b.advanceStatus === 'paid' && b.status === 'price_agreed_awaiting_payment' && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/payment/${b.id}`)}
                                  className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  বাকি পেমেন্ট করুন
                                </button>
                              )}
                              {canComplete && (
                                <button
                                  type="button"
                                  onClick={() => markBookingCompleted(b.id)}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  সেশন সম্পন্ন করুন
                                </button>
                              )}
                              {b.status === 'completed' && !existingRev && (
                                <button
                                  type="button"
                                  onClick={() => setReviewBookingId(b.id)}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  রেটিং ও রিভিউ দিন
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => navigate('/bookings')}
                                className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                বিস্তারিত
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-950">পেমেন্ট ও রিফান্ড হিসাব</h2>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                সম্পূর্ণ রসিদ ও বকেয়া দেখুন →
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">এখনো কোনো পেমেন্ট রেকর্ড নেই।</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Trx ID</th>
                      <th className="py-2 px-3">গেটওয়ে</th>
                      <th className="py-2 px-3 text-right">পরিমাণ</th>
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
                        <td className="py-2.5 pl-3 capitalize">{p.status.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {refunds.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <h3 className="text-xs font-semibold text-slate-700">রিফান্ডের অবস্থা</h3>
                {refunds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg">
                    <span>{r.reason}</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatBdt(r.amountBdt)} · {r.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {blocked.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
              <h2 className="font-display text-base font-bold text-slate-950">ব্লক করা প্রোফাইল ({blocked.length})</h2>
              <p className="text-xs text-slate-500">ব্লক করা প্রোফাইলগুলো আপনার সার্চ তালিকায় আর দেখাবে না।</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
