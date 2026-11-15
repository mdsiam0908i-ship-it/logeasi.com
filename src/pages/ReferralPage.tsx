import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Gift,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type { ReferralRecord, ReferralTransactionRecord } from '../types/logeasi.ts';

interface ReferralsResponse {
  referralCode: string;
  referralCreditsBdt: number;
  referralCount: number;
  referrerBonusCredits: number;
  signupBonusCredits: number;
  referrals: ReferralRecord[];
  transactions: ReferralTransactionRecord[];
}

function txTypeLabel(type: ReferralTransactionRecord['type']): { text: string; tone: string } {
  if (type === 'earned_referral') return { text: 'রেফারেল বোনাস অর্জিত', tone: 'text-emerald-700' };
  if (type === 'earned_welcome_bonus') return { text: 'স্বাগতম রেফারেল বোনাস', tone: 'text-blue-700' };
  if (type === 'refunded_booking') return { text: 'বাতিল বুকিং ক্রেডিট ফেরত', tone: 'text-emerald-700' };
  return { text: 'বুকিংয়ে ক্রেডিট ব্যবহার', tone: 'text-amber-700' };
}

export function ReferralPage() {
  const { user, navigate } = useAuth();
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedType, setCopiedType] = useState<'link' | 'code' | null>(null);

  const loadReferrals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<ReferralsResponse>('/api/referrals/me');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'রেফারেল তথ্য লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  if (!user) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">রেফারেল ও ক্রেডিট পয়েন্ট</h1>
        <p className="text-sm text-slate-600">
          আপনার ইউনিক ইনভাইট লিংক শেয়ার করে ক্রেডিট পয়েন্ট অর্জন করতে সাইন ইন করুন।
        </p>
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

  const referralCode = data?.referralCode || user.referralCode || '';
  const inviteUrl =
    typeof window !== 'undefined' && referralCode
      ? `${window.location.origin}/auth?tab=register&ref=${encodeURIComponent(referralCode)}`
      : '';

  const creditsBalance = data?.referralCreditsBdt ?? Number(user.referralCreditsBdt || 0);
  const referrerBonus = data?.referrerBonusCredits ?? 250;
  const signupBonus = data?.signupBonusCredits ?? 150;
  const referrals = data?.referrals || [];
  const transactions = data?.transactions || [];

  const totalEarnedCredits = transactions
    .filter((t) => t.creditsBdt > 0)
    .reduce((sum, t) => sum + t.creditsBdt, 0);
  const totalRedeemedCredits = transactions
    .filter((t) => t.creditsBdt < 0)
    .reduce((sum, t) => sum + Math.abs(t.creditsBdt), 0);

  const copyText = async (text: string, kind: 'link' | 'code') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    const shareText = `LOGEASI.COM-এ আমার রেফারেল লিংকে যোগ দিন এবং প্রথম সঙ্গী বুকিংয়ের জন্য ${signupBonus} ক্রেডিট পয়েন্ট (৳${signupBonus}) বোনাস পান! কোড: ${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LOGEASI.COM — ইনভাইট ও ক্রেডিট বোনাস',
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    copyText(inviteUrl, 'link');
  };

  const whatsappUrl = inviteUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `LOGEASI.COM-এ আমার ইনভাইট লিংক থেকে সাইন আপ করলে ${signupBonus} ক্রেডিট (৳${signupBonus}) বোনাস পাবেন! লিংক: ${inviteUrl}`
      )}`
    : '#';

  const dashboardPath = user.role === 'companion' ? '/dashboard/companion' : '/dashboard/customer';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> ড্যাশবোর্ডে ফিরে যান
            </button>
            <span aria-hidden="true">·</span>
            <span>{user.fullName}</span>
            <span aria-hidden="true">·</span>
            <span>১ ক্রেডিট = ৳১</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
            রেফারেল ইনভাইট ও ক্রেডিট পয়েন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            আপনার ইউনিক ইনভাইট লিংক শেয়ার করে বন্ধুদের যুক্ত করুন এবং ভবিষ্যতের সঙ্গী বুকিংয়ে সরাসরি ব্যবহারযোগ্য ক্রেডিট পয়েন্ট অর্জন করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            ক্রেডিট দিয়ে বুকিং করুন
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadReferrals}
            className="px-3 py-1.5 bg-white border border-red-200 rounded-lg font-semibold cursor-pointer"
          >
            পুনরায় চেষ্টা করুন
          </button>
        </div>
      )}

      {/* 4-KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">ব্যবহারযোগ্য ক্রেডিট পয়েন্ট</p>
          <p className="font-mono text-2xl font-bold text-blue-700 tabular-nums mt-1">
            {creditsBalance.toLocaleString()} পয়েন্ট
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
            বুকিং মূল্য ছাড়: {formatBdt(creditsBalance)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">মোট সফল রেফারেল</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {data?.referralCount ?? referrals.length} জন
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            প্রতি রেফারেলে +{referrerBonus} পয়েন্ট
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">মোট অর্জিত ক্রেডিট</p>
          <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {totalEarnedCredits.toLocaleString()} পয়েন্ট
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
            সমমূল্য: {formatBdt(totalEarnedCredits)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">বুকিংয়ে ব্যবহৃত ক্রেডিট</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {totalRedeemedCredits.toLocaleString()} পয়েন্ট
          </p>
          <p className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
            সাশ্রয়: {formatBdt(totalRedeemedCredits)}
          </p>
        </div>
      </section>

      {/* Invite Link & Rules */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
              <Gift className="w-5 h-5 text-blue-700" /> আপনার ইউনিক ইনভাইট লিংক ও কোড
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <p className="text-[11px] text-slate-500">রেফারেল কোড</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="font-mono text-base font-bold text-slate-950 tracking-wide">
                  {referralCode || '...'}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(referralCode, 'code')}
                  className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                  title="কোড কপি করুন"
                >
                  {copiedType === 'code' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <p className="text-[11px] text-slate-500">শেয়ারযোগ্য ইনভাইট লিংক</p>
              <p className="font-mono text-xs text-slate-900 truncate mt-1.5 select-all">
                {inviteUrl || 'লোড হচ্ছে...'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => copyText(inviteUrl, 'link')}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedType === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === 'link' ? 'ইনভাইট লিংক কপি হয়েছে' : 'ইনভাইট লিংক কপি করুন'}
            </button>
            <button
              type="button"
              onClick={shareInvite}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> বন্ধুদের শেয়ার করুন
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              WhatsApp-এ পাঠান
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 bg-slate-950 text-white border border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <p className="text-xs font-mono text-blue-400">ক্রেডিট অর্জন ও ব্যবহারের নিয়ম</p>
            <h3 className="font-display text-lg font-bold">কিভাবে ক্রেডিট পয়েন্ট কাজ করে</h3>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li>
                ০১. আপনার ইনভাইট লিংক বা কোড (<span className="font-mono text-white">{referralCode}</span>) দিয়ে কেউ সাইন আপ করলে আপনি পাবেন{' '}
                <strong className="text-white font-mono">{referrerBonus} ক্রেডিট (৳{referrerBonus})</strong>।
              </li>
              <li>
                ০২. আপনার আমন্ত্রিত বন্ধু সাইন আপ করলেই পাবেন{' '}
                <strong className="text-white font-mono">{signupBonus} স্বাগতম ক্রেডিট (৳{signupBonus})</strong>।
              </li>
              <li>
                ০৩. সঙ্গী বুকিং চেকআউটের সময় মোট ভাড়ার সর্বোচ্চ <strong className="text-white">৫০% পর্যন্ত</strong> ক্রেডিট পয়েন্ট দিয়ে পরিশোধ করতে পারবেন।
              </li>
              <li>
                ০৪. ক্রেডিট ব্যবহারের পর কোনো বুকিং বাতিল হলে ব্যবহৃত ক্রেডিট পয়েন্ট স্বয়ংক্রিয়ভাবে আপনার অ্যাকাউন্টে ফেরত আসবে।
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Invited Friends & Credit Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700" /> আমন্ত্রিত বন্ধুদের তালিকা ({referrals.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              এখনো কেউ আপনার ইনভাইট লিংকে যোগ দেয়নি। উপরের লিংক শেয়ার করে প্রথম +{referrerBonus} ক্রেডিট অর্জন করুন।
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {referrals.map((r) => (
                <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{r.referredName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {r.referredRole === 'companion' ? 'সঙ্গী অ্যাকাউন্ট' : 'কাস্টমার অ্যাকাউন্ট'} ·{' '}
                      <span className="font-mono tabular-nums">
                        {new Date(r.createdAt).toLocaleDateString('bn-BD')}
                      </span>
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="font-bold text-emerald-700">+{r.referrerRewardCredits} পয়েন্ট</p>
                    <p className="text-[11px] text-slate-500">৳{r.referrerRewardCredits} ক্রেডিট</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-700" /> ক্রেডিট পয়েন্ট লেনদেন লেজার ({transactions.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              এখনো কোনো ক্রেডিট পয়েন্ট লেনদেন রেকর্ড হয়নি।
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {transactions.map((tx) => {
                const meta = txTypeLabel(tx.type);
                const isPositive = tx.creditsBdt >= 0;
                return (
                  <div key={tx.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className={`font-semibold ${meta.tone}`}>{meta.text}</p>
                      <p className="text-slate-700 leading-relaxed">{tx.description}</p>
                      <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {new Date(tx.createdAt).toLocaleString('bn-BD')}
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <p className={`font-bold ${isPositive ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {isPositive ? `+${tx.creditsBdt}` : tx.creditsBdt} পয়েন্ট
                      </p>
                      <p className="text-[11px] text-slate-500">
                        ব্যালেন্স: {tx.balanceAfterBdt}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
