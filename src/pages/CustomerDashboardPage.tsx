import React, { useEffect, useState } from 'react';
import { Lock, LogOut, PhoneCall, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { BANGLADESH_DIVISIONS, getLocationsForDivision } from '../data/bangladeshRegions.ts';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type { BookingRecord, PaymentRecord, RefundRecord } from '../types/logeasi.ts';

export function CustomerDashboardPage() {
  const { user, customerProfile, refreshSession, logout, navigate } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);

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
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    if (!user) return;
    try {
      const [bRes, pRes, blkRes] = await Promise.all([
        apiRequest<{ bookings: BookingRecord[] }>('/api/bookings'),
        apiRequest<{ payments: PaymentRecord[]; refunds: RefundRecord[] }>('/api/payments/mine'),
        apiRequest<{ blocked: any[] }>('/api/reports/blocked'),
      ]);
      setBookings((bRes.bookings || []).filter((b) => b.customerUid === user.uid));
      setPayments(pRes.payments || []);
      setRefunds(pRes.refunds || []);
      setBlocked(blkRes.blocked || []);
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
        <h1 className="font-display text-2xl font-bold text-slate-950">Customer Dashboard</h1>
        <p className="text-sm text-slate-600">Sign in to manage your bookings, payments, refunds, and profile.</p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          Sign In
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
      setNotice('Customer profile updated.');
    } catch (err: any) {
      setNotice(err.message || 'Update failed.');
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
      setNotice('Phone number verified and linked to your profile.');
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
      setNotice('Two-Factor Authentication (TOTP) enabled.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const disable2FA = async () => {
    await apiRequest('/api/auth/2fa/disable', { method: 'POST' });
    await refreshSession();
    setNotice('Two-Factor Authentication disabled.');
  };

  const confirmAgreement = async (bookingId: string) => {
    await apiRequest(`/api/bookings/${bookingId}/agree`, { method: 'POST' });
    await loadData();
    navigate(`/payment/${bookingId}`);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
            Customer Dashboard
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {user.email || user.phone} · Email {user.emailVerified ? 'Verified' : 'Unverified'} · Phone {user.phoneVerified ? 'Verified' : 'Unverified'} · 18+ Confirmed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Browse Companions
          </button>
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Full Booking History
          </button>
          <button
            type="button"
            onClick={logout}
            className="px-3.5 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
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
          <p className="text-xs text-slate-500">Total Bookings</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">{bookings.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Active / Confirmed</p>
          <p className="font-mono text-2xl font-bold text-blue-700 tabular-nums mt-1">
            {bookings.filter((b) => ['requested', 'accepted_awaiting_agreement', 'price_agreed_awaiting_payment', 'confirmed_paid'].includes(b.status)).length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Verified Payments</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {payments.filter((p) => p.status === 'verified_paid').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Refund Requests</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">{refunds.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Personal Profile + Phone OTP + 2FA */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={saveProfile} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-700" /> Personal Profile & Safety Contact
            </h2>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">District / City (Bangladesh)</label>
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
                <label className="text-xs font-semibold text-slate-700">Neighborhood / Area</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select Area</option>
                  {getLocationsForDivision('').map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            <DevicePhotoPicker
              compact
              label="Profile Picture (From Device)"
              helperText="Select a photo directly from your phone or computer."
              value={photoUrl}
              onChange={setPhotoUrl}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Emergency Contact</label>
                <input
                  type="text"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Emergency Phone</label>
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
              Save Personal Profile
            </button>
          </form>

          {/* Phone OTP Verification */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-700" /> Phone OTP Verification
            </h2>
            <p className="text-xs text-slate-600">
              Current Status: {user.phoneVerified ? `Verified (${user.phone})` : 'Not verified'}
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
                Send OTP
              </button>
            </div>
            {otpChallenge && (
              <div className="space-y-2 pt-2">
                {otpPreview && (
                  <p className="text-xs font-mono bg-slate-100 p-2 rounded">Sandbox OTP: {otpPreview}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="6-digit OTP"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={verifyPhoneBind}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2FA Security */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-700" /> Two-Factor Authentication (2FA)
            </h2>
            {user.twoFactorEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> TOTP 2FA Active
                </span>
                <button
                  type="button"
                  onClick={disable2FA}
                  className="px-3 py-1.5 border border-red-200 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Disable 2FA
                </button>
              </div>
            ) : !totpSecret ? (
              <button
                type="button"
                onClick={start2FA}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Enable Authenticator 2FA
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Add this Base32 secret to Google Authenticator / Authy:
                </p>
                <p className="font-mono text-xs bg-slate-100 p-2 rounded break-all">{totpSecret}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value)}
                    placeholder="6-digit code"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={confirm2FA}
                    className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Activate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Bookings, Payments, Refunds, Blocked Users */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-950">Recent Booking Requests</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">You have not requested any companion bookings yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.slice(0, 6).map((b) => (
                  <div key={b.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-900">{b.bookingCode}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize font-medium text-blue-700">{b.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-950">
                        {b.companionName} — {b.venueName} ({b.city})
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {b.bookingDate} at {b.startTime} · {formatBdt(b.agreedPriceBdt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.status === 'accepted_awaiting_agreement' && !b.customerAgreed && (
                        <button
                          type="button"
                          onClick={() => confirmAgreement(b.id)}
                          className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Accept Price & Pay
                        </button>
                      )}
                      {b.status === 'price_agreed_awaiting_payment' && (
                        <button
                          type="button"
                          onClick={() => navigate(`/payment/${b.id}`)}
                          className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Pay Now
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate('/bookings')}
                        className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-950">Payment & Refund Ledger</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Txn ID</th>
                      <th className="py-2 px-3">Gateway</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-3 font-mono text-slate-900">{p.transactionId}</td>
                        <td className="py-2.5 px-3 uppercase">{p.gateway} ({p.mode})</td>
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
                <h3 className="text-xs font-semibold text-slate-700">Refund Status</h3>
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
              <h2 className="font-display text-base font-bold text-slate-950">Blocked Profiles ({blocked.length})</h2>
              <p className="text-xs text-slate-500">Blocked users are hidden from your companion search results.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
