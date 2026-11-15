import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  CalendarCheck,
  Compass,
  CreditCard,
  MapPin,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { CompanionCard } from '../components/CompanionCard.tsx';
import { DeveloperBanner } from '../components/DeveloperBanner.tsx';
import { PaymentGatewayLogo } from '../components/PaymentGatewayLogo.tsx';
import heroDhakaLounge from '../assets/images/hero_dhaka_lounge_1794647508278.jpg';
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
import { DEFAULT_BENGALI_BOOKING_CATEGORIES } from '../data/bookingCategories.ts';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type { CompanionProfile } from '../types/logeasi.ts';

export function HomePage() {
  const { user, navigate, platformPublic } = useAuth();
  const [companions, setCompanions] = useState<CompanionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [divisionInput, setDivisionInput] = useState('all');
  const [categoryInput, setCategoryInput] = useState('all');
  const [topTab, setTopTab] = useState<'all' | 'bhai' | 'events' | 'assistance'>('all');

  useEffect(() => {
    apiRequest<{ companions: CompanionProfile[] }>('/api/companions?top100=true&sort=top')
      .then((res) => setCompanions(res.companions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (divisionInput !== 'all') params.set('division', divisionInput);
    if (categoryInput !== 'all') params.set('category', categoryInput);
    navigate(`/explore?${params.toString()}`);
  };

  const filteredTop100 = companions.filter((c) => {
    if (topTab === 'bhai') {
      return (
        c.displayName.toLowerCase().includes('bhai') ||
        c.displayName.includes('ভাই') ||
        (c.categories || []).some((cat) =>
          /bhai|ভাই|টং|আড্ডা|সাপোর্ট|গ্যাঞ্জাম/i.test(cat)
        )
      );
    }
    if (topTab === 'events') {
      return (c.categories || []).some((cat) =>
        /corporate|event|dining|coffee|cultural|ঘোরা|চা|কফি|ইভেন্ট|পারিবারিক|ডিনার/i.test(cat)
      );
    }
    if (topTab === 'assistance') {
      return (c.categories || []).some((cat) =>
        /assistance|errands|senior|shopping|সহায়তা|বাজার|হাসপাতাল|ভ্রমণ|পড়াশোনা/i.test(cat)
      );
    }
    return true;
  });

  return (
    <main>
      {/* Subtle live platform announcement bar */}
      {platformPublic.announcementBanner && (
        <div className="bg-blue-950 text-blue-100 text-xs py-2.5 px-4 text-center border-b border-blue-900/80 font-medium">
          {platformPublic.announcementBanner}
        </div>
      )}

      {/* Architectural Dark-Navy Split Hero */}
      <section className="bg-slate-950 text-white hero-architectural-grid border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <p className="text-xs font-mono uppercase tracking-widest text-blue-400">
                  বাংলাদেশের ৮টি বিভাগ · ১৮+ যাচাইকৃত নিরাপদ সঙ্গী
                </p>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-white leading-[1.08] text-balance">
                  আপনার সময়। আপনার পছন্দ। আপনার সঙ্গী।
                </h1>
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                  {platformPublic.featuredHeadline ||
                    'বাংলাদেশের ৮টি বিভাগে চা-কফি আড্ডা, ঘোরাফেরা, ইভেন্ট ও শান্তিপূর্ণ কাজের সহায়তার জন্য ১৮+ যাচাইকৃত সঙ্গী এবং বিশ্বস্ত ভাই/বন্ধু বুক করুন।'}
                </p>
              </div>

              {/* Integrated Bangladesh Division & Category Search Bar */}
              <form
                onSubmit={handleQuickSearch}
                className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 shadow-xl"
              >
                <div className="sm:col-span-5 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                  <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                  <select
                    value={divisionInput}
                    onChange={(e) => setDivisionInput(e.target.value)}
                    aria-label="বাংলাদেশের বিভাগ নির্বাচন করুন"
                    className="w-full text-sm text-white bg-transparent focus:outline-none"
                  >
                    <option value="all" className="text-slate-900">বাংলাদেশের সকল ৮ বিভাগ</option>
                    {BANGLADESH_DIVISIONS.map((div) => (
                      <option key={div.id} value={div.id} className="text-slate-900">
                        {div.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    aria-label="ক্যাটাগরি নির্বাচন করুন"
                    className="w-full text-sm text-white bg-transparent focus:outline-none"
                  >
                    <option value="all" className="text-slate-900">সকল ক্যাটাগরি</option>
                    {(platformPublic.bookingCategories?.length
                      ? platformPublic.bookingCategories
                      : DEFAULT_BENGALI_BOOKING_CATEGORIES
                    ).map((cat) => (
                      <option key={cat} value={cat} className="text-slate-900">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="sm:col-span-3 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  সঙ্গী খুঁজুন
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-5 text-sm">
                <button
                  type="button"
                  onClick={() => navigate('/become-companion')}
                  className="font-semibold text-white hover:text-blue-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  সঙ্গী হিসেবে যোগ দিন <ArrowRight className="w-4 h-4" />
                </button>
                <span aria-hidden="true" className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => navigate(user ? (user.role === 'companion' ? '/dashboard/companion' : '/dashboard/customer') : '/auth?tab=register')}
                  className="font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  {user ? `${user.fullName}-এর ড্যাশবোর্ড খুলুন` : 'ফ্রি ১৮+ অ্যাকাউন্ট তৈরি করুন'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[380px] rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-2xl">
                <img
                  src={heroDhakaLounge}
                  alt="ঢাকার একটি পাবলিক লাউঞ্জে দুজন প্রাপ্তবয়স্ক মানুষের সামাজিক কফি আড্ডা"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent p-6 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-blue-300 uppercase tracking-wider">
                        পাবলিক স্থান · ঢাকা থেকে সিলেট ও চট্টগ্রাম
                      </p>
                      <p className="text-sm sm:text-base text-white font-semibold mt-1">
                        ১৮+ NID/স্কুল রোল ভেরিফায়েড সম্পূর্ণ অ-যৌন ও নিরাপদ সামাজিক সঙ্গ।
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
                      <p className="text-white font-bold text-sm">BDT (৳)</p>
                      <p>বিকাশ · নগদ · ক্যাশ</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Trust & Verification Strip */}
          <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                ০১. ১৮+ পরিচয় যাচাইকরণ
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                ভেরিফায়েড ব্যাজ পাওয়ার আগে সকল সঙ্গীর NID, স্কুল রোল বা পাসপোর্ট বয়স যাচাই করা হয়।
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-400" />
                ০২. পারস্পরিক মূল্য চুক্তি
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                রিকোয়েস্ট পাঠিয়ে উভয় পক্ষের সম্মতিতে চূড়ান্ত BDT রেট ঠিক করে বুকিং কনফার্ম করুন।
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                ০৩. নিরাপদ BDT পেমেন্ট
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                পার্সোনাল বিকাশ, পার্সোনাল নগদ, রকেট, SSLCommerz ও সীমিত ক্যাশ পেমেন্ট সাপোর্ট করে।
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                ০৪. পাবলিক স্থান নিরাপত্তা
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                সর্বদা পাবলিক আউটিং, ইভেন্ট ও শান্তিপূর্ণ সহায়তা এবং ২৪/৭ রিপোর্ট ও ব্লক সুবিধা।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore All 8 Bangladesh Divisions Showcase */}
      <section className="bg-white border-b border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-700" />
              <h2 className="font-display text-lg font-bold text-slate-950">
                বাংলাদেশের বিভাগ অনুযায়ী সঙ্গী খুঁজুন
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/explore')}
              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              আঞ্চলিক ফিল্টার খুলুন →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {BANGLADESH_DIVISIONS.map((div) => (
              <button
                key={div.id}
                type="button"
                onClick={() => navigate(`/explore?division=${encodeURIComponent(div.id)}`)}
                className="text-left p-3 rounded-xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer group"
              >
                <p className="font-display text-sm font-bold text-slate-950 group-hover:text-blue-700">
                  {div.shortLabel}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {div.metroAreas[0]} · {div.districts.length} জেলা
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Top 100 Verified Companions & Bhai/Brother Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4" /> বাংলাদেশ টপ ১০০ লিডারবোর্ড
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight mt-1">
              টপ ১০০ যাচাইকৃত ভাই / বন্ধু ও সামাজিক সঙ্গী
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              সারা বাংলাদেশের যাচাইকৃত ক্যাটালগ — রেটিং, ইনস্টাগ্রাম/হোয়াটসঅ্যাপ ও ঘণ্টা প্রতি BDT রেট তুলনা করুন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            সম্পূর্ণ টপ ১০০ ডিরেক্টরি দেখুন <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'সকল টপ ১০০' },
              { id: 'bhai', label: 'ভাই / বন্ধু সঙ্গী' },
              { id: 'events', label: 'ইভেন্ট ও চা-কফি আড্ডা' },
              { id: 'assistance', label: 'হাসপাতাল, শপিং ও সহায়তা' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopTab(t.id as any)}
                className={`px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  topTab === t.id
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono text-slate-500 px-3 tabular-nums">
            দেখানো হচ্ছে {filteredTop100.length} জন · সারা বাংলাদেশ
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[440px] bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredTop100.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <p className="text-sm text-slate-600">এই ক্যাটাগরিতে এখনো কোনো সঙ্গী পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredTop100.slice(0, 8).map((cmp) => (
                <CompanionCard
                  key={cmp.uid}
                  companion={cmp}
                  onViewProfile={(uid) => navigate(`/companions/${uid}`)}
                  onBook={(uid) => navigate(`/booking/checkout/${uid}`)}
                />
              ))}
            </div>

            {filteredTop100.length > 4 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
                  <h3 className="font-display text-sm font-bold text-slate-950">
                    টপ ১০০ র‍্যাঙ্কড তালিকা (সারা বাংলাদেশ)
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    ১. বিকাশ পার্সোনাল · ২. নগদ পার্সোনাল ({platformPublic.nagadPersonalNumber || '01877pokpok'})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-4">র‍্যাঙ্ক</th>
                        <th className="py-2.5 px-4">সঙ্গী / ভাই</th>
                        <th className="py-2.5 px-4">বিভাগ ও জেলা</th>
                        <th className="py-2.5 px-4">রেটিং ও কাজ</th>
                        <th className="py-2.5 px-4 text-right">ঘণ্টা প্রতি</th>
                        <th className="py-2.5 px-4 text-right">বুকিং</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTop100.slice(0, 100).map((c) => (
                        <tr key={c.uid} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700 tabular-nums">
                            #{String(c.topRank || 1).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => navigate(`/companions/${c.uid}`)}
                              className="font-semibold text-slate-950 hover:text-blue-700 text-left cursor-pointer"
                            >
                              {c.displayName}
                            </button>
                            <p className="text-[11px] text-slate-500 line-clamp-1">{c.headline}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {c.division ? `${c.division} · ` : ''}{c.city}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-800">
                            <span className="inline-flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {c.ratingAvg.toFixed(2)} ({c.completedBookings} বুকিং)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-950 tabular-nums">
                            {formatBdt(c.hourlyRateBdt)}/ঘণ্টা
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/booking/checkout/${c.uid}`)}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              বুক করুন
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Booking Lifecycle Section */}
      <section className="bg-slate-950 text-white py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              আস্থার সাথে সাজানো সহজ ৩ ধাপের বুকিং প্রক্রিয়া
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              সঙ্গী খোঁজা থেকে শুরু করে পেমেন্ট ও সেশন সম্পন্ন হওয়া পর্যন্ত প্রতিটি ধাপ স্বচ্ছ ও নিরাপদ।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
              <p className="font-mono text-xs text-blue-400">ধাপ ০১ — খুঁজুন ও অনুরোধ করুন</p>
              <h3 className="font-display text-lg font-semibold">সার্চ, তুলনা ও রিকোয়েস্ট</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                বাংলাদেশের বিভাগ, জেলা, রেটিং, ভাষা এবং ঘণ্টা প্রতি BDT রেট অনুযায়ী সঙ্গী খুঁজুন। পাবলিক স্থান, তারিখ ও সময় উল্লেখ করে রিকোয়েস্ট পাঠান।
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <p className="font-mono text-xs text-blue-400">ধাপ ০২ — সম্মতি ও পেমেন্ট</p>
              <h3 className="font-display text-lg font-semibold">পারস্পরিক চুক্তি ও চেকআউট</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                সঙ্গী রিকোয়েস্ট গ্রহণ করলে পার্সোনাল বিকাশ, পার্সোনাল নগদ, অ্যাডমিন কাস্টম, বেনসন সিগারেট (১,০০০৳ = ৩ প্যাকেট), রকেট, SSLCommerz অথবা ক্যাশে পেমেন্ট সম্পন্ন করুন।
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(['bkash', 'nagad', 'custom', 'benson', 'rocket', 'sslcommerz', 'cash'] as const).map((gw) => (
                  <PaymentGatewayLogo key={gw} gateway={gw} size="xs" />
                ))}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
              <p className="font-mono text-xs text-blue-400">ধাপ ০৩ — মিটআপ ও রিভিউ</p>
              <h3 className="font-display text-lg font-semibold">সফল সেশন ও পেআউট</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                পেমেন্ট যাচাই হওয়ার সাথে সাথে বুকিং কনফার্ম হয়। মিটআপ শেষে সঙ্গীর ব্যালেন্স রিলিজ হয় এবং আপনি যাচাইকৃত রিভিউ দিতে পারবেন।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Prominent Platform Developer Spotlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <DeveloperBanner variant="spotlight" />
      </section>
    </main>
  );
}
