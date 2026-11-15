import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Lock,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Truck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { BookingReviewCard } from '../components/BookingReviewCard.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { PaymentGatewayLogo } from '../components/PaymentGatewayLogo.tsx';
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
  ReviewRecord,
} from '../types/logeasi.ts';

// Page 9: Booking Checkout
export function BookingCheckoutPage({ companionUid }: { companionUid: string }) {
  const { user, platformPublic, refreshSession, navigate } = useAuth();
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
  const [useCredits, setUseCredits] = useState(false);
  const [creditsInput, setCreditsInput] = useState(0);
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
        <h1 className="font-display text-2xl font-bold text-slate-950">বুকিং করতে সাইন ইন করুন</h1>
        <p className="text-sm text-slate-600">শুধুমাত্র ১৮+ যাচাইকৃত সদস্যরাই সঙ্গী বুকিং অনুরোধ পাঠাতে পারবেন।</p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          সাইন ইন / সাইন আপ
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
  const availableCredits = Math.max(0, Math.round(Number(user.referralCreditsBdt || 0)));
  const maxRedeemable = Math.min(availableCredits, Math.floor(totalBdt * 0.5));
  const appliedCredits = useCredits
    ? Math.max(0, Math.min(maxRedeemable, Math.floor(Number(creditsInput) || 0)))
    : 0;
  const netTotalBdt = Math.max(250, totalBdt - appliedCredits);
  const advanceRequiredBdt = Math.round(netTotalBdt / 2);
  const remainingDueBdt = Math.max(0, netTotalBdt - advanceRequiredBdt);
  const feePercent = Number(platformPublic.serviceFeePercent ?? 12);
  const platformFeeBdt = Math.round((netTotalBdt * feePercent) / 100);

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
          creditsToApplyBdt: appliedCredits,
        }),
      });
      await refreshSession();
      navigate(`/payment/${res.booking.id}`);
    } catch (err: any) {
      setError(err.message || 'Unable to submit booking request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight">
        বুকিং চেকআউট — {companion.displayName}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={submitRequest} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPricingType('hourly')}
              className={`py-2 rounded-md cursor-pointer ${pricingType === 'hourly' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600'}`}
            >
              ঘণ্টা প্রতি ({formatBdt(companion.hourlyRateBdt)}/ঘণ্টা)
            </button>
            <button
              type="button"
              onClick={() => setPricingType('session')}
              className={`py-2 rounded-md cursor-pointer ${pricingType === 'session' ? 'bg-white shadow-sm text-slate-950' : 'text-slate-600'}`}
            >
              ৪-ঘণ্টা সেশন ({formatBdt(companion.sessionRateBdt)})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">তারিখ</label>
              <input
                required
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">শুরুর সময়</label>
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
                <label className="text-xs font-semibold text-slate-700">সময়কাল (ঘণ্টা)</label>
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white font-mono"
                >
                  {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                    <option key={h} value={h}>{h} ঘণ্টা</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">এলাকা / জেলা</label>
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
                বুকিং ক্যাটাগরি ও ধরন
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
                কাস্টম ক্যাটাগরি লিখুন (১৮+ শান্তিপূর্ণ সামাজিক আড্ডা ও বৈধ সহায়তা)
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
            <label className="text-xs font-semibold text-slate-700">পাবলিক ভেন্যু / মিটআপের জায়গা</label>
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
              যেমন সঙ্গী ও আউটিং চাই বিস্তারিত লিখুন
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="চা/সিগারেট ব্রেক আড্ডা, ঘোরাফেরা, কফি আউটিং বা কেমন সময় কাটাতে চান তা বাংলায় লিখুন (সহিংসতা বা বেআইনি কাজ সম্পূর্ণ নিষিদ্ধ)..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {availableCredits > 0 && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCredits}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setUseCredits(next);
                      if (next && creditsInput <= 0) {
                        setCreditsInput(maxRedeemable);
                      }
                    }}
                  />
                  <Gift className="w-4 h-4 text-blue-700" />
                  রেফারেল ক্রেডিট পয়েন্ট ব্যবহার করুন
                </label>
                <span className="font-mono text-xs font-bold text-blue-800 tabular-nums">
                  ব্যালেন্স: {availableCredits} পয়েন্ট ({formatBdt(availableCredits)})
                </span>
              </div>
              {useCredits && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      কত ক্রেডিট ব্যবহার করবেন (সর্বোচ্চ {maxRedeemable} পয়েন্ট / ৫০%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={maxRedeemable}
                      value={creditsInput}
                      onChange={(e) => setCreditsInput(Math.min(maxRedeemable, Math.max(0, Number(e.target.value) || 0)))}
                      className="w-full bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ১ ক্রেডিট পয়েন্ট = ১ টাকা। ক্রেডিট ছাড়ের পর বাকি নিট টাকার উপর ৫০% অ্যাডভান্স প্রযোজ্য হবে।
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            {busy ? 'বুকিং তৈরি হচ্ছে...' : 'বুকিং কনফার্ম করে ৫০% অ্যাডভান্স পেমেন্টে যান'}
          </button>
        </form>

        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit">
          <h2 className="font-display text-base font-bold text-slate-950">স্বচ্ছ BDT ও ৫০% অ্যাডভান্স হিসাব</h2>
          <div className="space-y-2 text-sm border-b border-slate-100 pb-4">
            <div className="flex justify-between">
              <span className="text-slate-600">মূল বুকিং খরচ</span>
              <span className="font-mono font-semibold tabular-nums">{formatBdt(totalBdt)}</span>
            </div>
            {appliedCredits > 0 && (
              <>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>রেফারেল ক্রেডিট ছাড় ({appliedCredits} পয়েন্ট)</span>
                  <span className="font-mono tabular-nums">-{formatBdt(appliedCredits)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-950 pt-1 border-t border-slate-100">
                  <span>নিট বুকিং মূল্য</span>
                  <span className="font-mono tabular-nums">{formatBdt(netTotalBdt)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-blue-800 font-semibold">
              <span>প্রথমে ৫০% অ্যাডভান্স (বাধ্যতামূলক)</span>
              <span className="font-mono tabular-nums">{formatBdt(advanceRequiredBdt)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>বাকি ৫০% (সেশনের সময়)</span>
              <span className="font-mono tabular-nums">{formatBdt(remainingDueBdt)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>প্ল্যাটফর্ম সার্ভিস ফি অন্তর্ভুক্ত ({feePercent}%)</span>
              <span className="font-mono tabular-nums">{formatBdt(platformFeeBdt)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-3">
            বুকিং করার পর প্রথমে আপনাকে নিট মোট টাকার ৫০% অ্যাডভান্স অ্যাডমিনের পার্সোনাল বিকাশ / পার্সোনাল নগদ / কাস্টম পার্সোনাল অপশন অথবা সমপরিমাণ বেনসন সিগারেট পেমেন্টের মাধ্যমে সম্পন্ন করতে হবে।
          </p>
        </aside>
      </div>
    </main>
  );
}

// Page 10: Payment Page (Mandatory 50% Advance via Admin Personal/Custom Send Money)
export function PaymentPage({ bookingId }: { bookingId: string }) {
  const { platformPublic, navigate } = useAuth();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [gateway, setGateway] = useState<PaymentGateway>('bkash');
  const [initiatedPayment, setInitiatedPayment] = useState<PaymentRecord | null>(null);
  const [trxReference, setTrxReference] = useState('');
  const [bensonDeliveryMode, setBensonDeliveryMode] = useState<'in_person' | 'send_delivery'>('in_person');
  const [bensonProofPhotoUrl, setBensonProofPhotoUrl] = useState('');
  const [verificationResult, setVerificationResult] = useState<string>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const bkashPersonal = platformPublic.bkashPersonalNumber || '01700-000000';
  const nagadPersonal = platformPublic.nagadPersonalNumber || '01877pokpok';
  const customLabel = platformPublic.customPaymentLabel || '৩. অ্যাডমিন পার্সোনাল / কাস্টম সেন্ড মানি';
  const customNumber = platformPublic.customPaymentNumber || bkashPersonal;
  const customInstructions =
    platformPublic.customPaymentInstructions ||
    'অ্যাডমিনের এই পার্সোনাল নম্বরে ৫০% অ্যাডভান্স সেন্ড মানি করে TrxID জমা দিন।';
  const bensonLabel =
    platformPublic.bensonPaymentLabel || '৪. বেনসন সিগারেট পেমেন্ট (১,০০০৳ = ৩ প্যাকেট)';
  const bensonBaseBdt = Math.max(100, Number(platformPublic.bensonBaseBdt || 1000));
  const bensonPacketsPerBase = Math.max(1, Number(platformPublic.bensonPacketsPerBase || 3));
  const bensonItemName = platformPublic.bensonItemName || 'প্যাকেট বেনসন সিগারেট';
  const bensonContactNumber = platformPublic.bensonContactNumber || bkashPersonal;
  const bensonInstructions =
    platformPublic.bensonPaymentInstructions ||
    'প্রতি ১,০০০ টাকা সমান ৩ প্যাকেট বেনসন সিগারেট। নির্ধারিত প্যাকেট হস্তান্তর করে ডেলিভারি রেফারেন্স/ফোন নম্বর লিখে জমা দিন।';

  const calcPacketsText = (amtBdt: number) => {
    const raw = (amtBdt / bensonBaseBdt) * bensonPacketsPerBase;
    const count = Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
    return `${count} ${bensonItemName}`;
  };

  const loadBooking = async () => {
    try {
      const [bRes, pRes] = await Promise.all([
        apiRequest<{ booking: BookingRecord }>(`/api/bookings/${bookingId}`),
        apiRequest<{ payments: PaymentRecord[] }>('/api/payments/mine').catch(() => ({ payments: [] })),
      ]);
      setBooking(bRes.booking);
      const related = (pRes.payments || []).filter((p) => p.bookingId === bookingId);
      const activePay =
        related.find((p) => p.status === 'pending_manual_verification') ||
        related.find((p) => p.status === 'initiated') ||
        null;
      if (activePay) {
        setInitiatedPayment(activePay);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const advanceDone = Boolean(booking && (booking.advanceStatus === 'paid' || booking.paymentStatus === 'paid'));
  const isAdvanceStage = !advanceDone;
  const advanceAmountBdt = booking ? booking.advanceRequiredBdt || Math.round(booking.agreedPriceBdt / 2) : 0;
  const remainingDueBdt = booking
    ? booking.remainingDueBdt !== undefined
      ? Number(booking.remainingDueBdt)
      : Math.max(0, booking.agreedPriceBdt - Number(booking.advancePaidBdt || 0))
    : 0;
  const payableNowBdt = isAdvanceStage ? advanceAmountBdt : remainingDueBdt;

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
        setVerificationResult('বাকি টাকার জন্য ক্যাশ-অন-মিটআপ নিশ্চিত হয়েছে।');
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
          `স্বাক্ষরিত HMAC-SHA256 ওয়েবহুক (${res.signaturePrefix}) দ্বারা যাচাইকৃত। ট্রানজেকশন ${res.transactionId} সম্পন্ন।`
        );
      } else {
        setError('গেটওয়ে পেমেন্ট ব্যর্থ হয়েছে।');
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

    if (initiatedPayment.gateway === 'benson' && !bensonProofPhotoUrl) {
      setError('বেনসন সিগারেট কিনে প্যাকেটের স্পষ্ট ছবি তুলে আপলোড করা বাধ্যতামূলক। দেখা করে দিন বা সেন্ড করুন—সিগারেটের ছবি ছাড়া জমা দেওয়া যাবে না।');
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, any> = {
        senderReferenceTrxId: trxReference,
      };
      if (initiatedPayment.gateway === 'benson') {
        payload.bensonDeliveryMode = bensonDeliveryMode;
        payload.proofPhotoUrl = bensonProofPhotoUrl;
      }

      const res = await apiRequest<{ payment: PaymentRecord }>(
        `/api/payments/${initiatedPayment.id}/submit-personal-trx`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setInitiatedPayment(res.payment);
      setTrxReference('');
      setBensonProofPhotoUrl('');
      loadBooking();
    } catch (err: any) {
      setError(err.message || 'TrxID / প্রমাণ জমা দেওয়া যায়নি।');
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

  const adminPersonalOptions: Array<{ id: PaymentGateway; title: string; sub: string }> = [
    {
      id: 'bkash',
      title: '১. বিকাশ পার্সোনাল (সেন্ড মানি)',
      sub: `অ্যাডমিন নম্বর: ${bkashPersonal}`,
    },
    {
      id: 'nagad',
      title: '২. নগদ পার্সোনাল (সেন্ড মানি)',
      sub: `অ্যাডমিন নম্বর: ${nagadPersonal}`,
    },
    {
      id: 'custom',
      title: customLabel,
      sub: `অ্যাডমিন নম্বর: ${customNumber}`,
    },
    {
      id: 'benson',
      title: bensonLabel,
      sub: `${formatBdt(payableNowBdt)} = ${calcPacketsText(payableNowBdt)}`,
    },
  ];

  const availableGateways = isAdvanceStage
    ? adminPersonalOptions
    : [
        ...adminPersonalOptions,
        {
          id: 'rocket' as PaymentGateway,
          title: '৫. রকেট (Rocket)',
          sub: 'হোস্টেড চেকআউট',
        },
        {
          id: 'sslcommerz' as PaymentGateway,
          title: '৬. SSLCommerz',
          sub: 'কার্ড / নেটব্যাংকিং',
        },
        {
          id: 'cash' as PaymentGateway,
          title: '৭. ক্যাশ পেমেন্ট',
          sub: `${formatBdt(platformPublic.maxCashBookingBdt || 3000)} পর্যন্ত`,
        },
      ];

  const getReceivingNumber = (gw: PaymentGateway) => {
    if (gw === 'bkash') return bkashPersonal;
    if (gw === 'nagad') return nagadPersonal;
    if (gw === 'benson') return bensonContactNumber;
    return customNumber;
  };

  const getGatewayTitle = (gw: PaymentGateway) => {
    if (gw === 'bkash') return 'অপশন ১: অ্যাডমিন বিকাশ (পার্সোনাল) সেন্ড মানি';
    if (gw === 'nagad') return 'অপশন ২: অ্যাডমিন নগদ (পার্সোনাল) সেন্ড মানি';
    if (gw === 'benson') return `অপশন ৪: ${bensonLabel}`;
    return `অপশন ৩: ${customLabel}`;
  };

  const fullyPaid = booking.paymentStatus === 'paid' || remainingDueBdt <= 0;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-mono text-blue-700">
          {isAdvanceStage
            ? 'ধাপ ১: বাধ্যতামূলক ৫০% অ্যাডভান্স পেমেন্ট (অ্যাডমিন পার্সোনাল / কাস্টম অপশন)'
            : 'ধাপ ২: অবশিষ্ট ৫০% পেমেন্ট'} · কোনো PIN সংরক্ষণ করা হয় না
        </p>
        <h1 className="font-display text-3xl font-bold text-slate-950">
          {isAdvanceStage ? '৫০% অ্যাডভান্স পেমেন্ট চেকআউট' : 'নিরাপদ পেমেন্ট চেকআউট'}
        </h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <p className="font-mono text-xs text-slate-500">{booking.bookingCode}</p>
            <p className="text-base font-semibold text-slate-950">
              {booking.companionName} · {booking.venueName}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              মোট ভাড়া: {formatBdt(booking.agreedPriceBdt)} · ৫০% অ্যাডভান্স: {formatBdt(advanceAmountBdt)} · বাকি: {formatBdt(remainingDueBdt)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-blue-700 font-semibold">
              {isAdvanceStage ? 'এখন পরিশোধযোগ্য (৫০% অ্যাডভান্স)' : 'এখন পরিশোধযোগ্য (বাকি ৫০%)'}
            </p>
            <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums">
              {formatBdt(payableNowBdt)}
            </p>
          </div>
        </div>

        {fullyPaid || verificationResult ? (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
            <p className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> পেমেন্ট সম্পন্ন ও বুকিং কনফার্ম হয়েছে
            </p>
            <p className="text-xs text-emerald-800">{verificationResult || 'আপনার বুকিং পেমেন্ট সফলভাবে যাচাই করা হয়েছে।'}</p>
            <button
              type="button"
              onClick={() => navigate('/bookings')}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              বুকিং ইতিহাসে যান
            </button>
          </div>
        ) : !initiatedPayment ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 leading-relaxed">
              {isAdvanceStage ? (
                <span>
                  <strong>বাধ্যতামূলক নিয়ম:</strong> বুকিং করার পর প্রথমে মোট ভাড়ার <strong>৫০% ({formatBdt(advanceAmountBdt)}) অ্যাডভান্স</strong> শুধুমাত্র অ্যাডমিনের পার্সোনাল বিকাশ, পার্সোনাল নগদ অথবা অ্যাডমিন কাস্টম পার্সোনাল অপশনে সেন্ড মানি করে সম্পন্ন করতে হবে।
                </span>
              ) : (
                <span>আপনার ৫০% অ্যাডভান্স পরিশোধিত হয়েছে। এখন বাকি ৫০% ({formatBdt(remainingDueBdt)}) পরিশোধ করতে পারেন।</span>
              )}
            </div>

            <h2 className="text-sm font-semibold text-slate-900">
              অ্যাডমিনের পার্সোনাল / কাস্টম বা বেনসন সিগারেট পেমেন্ট অপশন নির্বাচন করুন
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableGateways.map((gw) => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setGateway(gw.id)}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-3.5 ${
                    gateway === gw.id
                      ? 'border-blue-700 bg-blue-50 text-blue-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <PaymentGatewayLogo gateway={gw.id} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug">{gw.title}</p>
                    <p className="text-[11px] font-mono text-slate-600 mt-0.5 truncate">{gw.sub}</p>
                  </div>
                </button>
              ))}
            </div>

            {gateway === 'benson' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-3.5">
                <PaymentGatewayLogo gateway="benson" size="lg" />
                <div className="space-y-1.5 min-w-0">
                  <p className="font-bold">
                    বিনিময় হিসাব: {formatBdt(bensonBaseBdt)} = {bensonPacketsPerBase} {bensonItemName}
                  </p>
                  <p>
                    এই ধাপে পরিশোধযোগ্য {formatBdt(payableNowBdt)} টাকার সমান{' '}
                    <span className="font-bold underline">{calcPacketsText(payableNowBdt)}</span> দিতে হবে।{' '}
                    দেখা করে হাতে হাতে দিন অথবা কুরিয়ার/রাইডারে সেন্ড করুন — <strong>তবে টাকার বদলে অবশ্যই আসল বেনসন সিগারেটই দিতে হবে এবং কেনার পর সিগারেটের ছবি তুলে প্রমাণ জমা দিতে হবে।</strong>
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
              <Lock className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <span>
                {gateway === 'benson' ? bensonInstructions : customInstructions} LOGEASI.COM কখনোই আপনার বিকাশ/নগদ PIN বা OTP সংগ্রহ করে না।
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
              {busy
                ? 'পেমেন্ট সেশন তৈরি হচ্ছে...'
                : gateway === 'benson'
                  ? `${formatBdt(payableNowBdt)} (${calcPacketsText(payableNowBdt)}) সিগারেট পেমেন্টে এগিয়ে যান`
                  : `${formatBdt(payableNowBdt)} পেমেন্টের জন্য এগিয়ে যান`}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {['bkash', 'nagad', 'custom', 'benson'].includes(initiatedPayment.gateway) && (
              <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-blue-900 flex items-center gap-2">
                    <PaymentGatewayLogo gateway={initiatedPayment.gateway} size="sm" />
                    <Smartphone className="w-4 h-4 shrink-0" />
                    {getGatewayTitle(initiatedPayment.gateway)}
                  </span>
                  <span className="text-xs font-mono text-blue-800 tabular-nums">
                    {initiatedPayment.transactionId}
                  </span>
                </div>

                {initiatedPayment.status === 'pending_manual_verification' ? (
                  <div className="p-4 bg-white border border-blue-200 rounded-lg space-y-3">
                    <p className="text-sm font-bold text-slate-950 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-700" />
                      {initiatedPayment.gateway === 'benson'
                        ? 'বেনসন সিগারেটের ছবিসহ প্রমাণ জমা হয়েছে — অ্যাডমিন যাচাইয়ের অপেক্ষায়'
                        : '৫০% অ্যাডভান্স TrxID জমা হয়েছে — অ্যাডমিন যাচাইয়ের অপেক্ষায়'}
                    </p>
                    <p className="text-xs text-slate-700">
                      জমাকৃত রেফারেন্স/TrxID:{' '}
                      <span className="font-mono font-bold text-slate-950">
                        {initiatedPayment.senderReferenceTrxId}
                      </span>{' '}
                      ({formatBdt(initiatedPayment.amountBdt)}
                      {initiatedPayment.equivalentItemLabel ? ` · ${initiatedPayment.equivalentItemLabel}` : ''})।
                      {initiatedPayment.bensonDeliveryMode && (
                        <>
                          {' '}পদ্ধতি:{' '}
                          <span className="font-semibold text-slate-900">
                            {initiatedPayment.bensonDeliveryMode === 'in_person'
                              ? 'দেখা করে সরাসরি হস্তান্তর'
                              : 'রাইডার / কুরিয়ারে সেন্ড'}
                          </span>।
                        </>
                      )}{' '}
                      ফিন্যান্স অ্যাডমিন যাচাই করলেই আপনার পেমেন্ট ও বুকিং কনফার্ম হবে।
                    </p>
                    {initiatedPayment.proofPhotoUrl && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-amber-700" /> জমাকৃত কেনা বেনসন সিগারেটের প্রমাণ ছবি
                        </p>
                        <img
                          src={initiatedPayment.proofPhotoUrl}
                          alt="কেনা বেনসন সিগারেটের প্রমাণ"
                          className="max-h-44 rounded-lg border border-slate-200 object-contain bg-white"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/bookings')}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      বুকিং ইতিহাসে ফিরে যান
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitPersonalTrx} className="space-y-4">
                    {initiatedPayment.gateway === 'benson' ? (
                      <>
                        <div className="p-3.5 bg-white border border-amber-200 rounded-lg text-xs flex flex-col sm:flex-row items-start gap-3.5">
                          <PaymentGatewayLogo gateway="benson" size="lg" />
                          <div className="space-y-1.5 flex-1">
                            <p className="text-slate-700">
                              নির্ধারিত বিনিময় হিসাব:{' '}
                              <span className="font-bold text-slate-950">
                                {formatBdt(bensonBaseBdt)} = {bensonPacketsPerBase} {bensonItemName}
                              </span>
                            </p>
                            <p className="text-lg font-bold text-amber-800">
                              মোট দিতে হবে: {initiatedPayment.equivalentItemLabel || calcPacketsText(initiatedPayment.amountBdt)}{' '}
                              <span className="text-xs font-mono text-slate-600">
                                ({formatBdt(initiatedPayment.amountBdt)} সমমূল্য)
                              </span>
                            </p>
                            <p className="text-slate-700">
                              অ্যাডমিন যোগাযোগ / হস্তান্তর নম্বর:{' '}
                              <span className="font-mono font-bold text-blue-800 select-all">
                                {getReceivingNumber('benson')}
                              </span>
                            </p>
                            <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                              দেখা করে হাতে হাতে দিন বা রাইডার/কুরিয়ারে সেন্ড করুন — উভয়ই গ্রহণযোগ্য, তবে <strong>সিগারেটই লাগবে</strong>। সিগারেট কেনার পর নিচে অবশ্যই প্যাকেটের ছবি তুলে বা গ্যালারি থেকে আপলোড করে প্রমাণ জমা দিন।
                            </p>
                          </div>
                        </div>

                        {/* Delivery mode selector */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-800">
                            ১. কীভাবে বেনসন সিগারেট পাঠাবেন / হস্তান্তর করবেন?
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <button
                              type="button"
                              onClick={() => setBensonDeliveryMode('in_person')}
                              aria-pressed={bensonDeliveryMode === 'in_person'}
                              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                                bensonDeliveryMode === 'in_person'
                                  ? 'border-blue-700 bg-white text-blue-950 ring-1 ring-blue-700'
                                  : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-white'
                              }`}
                            >
                              <UserCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold">দেখা করে হাতে হাতে দেব</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  সরাসরি দেখা করে নির্ধারিত বেনসন প্যাকেট হস্তান্তর
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setBensonDeliveryMode('send_delivery')}
                              aria-pressed={bensonDeliveryMode === 'send_delivery'}
                              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-2.5 ${
                                bensonDeliveryMode === 'send_delivery'
                                  ? 'border-blue-700 bg-white text-blue-950 ring-1 ring-blue-700'
                                  : 'border-slate-200 bg-white/80 text-slate-700 hover:bg-white'
                              }`}
                            >
                              <Truck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold">রাইডার / কুরিয়ারে সেন্ড করব</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  পাঠাও/উবার পার্সেল বা কুরিয়ারে সিগারেট পাঠানো
                                </p>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Mandatory Bought Cigarette Photo Proof */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-800">
                            ২. কেনা বেনসন সিগারেটের ছবি তুলে প্রমাণ আপলোড করুন <span className="text-red-600">*</span>
                          </p>
                          <DevicePhotoPicker
                            allowCameraCapture
                            required
                            label="কেনা বেনসন সিগারেট প্যাকেটের ছবি (বাধ্যতামূলক)"
                            helperText="দোকান থেকে বেনসন সিগারেট কিনে প্যাকেটের স্পষ্ট ছবি সরাসরি ক্যামেরা দিয়ে তুলুন অথবা গ্যালারি থেকে আপলোড করুন।"
                            value={bensonProofPhotoUrl}
                            onChange={setBensonProofPhotoUrl}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="p-3.5 bg-white border border-blue-200 rounded-lg text-xs space-y-1.5">
                        <p className="text-slate-600">
                          অ্যাডমিনের এই পার্সোনাল নম্বরে{' '}
                          <span className="font-mono font-bold text-slate-950">
                            {formatBdt(initiatedPayment.amountBdt)}
                          </span>{' '}
                          সেন্ড মানি করুন:
                        </p>
                        <p className="font-mono text-xl font-bold text-blue-800 select-all">
                          {getReceivingNumber(initiatedPayment.gateway)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          রেফারেন্স: {booking.bookingCode} · টাকা পাঠানোর পর নিচে আপনার Transaction ID (TrxID) লিখুন। কখনোই PIN বা OTP দেবেন না।
                        </p>
                      </div>
                    )}

                    {error && <p className="text-xs font-medium text-red-700">{error}</p>}

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        required
                        type="text"
                        value={trxReference}
                        onChange={(e) => setTrxReference(e.target.value)}
                        placeholder={
                          initiatedPayment.gateway === 'benson'
                            ? bensonDeliveryMode === 'send_delivery'
                              ? '৩. রাইডার পার্সেল কোড / আপনার ফোন নম্বর লিখুন'
                              : '৩. কোথায় ও কখন দেখা করে দেবেন + আপনার ফোন নম্বর'
                            : 'আপনার সেন্ড মানি TrxID লিখুন (যেমন: 9G7H2K1M4P)'
                        }
                        className="flex-1 bg-white border border-blue-300 rounded-lg px-3 py-2 text-xs font-mono"
                      />
                      <button
                        type="submit"
                        disabled={busy || (initiatedPayment.gateway === 'benson' && !bensonProofPhotoUrl)}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {busy
                          ? 'জমা হচ্ছে...'
                          : initiatedPayment.gateway === 'benson'
                            ? 'সিগারেটের ছবিসহ প্রমাণ জমা দিন'
                            : 'TrxID যাচাইয়ের জন্য পাঠান'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {initiatedPayment.paymentStage !== 'advance_50' && !['bkash', 'nagad', 'custom', 'benson'].includes(initiatedPayment.gateway) && (
              <div className="p-5 bg-slate-950 text-white rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-blue-300 flex items-center gap-2">
                    <PaymentGatewayLogo gateway={initiatedPayment.gateway} size="xs" />
                    হোস্টেড স্যান্ডবক্স গেটওয়ে ({initiatedPayment.gateway.toUpperCase()})
                  </span>
                  <span className="text-xs font-mono tabular-nums">{initiatedPayment.transactionId}</span>
                </div>
                <p className="text-sm text-slate-200">
                  সেশন <span className="font-mono">{initiatedPayment.gatewaySessionId}</span> অনুমোদনের অপেক্ষায়।
                </p>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => authorizeSandboxGateway('success')}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    স্যান্ডবক্স পেমেন্ট অনুমোদন করুন
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => authorizeSandboxGateway('fail')}
                    className="px-4 py-2.5 border border-slate-700 hover:bg-slate-900 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    পেমেন্ট বাতিল টেস্ট করুন
                  </button>
                </div>
              </div>
            )}
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
  const [myReviews, setMyReviews] = useState<ReviewRecord[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [notice, setNotice] = useState('');

  const loadBookings = async () => {
    if (!user) return;
    const [bRes, rRes] = await Promise.all([
      apiRequest<{ bookings: BookingRecord[] }>('/api/bookings'),
      apiRequest<{ reviews: ReviewRecord[] }>('/api/reviews/mine').catch(() => ({ reviews: [] })),
    ]);
    setBookings(bRes.bookings || []);
    setMyReviews(rRes.reviews || []);
    if (!activeId && bRes.bookings?.length) {
      setActiveId(bRes.bookings[0].id);
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
        <h1 className="font-display text-2xl font-bold text-slate-950">বুকিং ইতিহাস</h1>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          বুকিং দেখতে সাইন ইন করুন
        </button>
      </main>
    );
  }

  const activeBooking = bookings.find((b) => b.id === activeId);
  const activeBookingReview = activeBooking
    ? myReviews.find((r) => r.bookingId === activeBooking.id) || null
    : null;

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
      setNotice('বুকিং সম্পন্ন হয়েছে! এখন নিচে থেকে সঙ্গীকে রেটিং ও রিভিউ দিতে পারবেন।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const cancelBooking = async (id: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'বুকিং ম্যানেজমেন্ট থেকে বাতিল করা হয়েছে' }),
      });
      await loadBookings();
      setNotice('বুকিং বাতিল করা হয়েছে। পেমেন্ট করা থাকলে অটোমেটিক রিফান্ড রিকোয়েস্ট তৈরি হয়েছে।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <h1 className="font-display text-3xl font-bold text-slate-950">বুকিং ইতিহাস ও সমন্বয় চ্যাট</h1>
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          নতুন বুকিং করুন
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-900">
          {notice}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm text-slate-600">এখনো কোনো বুকিং নেই।</p>
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
                    <p className="text-xs text-slate-500 capitalize">
                      অ্যাডভান্স (৫০%): {activeBooking.advanceStatus === 'paid' ? 'পরিশোধিত' : activeBooking.advanceStatus === 'pending_verification' ? 'যাচাইয়ের অপেক্ষায়' : 'বাকি'} · {activeBooking.paymentStatus}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {user.uid === activeBooking.customerUid &&
                    activeBooking.advanceStatus !== 'paid' &&
                    !['declined', 'cancelled', 'completed'].includes(activeBooking.status) && (
                      <button
                        type="button"
                        onClick={() => navigate(`/payment/${activeBooking.id}`)}
                        className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        {activeBooking.advanceStatus === 'pending_verification'
                          ? '৫০% অ্যাডভান্স স্ট্যাটাস দেখুন'
                          : 'প্রথমে ৫০% অ্যাডভান্স পেমেন্ট করুন'}
                      </button>
                    )}
                  {user.uid === activeBooking.customerUid &&
                    activeBooking.advanceStatus === 'paid' &&
                    activeBooking.paymentStatus !== 'paid' &&
                    !['declined', 'cancelled', 'completed'].includes(activeBooking.status) && (
                      <button
                        type="button"
                        onClick={() => navigate(`/payment/${activeBooking.id}`)}
                        className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        বাকি ৫০% পেমেন্ট করুন
                      </button>
                    )}
                  {(['confirmed_paid', 'in_progress'].includes(activeBooking.status) ||
                    activeBooking.advanceStatus === 'paid') &&
                    !['completed', 'cancelled', 'declined'].includes(activeBooking.status) && (
                    <button
                      type="button"
                      onClick={() => markCompleted(activeBooking.id)}
                      className="px-4 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      সেশন সম্পন্ন চিহ্নিত করুন
                    </button>
                  )}
                  {!['completed', 'cancelled'].includes(activeBooking.status) && (
                    <button
                      type="button"
                      onClick={() => cancelBooking(activeBooking.id)}
                      className="px-4 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      বুকিং বাতিল করুন
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/help')}
                    className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                  >
                    অভিযোগ / সাপোর্ট
                  </button>
                </div>

                {/* Participant Chat */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> বুকিং সমন্বয় চ্যাট
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 h-48 overflow-y-auto space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-xs text-slate-400">এখনো কোনো মেসেজ নেই। এখানে দেখা করার সময় ও পাবলিক স্থান ঠিক করুন।</p>
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
                      placeholder="মেসেজ লিখুন..."
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      পাঠান
                    </button>
                  </form>
                </div>

                {/* Review Form / Published Review when completed */}
                {activeBooking.status === 'completed' && user.uid === activeBooking.customerUid && (
                  <div className="pt-4 border-t border-slate-100">
                    <BookingReviewCard
                      booking={activeBooking}
                      existingReview={activeBookingReview}
                      onReviewSubmitted={(rev) => {
                        setMyReviews((prev) => [rev, ...prev]);
                        setNotice('আপনার যাচাইকৃত রেটিং ও রিভিউ সঙ্গীর প্রোফাইলে প্রকাশিত হয়েছে।');
                      }}
                      onViewCompanion={(uid) => navigate(`/companions/${uid}`)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
