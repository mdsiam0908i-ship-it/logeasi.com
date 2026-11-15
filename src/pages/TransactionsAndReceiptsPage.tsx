import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { PaymentGatewayLogo } from '../components/PaymentGatewayLogo.tsx';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type {
  BookingRecord,
  PaymentRecord,
  RefundRecord,
} from '../types/logeasi.ts';

type FilterTab = 'all' | 'advance_due' | 'pending_verify' | 'dues_remaining' | 'settled';

function bookingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    requested: 'অনুরোধকৃত',
    accepted_awaiting_agreement: 'গৃহীত · সম্মতির অপেক্ষায়',
    price_agreed_awaiting_payment: 'মূল্য নিশ্চিত · পেমেন্ট বাকি',
    payment_pending: 'পেমেন্ট যাচাই চলছে',
    confirmed_paid: 'পেমেন্ট নিশ্চিত',
    in_progress: 'সেশন চলমান',
    completed: 'সম্পন্ন',
    cancelled: 'বাতিল',
    declined: 'প্রত্যাখ্যাত',
    disputed: 'বিরোধপূর্ণ',
  };
  return map[status] || status.replace(/_/g, ' ');
}

function advanceStatusLabel(b: BookingRecord): { text: string; toneClass: string } {
  if (b.advanceStatus === 'paid' || b.paymentStatus === 'paid') {
    return { text: '৫০% অ্যাডভান্স পরিশোধিত', toneClass: 'text-emerald-700' };
  }
  if (b.advanceStatus === 'pending_verification') {
    return { text: 'অ্যাডভান্স যাচাইয়ের অপেক্ষায়', toneClass: 'text-amber-700' };
  }
  return { text: '৫০% অ্যাডভান্স বাকি', toneClass: 'text-red-700' };
}

function paymentStatusLabel(status: string): { text: string; toneClass: string } {
  const map: Record<string, { text: string; toneClass: string }> = {
    verified_paid: { text: 'যাচাইকৃত ও পরিশোধিত', toneClass: 'text-emerald-700' },
    pending_manual_verification: { text: 'অ্যাডমিন যাচাইয়ের অপেক্ষায়', toneClass: 'text-amber-700' },
    initiated: { text: 'রেফারেন্স অপেক্ষমাণ', toneClass: 'text-slate-600' },
    cash_pending: { text: 'ক্যাশ-অন-মিটআপ নির্ধারিত', toneClass: 'text-blue-700' },
    failed: { text: 'ব্যর্থ / বাতিল', toneClass: 'text-red-700' },
    refunded: { text: 'রিফান্ড সম্পন্ন', toneClass: 'text-slate-600' },
  };
  return map[status] || { text: status, toneClass: 'text-slate-700' };
}

function gatewayDisplayName(gw: string): string {
  const map: Record<string, string> = {
    bkash: 'বিকাশ পার্সোনাল',
    nagad: 'নগদ পার্সোনাল',
    custom: 'অ্যাডমিন কাস্টম',
    benson: 'বেনসন সিগারেট বিনিময়',
    rocket: 'রকেট (Rocket)',
    sslcommerz: 'SSLCommerz',
    cash: 'ক্যাশ পেমেন্ট',
  };
  return map[gw] || gw.toUpperCase();
}

function stageDisplayName(stage?: string): string {
  if (stage === 'advance_50') return 'ধাপ ১: ৫০% অ্যাডভান্স';
  if (stage === 'remaining_50') return 'ধাপ ২: অবশিষ্ট বকেয়া';
  return 'সম্পূর্ণ পেমেন্ট';
}

export function TransactionsAndReceiptsPage() {
  const { user, navigate } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<{
    payment: PaymentRecord;
    booking?: BookingRecord;
  } | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }
    let active = true;
    setLoadingData(true);
    setError('');
    Promise.all([
      apiRequest<{ bookings: BookingRecord[] }>('/api/bookings'),
      apiRequest<{ payments: PaymentRecord[]; refunds: RefundRecord[] }>('/api/payments/mine'),
    ])
      .then(([bRes, pRes]) => {
        if (!active) return;
        setBookings(bRes.bookings || []);
        setPayments(pRes.payments || []);
        setRefunds(pRes.refunds || []);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || 'বুকিং ও পেমেন্ট লেজার লোড করা যায়নি।');
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const bookingsById = useMemo(() => {
    const map = new Map<string, BookingRecord>();
    for (const b of bookings) map.set(b.id, b);
    return map;
  }, [bookings]);

  const metrics = useMemo(() => {
    const activeNonDeclined = bookings.filter(
      (b) => !['declined', 'cancelled'].includes(b.status)
    );
    const totalContractedBdt = activeNonDeclined.reduce(
      (sum, b) => sum + Number(b.agreedPriceBdt || 0),
      0
    );
    const totalAdvancePaidBdt = activeNonDeclined.reduce(
      (sum, b) => sum + Number(b.advancePaidBdt || 0),
      0
    );
    const totalVerifiedPaidBdt = payments
      .filter((p) => p.status === 'verified_paid')
      .reduce((sum, p) => sum + Number(p.amountBdt || 0), 0);
    const totalDuesBdt = activeNonDeclined.reduce((sum, b) => {
      if (b.paymentStatus === 'paid' || b.paymentStatus === 'refunded') return sum;
      const due =
        b.remainingDueBdt !== undefined
          ? Number(b.remainingDueBdt)
          : Math.max(0, Number(b.agreedPriceBdt || 0) - Number(b.advancePaidBdt || 0));
      return sum + due;
    }, 0);
    const pendingVerificationCount = payments.filter(
      (p) => p.status === 'pending_manual_verification'
    ).length;

    return {
      totalBookings: bookings.length,
      totalContractedBdt,
      totalAdvancePaidBdt,
      totalVerifiedPaidBdt,
      totalDuesBdt,
      pendingVerificationCount,
    };
  }, [bookings, payments]);

  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      const remaining =
        b.remainingDueBdt !== undefined
          ? Number(b.remainingDueBdt)
          : Math.max(0, Number(b.agreedPriceBdt || 0) - Number(b.advancePaidBdt || 0));
      const isCancelledOrDeclined = ['declined', 'cancelled'].includes(b.status);

      if (filter === 'advance_due') {
        if (isCancelledOrDeclined || b.advanceStatus === 'paid' || b.paymentStatus === 'paid') {
          return false;
        }
      } else if (filter === 'pending_verify') {
        const hasPendingPay = payments.some(
          (p) => p.bookingId === b.id && p.status === 'pending_manual_verification'
        );
        if (b.advanceStatus !== 'pending_verification' && !hasPendingPay) return false;
      } else if (filter === 'dues_remaining') {
        if (isCancelledOrDeclined || remaining <= 0 || b.paymentStatus === 'paid') return false;
      } else if (filter === 'settled') {
        if (b.paymentStatus !== 'paid' && remaining > 0) return false;
      }

      if (!q) return true;
      return (
        b.bookingCode.toLowerCase().includes(q) ||
        b.companionName.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        b.venueName.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [bookings, payments, filter, searchQuery]);

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      if (filter === 'pending_verify' && p.status !== 'pending_manual_verification') return false;
      if (filter === 'settled' && p.status !== 'verified_paid') return false;
      if (!q) return true;
      const linked = bookingsById.get(p.bookingId);
      return (
        p.transactionId.toLowerCase().includes(q) ||
        (p.bookingCode || '').toLowerCase().includes(q) ||
        (p.senderReferenceTrxId || '').toLowerCase().includes(q) ||
        p.gateway.toLowerCase().includes(q) ||
        (linked?.companionName || '').toLowerCase().includes(q) ||
        (linked?.customerName || '').toLowerCase().includes(q)
      );
    });
  }, [payments, bookingsById, filter, searchQuery]);

  const exportCsvLedger = () => {
    const headers = [
      'BookingCode',
      'Date',
      'Time',
      'Customer',
      'Companion',
      'Venue',
      'City',
      'TotalAgreedBDT',
      'AdvanceRequiredBDT',
      'AdvancePaidBDT',
      'RemainingDueBDT',
      'AdvanceStatus',
      'PaymentStatus',
      'BookingStatus',
    ];
    const rows = filteredBookings.map((b) => {
      const advReq = b.advanceRequiredBdt || Math.round(b.agreedPriceBdt / 2);
      const advPaid = Number(b.advancePaidBdt || 0);
      const due =
        b.remainingDueBdt !== undefined
          ? Number(b.remainingDueBdt)
          : Math.max(0, b.agreedPriceBdt - advPaid);
      return [
        `"${b.bookingCode}"`,
        `"${b.bookingDate}"`,
        `"${b.startTime}"`,
        `"${b.customerName}"`,
        `"${b.companionName}"`,
        `"${b.venueName}"`,
        `"${b.city}"`,
        b.agreedPriceBdt,
        advReq,
        advPaid,
        due,
        `"${b.advanceStatus || 'unpaid'}"`,
        `"${b.paymentStatus}"`,
        `"${b.status}"`,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logeasi-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyReceiptSummary = async (payment: PaymentRecord, booking?: BookingRecord) => {
    const text = [
      'LOGEASI.COM — ট্রানজেকশন রসিদ',
      `রসিদ / ট্রানজেকশন আইডি: ${payment.transactionId}`,
      `বুকিং কোড: ${payment.bookingCode || booking?.bookingCode || payment.bookingId}`,
      `ধাপ: ${stageDisplayName(payment.paymentStage)}`,
      `মাধ্যম: ${gatewayDisplayName(payment.gateway)}`,
      payment.senderReferenceTrxId ? `জমাকৃত TrxID/রেফারেন্স: ${payment.senderReferenceTrxId}` : '',
      payment.equivalentItemLabel ? `বিনিময় সমমূল্য: ${payment.equivalentItemLabel}` : '',
      `পরিশোধিত পরিমাণ: BDT ৳${payment.amountBdt.toLocaleString()}`,
      booking ? `মোট বুকিং মূল্য: BDT ৳${booking.agreedPriceBdt.toLocaleString()}` : '',
      booking
        ? `অবশিষ্ট বকেয়া: BDT ৳${(booking.remainingDueBdt ?? Math.max(0, booking.agreedPriceBdt - Number(booking.advancePaidBdt || 0))).toLocaleString()}`
        : '',
      `অবস্থা: ${paymentStatusLabel(payment.status).text}`,
      `তারিখ: ${new Date(payment.verifiedAt || payment.createdAt).toLocaleString('bn-BD')}`,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('রসিদের বিস্তারিত তথ্য ক্লিপবোর্ডে কপি করা হয়েছে।');
      setTimeout(() => setCopyMessage(''), 2500);
    } catch {
      setCopyMessage('ক্লিপবোর্ডে কপি করা যায়নি।');
    }
  };

  if (!user) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">
          বুকিং লেজার, পেমেন্ট অবস্থা ও রসিদ
        </h1>
        <p className="text-sm text-slate-600">
          আপনার অ্যাডভান্স পেমেন্ট, অবশিষ্ট বকেয়া এবং সকল ট্রানজেকশন রসিদ দেখতে সাইন ইন করুন।
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          সাইন ইন করুন
        </button>
      </main>
    );
  }

  const backDashboardPath =
    user.role === 'companion' ? '/dashboard/companion' : '/dashboard/customer';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Bar Contract: Breadcrumb + Title on left, concise single-line actions on right */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => navigate(backDashboardPath)}
              className="inline-flex items-center gap-1 hover:text-blue-700 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {user.role === 'companion' ? 'সঙ্গী ড্যাশবোর্ড' : 'গ্রাহক ড্যাশবোর্ড'}
            </button>
            <span aria-hidden="true">/</span>
            <span>বুকিং লেজার ও ট্রানজেকশন রসিদ</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            বুকিং ইতিহাস, অ্যাডভান্স ও বকেয়া লেজার
          </h1>
          <p className="text-xs text-slate-600">
            {user.fullName} · ৫০% অ্যাডভান্স পরিশোধ, অবশিষ্ট বকেয়া (Dues) এবং প্রতিটি পেমেন্টের যাচাইকৃত রসিদ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={exportCsvLedger}
            disabled={filteredBookings.length === 0}
            className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV ডাউনলোড
          </button>
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            বুকিং চ্যাট ও ব্যবস্থাপনা
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* 4-Column Financial KPI Strip */}
      {loadingData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">মোট বুকিং ও লেনদেন</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 mt-1">
              {metrics.totalBookings} বুকিং / {payments.length} রসিদ
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
              যাচাই অপেক্ষমাণ: {metrics.pendingVerificationCount} টি
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">মোট চুক্তিবদ্ধ বুকিং মূল্য</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 mt-1">
              {formatBdt(metrics.totalContractedBdt)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">বাতিল/প্রত্যাখ্যাত বুকিং ব্যতীত</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">মোট যাচাইকৃত পরিশোধ (অ্যাডভান্সসহ)</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">
              {formatBdt(metrics.totalVerifiedPaidBdt)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
              অ্যাডভান্স জমা: {formatBdt(metrics.totalAdvancePaidBdt)}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">মোট অবশিষ্ট বকেয়া (Total Dues)</p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold mt-1 ${
                metrics.totalDuesBdt > 0 ? 'text-amber-700' : 'text-slate-950'
              }`}
            >
              {formatBdt(metrics.totalDuesBdt)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">সকল সক্রিয় বুকিংয়ের মোট পাওনা/দেনা</p>
          </div>
        </section>
      )}

      {/* Search + Segmented Status Filter Controls */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { key: 'all', label: 'সকল রেকর্ড' },
              { key: 'advance_due', label: '৫০% অ্যাডভান্স বাকি' },
              { key: 'pending_verify', label: 'যাচাইয়ের অপেক্ষায়' },
              { key: 'dues_remaining', label: 'বকেয়া রয়েছে' },
              { key: 'settled', label: 'সম্পূর্ণ পরিশোধিত' },
            ] as Array<{ key: FilterTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === tab.key
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="বুকিং কোড, TrxID, নাম বা ভেন্যু খুঁজুন..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-700"
          />
        </div>
      </section>

      {/* Section 1: Detailed Bookings, Advance Payments & Remaining Dues Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-slate-950">
              ০১. বুকিং ভিত্তিক অ্যাডভান্স ও মোট বকেয়া লেজার ({filteredBookings.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              প্রতিটি বুকিংয়ের চুক্তিবদ্ধ মূল্য, ৫০% অ্যাডভান্স পরিশোধের অবস্থা এবং অবশিষ্ট বকেয়া
            </p>
          </div>
        </div>

        {loadingData ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-600">এই ফিল্টারে কোনো বুকিং রেকর্ড পাওয়া যায়নি।</p>
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              সব বুকিং দেখুন
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">বুকিং কোড ও সময়</th>
                  <th className="py-3 px-4 font-semibold">সঙ্গী / গ্রাহক ও ভেন্যু</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">বুকিং ও অ্যাডভান্স অবস্থা</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">মোট মূল্য</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">অ্যাডভান্স জমা / প্রয়োজন</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">অবশিষ্ট বকেয়া</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const advRequired = b.advanceRequiredBdt || Math.round(b.agreedPriceBdt / 2);
                  const advPaid = Number(b.advancePaidBdt || 0);
                  const remaining =
                    b.remainingDueBdt !== undefined
                      ? Number(b.remainingDueBdt)
                      : Math.max(0, b.agreedPriceBdt - advPaid);
                  const advMeta = advanceStatusLabel(b);
                  const isCustomer = user.uid === b.customerUid;
                  const canPay =
                    isCustomer &&
                    !['declined', 'cancelled', 'completed'].includes(b.status) &&
                    b.paymentStatus !== 'paid' &&
                    remaining > 0;
                  const relatedPay = payments.find(
                    (p) => p.bookingId === b.id && p.status !== 'failed'
                  );

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-mono font-bold text-slate-950 tabular-nums">{b.bookingCode}</p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {b.bookingDate} · {b.startTime}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top min-w-[210px]">
                        <p className="font-semibold text-slate-950">
                          {isCustomer ? b.companionName : b.customerName}
                          <span className="text-slate-400 font-normal"> · {isCustomer ? 'সঙ্গী' : 'গ্রাহক'}</span>
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {b.venueName}, {b.city} · {b.category}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-medium text-slate-900">{bookingStatusLabel(b.status)}</p>
                        <p className={`text-[11px] font-semibold mt-0.5 ${advMeta.toneClass}`}>
                          {advMeta.text}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-950 whitespace-nowrap">
                        {formatBdt(b.agreedPriceBdt)}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-bold text-emerald-700">{formatBdt(advPaid)}</span>
                        <span className="text-slate-400"> / {formatBdt(advRequired)}</span>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            ['declined', 'cancelled'].includes(b.status)
                              ? 'text-slate-400'
                              : remaining > 0
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {['declined', 'cancelled'].includes(b.status)
                            ? formatBdt(0)
                            : formatBdt(remaining)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {canPay && (
                            <button
                              type="button"
                              onClick={() => navigate(`/payment/${b.id}`)}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md cursor-pointer"
                            >
                              {b.advanceStatus !== 'paid' ? '৫০% অ্যাডভান্স দিন' : 'বাকি পেমেন্ট'}
                            </button>
                          )}
                          {relatedPay && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt({ payment: relatedPay, booking: b })}
                              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-800 font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" /> রসিদ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Transaction Receipts Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-slate-950">
              ০২. ট্রানজেকশন রসিদ ও পেমেন্ট ইতিহাস ({filteredPayments.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              সকল অ্যাডভান্স, অবশিষ্ট পেমেন্ট ও বেনসন সিগারেট বিনিময় লেনদেনের বিস্তারিত রসিদ
            </p>
          </div>
        </div>

        {loadingData ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-500">এখনো কোনো ট্রানজেকশন রসিদ তৈরি হয়নি।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600">
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">রসিদ / Trx ID</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">বুকিং ও ধাপ</th>
                  <th className="py-3 px-4 font-semibold">মাধ্যম ও রেফারেন্স</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">পরিশোধের পরিমাণ</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">অবস্থা ও তারিখ</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">রসিদ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => {
                  const linked = bookingsById.get(p.bookingId);
                  const st = paymentStatusLabel(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-mono font-bold text-slate-950 tabular-nums">{p.transactionId}</p>
                        <p className="font-mono text-[11px] text-slate-500 mt-0.5 uppercase">
                          {p.mode} · {p.webhookVerified ? 'যাচাইকৃত' : 'পেন্ডিং'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-mono font-semibold text-slate-900">
                          {p.bookingCode || linked?.bookingCode || p.bookingId}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{stageDisplayName(p.paymentStage)}</p>
                      </td>

                      <td className="py-3.5 px-4 align-top min-w-[220px]">
                        <div className="flex items-center gap-2.5">
                          <PaymentGatewayLogo gateway={p.gateway} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{gatewayDisplayName(p.gateway)}</p>
                            <p className="font-mono text-[11px] text-slate-600 mt-0.5">
                              {p.senderReferenceTrxId ? `Ref: ${p.senderReferenceTrxId}` : '—'}
                              {p.equivalentItemLabel ? ` · ${p.equivalentItemLabel}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap">
                        <p className="font-bold text-slate-950">{formatBdt(p.amountBdt)}</p>
                        {user.role === 'companion' && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            নিট আয়: {formatBdt(p.companionNetBdt)}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className={`font-semibold ${st.toneClass}`}>{st.text}</p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                          {new Date(p.verifiedAt || p.createdAt).toLocaleDateString('bn-BD')}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt({ payment: p, booking: linked })}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-blue-700 text-white font-semibold rounded-md inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" /> রসিদ দেখুন
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Refunds History (if any) */}
      {refunds.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-bold text-slate-950">
            ০৩. রিফান্ড অনুরোধ ও নিষ্পত্তি ({refunds.length})
          </h2>
          <div className="divide-y divide-slate-100 text-xs">
            {refunds.map((r) => (
              <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{r.reason}</p>
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                    পেমেন্ট আইডি: {r.paymentId} · {new Date(r.createdAt).toLocaleDateString('bn-BD')}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="font-bold text-slate-950">{formatBdt(r.amountBdt)}</p>
                  <p className="text-[11px] uppercase text-slate-600">{r.status}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Printable Transaction Receipt Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono text-blue-300">LOGEASI.COM · ডিজিটাল রসিদ</p>
                <h3 id="receipt-modal-title" className="font-display text-lg font-bold">
                  {selectedReceipt.payment.transactionId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                aria-label="রসিদ বন্ধ করুন"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-slate-500">পরিশোধের পরিমাণ</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 mt-0.5">
                    {formatBdt(selectedReceipt.payment.amountBdt)}
                  </p>
                  {selectedReceipt.payment.equivalentItemLabel && (
                    <p className="text-amber-800 font-semibold mt-0.5">
                      বিনিময়: {selectedReceipt.payment.equivalentItemLabel}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {selectedReceipt.payment.status === 'verified_paid' ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> যাচাইকৃত ও পরিশোধিত
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                      <Clock className="w-4 h-4" /> {paymentStatusLabel(selectedReceipt.payment.status).text}
                    </span>
                  )}
                  <p className="font-mono text-[11px] text-slate-500 mt-1 tabular-nums">
                    {new Date(
                      selectedReceipt.payment.verifiedAt || selectedReceipt.payment.createdAt
                    ).toLocaleString('bn-BD')}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 border-b border-slate-100 pb-4">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">বুকিং কোড</span>
                  <span className="font-mono font-semibold text-slate-950">
                    {selectedReceipt.payment.bookingCode ||
                      selectedReceipt.booking?.bookingCode ||
                      selectedReceipt.payment.bookingId}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">পেমেন্টের ধাপ</span>
                  <span className="font-semibold text-slate-900">
                    {stageDisplayName(selectedReceipt.payment.paymentStage)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-slate-500">পেমেন্ট মাধ্যম</span>
                  <span className="font-semibold text-slate-900 inline-flex items-center gap-2">
                    <PaymentGatewayLogo gateway={selectedReceipt.payment.gateway} size="xs" />
                    {gatewayDisplayName(selectedReceipt.payment.gateway)}
                  </span>
                </div>
                {selectedReceipt.payment.senderReferenceTrxId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">জমাকৃত TrxID / রেফারেন্স</span>
                    <span className="font-mono font-bold text-slate-950">
                      {selectedReceipt.payment.senderReferenceTrxId}
                    </span>
                  </div>
                )}
                {selectedReceipt.payment.bensonDeliveryMode && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">হস্তান্তরের ধরন</span>
                    <span className="font-semibold text-amber-900">
                      {selectedReceipt.payment.bensonDeliveryMode === 'in_person'
                        ? 'দেখা করে হাতে হাতে'
                        : 'রাইডার / কুরিয়ারে সেন্ড'}
                    </span>
                  </div>
                )}
                {selectedReceipt.payment.proofPhotoUrl && (
                  <div className="pt-1 space-y-1.5">
                    <span className="text-slate-500 block">কেনা সিগারেটের প্রমাণ ছবি</span>
                    <img
                      src={selectedReceipt.payment.proofPhotoUrl}
                      alt="কেনা সিগারেটের প্রমাণ"
                      className="max-h-36 rounded-lg border border-slate-200 object-contain bg-slate-50"
                    />
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">প্ল্যাটফর্ম ফি অন্তর্ভুক্ত</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatBdt(selectedReceipt.payment.platformFeeBdt)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">সঙ্গীর নিট অংশ</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatBdt(selectedReceipt.payment.companionNetBdt)}
                  </span>
                </div>
              </div>

              {selectedReceipt.booking && (
                <div className="space-y-2 border-b border-slate-100 pb-4">
                  <p className="font-semibold text-slate-900">বুকিংয়ের সারসংক্ষেপ</p>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">সঙ্গী / গ্রাহক</span>
                    <span className="font-medium text-slate-900">
                      {selectedReceipt.booking.companionName} · {selectedReceipt.booking.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">ভেন্যু ও তারিখ</span>
                    <span className="text-slate-900 font-mono tabular-nums">
                      {selectedReceipt.booking.venueName} ({selectedReceipt.booking.bookingDate})
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">মোট চুক্তিবদ্ধ মূল্য</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-950">
                      {formatBdt(selectedReceipt.booking.agreedPriceBdt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">মোট পরিশোধিত অ্যাডভান্স</span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-700">
                      {formatBdt(Number(selectedReceipt.booking.advancePaidBdt || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">মোট অবশিষ্ট বকেয়া (Total Due)</span>
                    <span className="font-mono tabular-nums font-bold text-amber-700">
                      {formatBdt(
                        selectedReceipt.booking.remainingDueBdt !== undefined
                          ? Number(selectedReceipt.booking.remainingDueBdt)
                          : Math.max(
                              0,
                              selectedReceipt.booking.agreedPriceBdt -
                                Number(selectedReceipt.booking.advancePaidBdt || 0)
                            )
                      )}
                    </span>
                  </div>
                </div>
              )}

              {copyMessage && (
                <p className="text-xs font-medium text-emerald-700">{copyMessage}</p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    copyReceiptSummary(selectedReceipt.payment, selectedReceipt.booking)
                  }
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> রসিদ কপি
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> প্রিন্ট / PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
