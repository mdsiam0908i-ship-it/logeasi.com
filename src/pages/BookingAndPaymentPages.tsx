import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, CreditCard, Lock, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getLocationsForDivision } from '../data/bangladeshRegions.ts';
import {
  containsUnsafeViolenceTerm,
  DEFAULT_BENGALI_BOOKING_CATEGORIES,
  VIOLENCE_SAFETY_MESSAGE_BN,
} from '../data/bookingCategories.ts';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type {
  BookingMessage,
  BookingRecord,
  CompanionProfile,
  PaymentGateway,
  PaymentRecord,
} from '../types/logeasi.ts';

// Page 9: Booking Checkout
export function BookingCheckoutPage({ companionUid }: { companionUid: string }) {
  const { user, platformPublic, navigate } = useAuth();
  const [companion, setCompanion] = useState<CompanionProfile | null>(null);
  const [pricingType, setPricingType] = useState<'hourly' | 'session'>('hourly');
  const [durationHours, setDurationHours] = useState(2);
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date(Date.now() + 86400_000);
    return d.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState('16:00');
  const [city, setCity] = useState('Dhaka');
  const [venueName, setVenueName] = useState('');
  const [category, setCategory] = useState(DEFAULT_BENGALI_BOOKING_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const categoryOptions = useMemo(() => {
    const platformCats =
      platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0
        ? platformPublic.bookingCategories
        : DEFAULT_BENGALI_BOOKING_CATEGORIES;
    return Array.from(new Set([...platformCats, ...(companion?.categories || [])]));
  }, [platformPublic.bookingCategories, companion]);

  const locationOptions = useMemo(() => {
    const base = getLocationsForDivision(companion?.division || 'all');
    if (companion?.city && !base.includes(companion.city)) {
      return [companion.city, ...base];
    }
    return base;
  }, [companion]);

  useEffect(() => {
    apiRequest<{ companion: CompanionProfile }>(`/api/companions/${companionUid}`)
      .then((res) => {
        setCompanion(res.companion);
        setCity(res.companion.city || 'Dhaka');
        const defaultPlatformCat =
          platformPublic.bookingCategories?.[0] || DEFAULT_BENGALI_BOOKING_CATEGORIES[0];
        setCategory(defaultPlatformCat || res.companion.categories?.[0] || 'Dining & Coffee');
      })
      .catch(() => {});
  }, [companionUid]);

  if (!user) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">Sign In to Request Booking</h1>
        <p className="text-sm text-slate-600">Only verified 18+ adult members can submit companion booking requests.</p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          Sign In / Register
        </button>
      </main>
    );
  }

  if (!companion) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </main>
    );
  }

  const totalBdt =
    pricingType === 'session'
      ? companion.sessionRateBdt
      : companion.hourlyRateBdt * durationHours;
  const feePercent = Number(platformPublic.serviceFeePercent ?? 12);
  const platformFeeBdt = Math.round((totalBdt * feePercent) / 100);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const finalCategory =
      category === '__custom__' ? customCategory.trim() : category.trim();
    if (!finalCategory) {
      setError('দয়া করে একটি বুকিং ক্যাটাগরি নির্বাচন করুন বা লিখুন।');
      return;
    }
    if (containsUnsafeViolenceTerm(finalCategory) || containsUnsafeViolenceTerm(notes)) {
      setError(VIOLENCE_SAFETY_MESSAGE_BN);
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ booking: BookingRecord }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          companionUid,
          pricingType,
          durationHours,
          bookingDate,
          startTime,
          city,
          division: companion.division || 'Dhaka',
          venueName,
          category: finalCategory,
          notes,
          proposedTotalBdt: totalBdt,
        }),
      });
      navigate(`/bookings?highlight=${res.booking.id}`);
    } catch (err: any) {
      setError(err.message || 'Unable to submit booking request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight">
        Booking Checkout — {companion.displayName}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={submitRequest} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPricingType('hourly')}
              className={`py-2 rounded-md cursor-pointer ${pricingType === 'hourly' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600'}`}
            >
              Hourly ({formatBdt(companion.hourlyRateBdt)}/hr)
            </button>
            <button
              type="button"
              onClick={() => setPricingType('session')}
              className={`py-2 rounded-md cursor-pointer ${pricingType === 'session' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600'}`}
            >
              4h Session ({formatBdt(companion.sessionRateBdt)})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Date</label>
              <input
                required
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Start Time</label>
              <input
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            {pricingType === 'hourly' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Duration (Hours)</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-mono"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                    <option key={h} value={h}>{h} hours</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">এলাকা / জেলা (Area / District)</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                বুকিং ক্যাটাগরি ও ধরন (বাংলা / English)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">অন্যান্য / নিজের পছন্দমতো ক্যাটাগরি লিখুন...</option>
              </select>
            </div>
          </div>

          {category === '__custom__' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                কাস্টম ক্যাটাগরি লিখুন (বাংলা বা English — ১৮+ শান্তিপূর্ণ আড্ডা/সহায়তা)
              </label>
              <input
                required
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="যেমন: সন্ধ্যার চা আড্ডা ও গল্প / কফি মিটআপ"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">পাবলিক ভেন্যু / মিটআপের জায়গা (Public Venue)</label>
            <input
              required
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="যেমন: ধানমন্ডি লেক চা স্টল / নর্থ এন্ড কফি, গুলশান-২"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              যেমন সঙ্গী ও আউটিং চাই বিস্তারিত লিখুন (Outing Notes)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="চা/স্মোক ব্রেক আড্ডা, কফি আউটিং বা কেমন সময় কাটাতে চান তা বাংলায় লিখুন (মারামারি বা সহিংসতা সম্পূর্ণ নিষিদ্ধ)..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            {busy ? 'Submitting Request...' : 'Submit Booking Request'}
          </button>
        </form>

        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit">
          <h2 className="font-display text-base font-bold text-slate-950">Transparent BDT Summary</h2>
          <div className="space-y-2 text-sm border-b border-slate-100 pb-4">
            <div className="flex justify-between">
              <span className="text-slate-600">Booking Total</span>
              <span className="font-mono font-semibold tabular-nums">{formatBdt(totalBdt)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Includes Platform Service Fee ({feePercent}%)</span>
              <span className="font-mono tabular-nums">{formatBdt(platformFeeBdt)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            No payment is charged now. First, {companion.displayName} reviews your request and both parties agree on the final BDT price before checkout unlocks.
          </p>
        </aside>
      </div>
    </main>
  );
}

// Page 10: Payment Page (Hosted Sandbox Payment Gateway + Signed Server Webhook Verification)
export function PaymentPage({ bookingId }: { bookingId: string }) {
  const { platformPublic, navigate } = useAuth();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [gateway, setGateway] = useState<PaymentGateway>('bkash');
  const [initiatedPayment, setInitiatedPayment] = useState<PaymentRecord | null>(null);
  const [trxReference, setTrxReference] = useState('');
  const [verificationResult, setVerificationResult] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const bkashPersonal = platformPublic.bkashPersonalNumber || '01700-000000';
  const nagadPersonal = platformPublic.nagadPersonalNumber || '01877pokpok';

  const loadBooking = () => {
    apiRequest<{ booking: BookingRecord }>(`/api/bookings/${bookingId}`)
      .then((res) => setBooking(res.booking))
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const initiateCheckout = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ payment: PaymentRecord; sandboxCheckoutReady: boolean }>(
        '/api/payments/initiate',
        {
          method: 'POST',
          body: JSON.stringify({ bookingId, gateway }),
        }
      );
      setInitiatedPayment(res.payment);
      if (gateway === 'cash') {
        setVerificationResult('Cash-on-Meetup booking confirmed within permitted policy limit.');
        loadBooking();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const authorizeSandboxGateway = async (outcome: 'success' | 'fail') => {
    if (!initiatedPayment) return;
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{
        webhookVerified: boolean;
        status: string;
        transactionId: string;
        signaturePrefix: string;
      }>('/api/payments/sandbox-gateway/authorize', {
        method: 'POST',
        body: JSON.stringify({ paymentId: initiatedPayment.id, outcome }),
      });
      if (res.webhookVerified) {
        setVerificationResult(
          `Verified via signed HMAC-SHA256 server webhook (${res.signaturePrefix}). Transaction ${res.transactionId} settled.`
        );
      } else {
        setError('Gateway reported payment failure. Booking remains unpaid.');
      }
      loadBooking();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPersonalTrx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initiatedPayment) return;
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ payment: PaymentRecord }>(
        `/api/payments/${initiatedPayment.id}/submit-personal-trx`,
        {
          method: 'POST',
          body: JSON.stringify({ senderReferenceTrxId: trxReference }),
        }
      );
      setInitiatedPayment(res.payment);
      setTrxReference('');
      loadBooking();
    } catch (err: any) {
      setError(err.message || 'Failed to submit Transaction ID.');
    } finally {
      setBusy(false);
    }
  };

  if (!booking) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        {error ? <p className="text-red-700 text-sm">{error}</p> : <div className="h-64 bg-white border rounded-xl animate-pulse" />}
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-mono text-blue-700">
          PAYMENT MODE: {(platformPublic.paymentMode || 'sandbox').toUpperCase()} · NO CARD/PIN DATA STORED
        </p>
        <h1 className="font-display text-3xl font-bold text-slate-950">
          Secure Payment Checkout
        </h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <p className="font-mono text-xs text-slate-500">{booking.bookingCode}</p>
            <p className="text-base font-semibold text-slate-950">
              {booking.companionName} · {booking.venueName}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-slate-500">Agreed Total</p>
            <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums">
              {formatBdt(booking.agreedPriceBdt)}
            </p>
          </div>
        </div>

        {booking.paymentStatus === 'paid' || verificationResult ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
            <p className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Payment Confirmed & Booking Active
            </p>
            <p className="text-xs text-emerald-800">{verificationResult || 'Your booking payment is verified.'}</p>
            <button
              type="button"
              onClick={() => navigate('/bookings')}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Go to Booking History
            </button>
          </div>
        ) : !initiatedPayment ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Select Bangladesh Payment Method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  id: 'bkash' as PaymentGateway,
                  title: '1. bKash (Personal)',
                  sub: `Send Money: ${bkashPersonal}`,
                },
                {
                  id: 'nagad' as PaymentGateway,
                  title: '2. Nagad (Personal)',
                  sub: `Send Money: ${nagadPersonal}`,
                },
                {
                  id: 'rocket' as PaymentGateway,
                  title: '3. Rocket',
                  sub: 'Hosted Checkout',
                },
                {
                  id: 'sslcommerz' as PaymentGateway,
                  title: '4. SSLCommerz',
                  sub: 'Cards / NetBanking',
                },
                {
                  id: 'cash' as PaymentGateway,
                  title: '5. Cash Payment',
                  sub: `Up to ${formatBdt(platformPublic.maxCashBookingBdt || 3000)}`,
                },
              ].map((gw) => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setGateway(gw.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    gateway === gw.id
                      ? 'border-blue-700 bg-blue-50 text-blue-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <p className="text-sm font-bold">{gw.title}</p>
                  <p className="text-[11px] font-mono text-slate-600 mt-0.5 truncate">{gw.sub}</p>
                </button>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
              <Lock className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <span>
                LOGEASI.COM never collects or stores your MFS PIN, OTP, or card number. Payment confirmation occurs strictly through personal TrxID verification or signed server-side webhooks.
              </span>
            </div>

            {error && <p className="text-xs text-red-700">{error}</p>}

            <button
              type="button"
              disabled={busy}
              onClick={initiateCheckout}
              className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              {busy ? 'Creating Checkout Session...' : `Proceed to ${gateway.toUpperCase()} Checkout`}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {['bkash', 'nagad'].includes(initiatedPayment.gateway) && (
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-blue-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    {initiatedPayment.gateway === 'bkash'
                      ? 'OPTION 1: bKash (PERSONAL) SEND MONEY'
                      : 'OPTION 2: NAGAD (PERSONAL) SEND MONEY'}
                  </span>
                  <span className="text-xs font-mono text-blue-800 tabular-nums">
                    {initiatedPayment.transactionId}
                  </span>
                </div>

                {initiatedPayment.status === 'pending_manual_verification' ? (
                  <div className="p-4 bg-white border border-blue-200 rounded-lg space-y-2">
                    <p className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-700" />
                      TrxID Submitted — Pending Finance Verification
                    </p>
                    <p className="text-xs text-slate-700">
                      Reference TrxID:{' '}
                      <span className="font-mono font-bold text-slate-950">
                        {initiatedPayment.senderReferenceTrxId}
                      </span>{' '}
                      for {formatBdt(initiatedPayment.amountBdt)}. Once verified by Finance Admin, your booking confirms automatically.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submitPersonalTrx} className="space-y-3">
                    <div className="p-3.5 bg-white border border-blue-200 rounded-lg text-xs space-y-1">
                      <p className="text-slate-600">
                        Send Money <span className="font-mono font-bold text-slate-950">{formatBdt(initiatedPayment.amountBdt)}</span> to Personal {initiatedPayment.gateway === 'bkash' ? 'bKash' : 'Nagad'} Number:
                      </p>
                      <p className="font-mono text-lg font-bold text-blue-800 select-all">
                        {initiatedPayment.gateway === 'bkash' ? bkashPersonal : nagadPersonal}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Reference: {booking.bookingCode} · Never share your bKash/Nagad PIN or OTP.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        required
                        type="text"
                        value={trxReference}
                        onChange={(e) => setTrxReference(e.target.value)}
                        placeholder={`Enter your ${initiatedPayment.gateway.toUpperCase()} TrxID (e.g. 9G7H2K1M4P)`}
                        className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-2 text-xs font-mono uppercase"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        Submit TrxID for Verification
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="p-5 bg-slate-950 text-white rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-blue-300">HOSTED SANDBOX GATEWAY ({initiatedPayment.gateway.toUpperCase()})</span>
                <span className="text-xs font-mono tabular-nums">{initiatedPayment.transactionId}</span>
              </div>
              <p className="text-sm text-slate-200">
                Session <span className="font-mono">{initiatedPayment.gatewaySessionId}</span> is awaiting gateway authorization. Triggering authorization sends an HMAC-SHA256 signed server webhook to verify <span className="font-mono">{formatBdt(initiatedPayment.amountBdt)}</span>.
              </p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => authorizeSandboxGateway('success')}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Authorize Sandbox Payment (Signed Webhook)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => authorizeSandboxGateway('fail')}
                  className="px-4 py-2.5 border border-slate-700 hover:bg-slate-900 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Simulate Declined Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Page 11: Booking History + Live Thread + Cancellation + Review
export function BookingHistoryPage() {
  const { user, navigate } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [notice, setNotice] = useState('');

  const loadBookings = async () => {
    if (!user) return;
    const res = await apiRequest<{ bookings: BookingRecord[] }>('/api/bookings');
    setBookings(res.bookings || []);
    if (!activeId && res.bookings?.length) {
      setActiveId(res.bookings[0].id);
    }
  };

  const loadMessages = async (id: string) => {
    if (!id) return;
    try {
      const res = await apiRequest<{ messages: BookingMessage[] }>(`/api/bookings/${id}/messages`);
      setMessages(res.messages || []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [user]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">Booking History</h1>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          Sign In to View Bookings
        </button>
      </main>
    );
  }

  const activeBooking = bookings.find((b) => b.id === activeId);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !msgText.trim()) return;
    await apiRequest(`/api/bookings/${activeId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: msgText }),
    });
    setMsgText('');
    loadMessages(activeId);
  };

  const markCompleted = async (id: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/bookings/${id}/complete`, { method: 'POST' });
      await loadBookings();
      setNotice('Booking marked completed! Earnings released and review unlocked.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const cancelBooking = async (id: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled via booking management' }),
      });
      await loadBookings();
      setNotice('Booking cancelled. If paid, an automatic refund request was opened.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) return;
    setNotice('');
    try {
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: activeBooking.id,
          rating,
          comment: reviewComment,
        }),
      });
      setReviewComment('');
      setNotice('Verified review published to companion profile.');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <h1 className="font-display text-3xl font-bold text-slate-950">Booking History & Coordination</h1>
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          New Booking
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm text-slate-600">No bookings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-3">
            {bookings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveId(b.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                  activeId === b.id
                    ? 'bg-slate-950 text-white border-slate-950'
                    : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono font-semibold">{b.bookingCode}</span>
                  <span className="capitalize">{b.status.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm font-semibold">
                  {user.uid === b.customerUid ? b.companionName : b.customerName}
                </p>
                <p className={`text-xs mt-1 font-mono tabular-nums ${activeId === b.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {b.bookingDate} · {b.venueName} · {formatBdt(b.agreedPriceBdt)}
                </p>
              </button>
            ))}
          </div>

          {activeBooking && (
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="font-mono text-xs text-blue-700">{activeBooking.bookingCode}</p>
                    <h2 className="font-display text-xl font-bold text-slate-950">
                      {activeBooking.venueName} ({activeBooking.city})
                    </h2>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-lg font-bold text-slate-950">{formatBdt(activeBooking.agreedPriceBdt)}</p>
                    <p className="text-xs text-slate-500 capitalize">Payment: {activeBooking.paymentStatus}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeBooking.status === 'price_agreed_awaiting_payment' &&
                    user.uid === activeBooking.customerUid && (
                      <button
                        type="button"
                        onClick={() => navigate(`/payment/${activeBooking.id}`)}
                        className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Proceed to Payment
                      </button>
                    )}
                  {['confirmed_paid', 'in_progress'].includes(activeBooking.status) && (
                    <button
                      type="button"
                      onClick={() => markCompleted(activeBooking.id)}
                      className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Mark Session Completed
                    </button>
                  )}
                  {!['completed', 'cancelled'].includes(activeBooking.status) && (
                    <button
                      type="button"
                      onClick={() => cancelBooking(activeBooking.id)}
                      className="px-4 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Cancel Booking
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/help')}
                    className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                  >
                    Open Dispute / Support
                  </button>
                </div>

                {/* Participant Chat */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Booking Coordination Messages
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 h-48 overflow-y-auto space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-xs text-slate-400">No messages yet. Coordinate meetup time and public landmark here.</p>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className="text-xs">
                          <span className="font-semibold text-slate-900">{m.senderName}: </span>
                          <span className="text-slate-700">{m.body}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      placeholder="Write a coordination message..."
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>

                {/* Review Form when completed */}
                {activeBooking.status === 'completed' && user.uid === activeBooking.customerUid && (
                  <form onSubmit={submitReview} className="pt-4 border-t border-slate-100 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-700" /> Leave Verified Review
                    </h3>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold">Rating:</label>
                      <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="border border-slate-200 rounded px-2 py-1 text-xs"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>{r} Stars</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      required
                      rows={2}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your honest experience..."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Submit Verified Review
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
