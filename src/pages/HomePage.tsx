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
import { useAuth } from '../context/AuthContext.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
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
        (c.categories || []).some((cat) => cat.toLowerCase().includes('bhai'))
      );
    }
    if (topTab === 'events') {
      return (c.categories || []).some((cat) =>
        /corporate|event|dining|coffee|cultural/i.test(cat)
      );
    }
    if (topTab === 'assistance') {
      return (c.categories || []).some((cat) =>
        /assistance|errands|senior|shopping/i.test(cat)
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
                  BANGLADESH’S 8 DIVISIONS · 18+ VERIFIED COMPANIONSHIP
                </p>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-white leading-[1.06] text-balance">
                  Your Time. Your Choice. Your Companion.
                </h1>
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                  {platformPublic.featuredHeadline ||
                    'Book verified 18+ companions & trusted Bhai/Brother escorts across all 8 Divisions of Bangladesh for public events, dining, business outings, and everyday assistance.'}
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
                    aria-label="Select Bangladesh division"
                    className="w-full text-sm text-white bg-transparent focus:outline-none"
                  >
                    <option value="all" className="text-slate-900">All 8 Bangladesh Divisions</option>
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
                    aria-label="Select category"
                    className="w-full text-sm text-white bg-transparent focus:outline-none"
                  >
                    <option value="all" className="text-slate-900">All Categories</option>
                    <option value="Bhai / Brother Companion" className="text-slate-900">Bhai / Brother Companion</option>
                    <option value="Corporate Events" className="text-slate-900">Corporate Events</option>
                    <option value="Public Events" className="text-slate-900">Public Events</option>
                    <option value="Dining & Coffee" className="text-slate-900">Dining & Coffee</option>
                    <option value="Everyday Assistance" className="text-slate-900">Everyday Assistance</option>
                    <option value="Cultural & Galleries" className="text-slate-900">Cultural & Galleries</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="sm:col-span-3 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  Find Companion
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-5 text-sm">
                <button
                  type="button"
                  onClick={() => navigate('/become-companion')}
                  className="font-semibold text-white hover:text-blue-300 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  Become a Companion <ArrowRight className="w-4 h-4" />
                </button>
                <span aria-hidden="true" className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => navigate(user ? (user.role === 'companion' ? '/dashboard/companion' : '/dashboard/customer') : '/auth?tab=register')}
                  className="font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  {user ? `Open ${user.fullName} Dashboard` : 'Create Free 18+ Account'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[380px] rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-2xl">
                <img
                  src="/src/assets/images/hero_dhaka_lounge_1794647508278.jpg"
                  alt="Two adults enjoying a social coffee conversation at a bright Gulshan lounge in Dhaka"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent p-6 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-blue-300 uppercase tracking-wider">
                        PUBLIC VENUES · DHAKA TO SYLHET & CHATTOGRAM
                      </p>
                      <p className="text-sm sm:text-base text-white font-semibold mt-1">
                        Strict non-sexual social companionship backed by 18+ NID verification.
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
                      <p className="text-white font-bold text-sm">BDT (৳)</p>
                      <p>bKash · Nagad · Cash</p>
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
                01. Adult 18+ ID Verification
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Companions undergo NID or Passport date-of-birth checks before earning verified status.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-400" />
                02. Mutual Price Agreement
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Submit a request, agree on final BDT pricing together, then confirm with checkout.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                03. Verified BDT Payments
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supports Personal bKash, Personal Nagad, Rocket, SSLCommerz & permitted cash.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                04. Public-Space Safeguards
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strictly public outings, events, and everyday assistance with 24/7 reporting and blocking.
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
                Browse Companions by Bangladesh Division
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/explore')}
              className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Open Interactive Regional Filter →
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
                  {div.metroAreas[0]} · {div.districts.length} dist
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
              <Award className="w-4 h-4" /> Bangladesh Top 100 Leaderboard
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight mt-1">
              Top 100 Verified Bhai / Brother & Companions
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Ranked marketplace catalog across Bangladesh — compare ratings, Instagram/WhatsApp channels, completed sessions, and hourly BDT rates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            Browse Full Top 100 Directory <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Top 100' },
              { id: 'bhai', label: 'Bhai / Brother Escorts' },
              { id: 'events', label: 'Events & Dining' },
              { id: 'assistance', label: 'Hospital, Errands & Senior Care' },
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
            Showing {filteredTop100.length} of Top 100 · All Bangladesh
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
            <p className="text-sm text-slate-600">No companions matched this category filter yet.</p>
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
                    Top 100 Ranked Catalog List (Bangladesh Nationwide)
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    1. bKash Personal · 2. Nagad Personal ({platformPublic.nagadPersonalNumber || '01877pokpok'})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 px-4">Rank</th>
                        <th className="py-2.5 px-4">Companion / Bhai</th>
                        <th className="py-2.5 px-4">Division & City</th>
                        <th className="py-2.5 px-4">Rating & Jobs</th>
                        <th className="py-2.5 px-4 text-right">Hourly</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
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
                              {c.ratingAvg.toFixed(2)} ({c.completedBookings} bookings)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-950 tabular-nums">
                            {formatBdt(c.hourlyRateBdt)}/hr
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/booking/checkout/${c.uid}`)}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Book Now
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
              An Uber-Inspired Booking Workflow Built for Trust
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Every step from discovery to payout reconciliation follows clear milestones so both customers and companions stay protected.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
              <p className="font-mono text-xs text-blue-400">STEP 01 — DISCOVER & REQUEST</p>
              <h3 className="font-display text-lg font-semibold">Search, Compare & Request</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Filter by Bangladesh Division, district, verified rating, languages, and BDT hourly or session pricing. Submit your public venue, date, and duration.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
              <p className="font-mono text-xs text-blue-400">STEP 02 — AGREE & CHECKOUT</p>
              <h3 className="font-display text-lg font-semibold">Mutual Agreement & Payment</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                The companion accepts or proposes an updated rate. Once both agree, complete checkout via Personal bKash, Personal Nagad, Rocket, SSLCommerz, or permitted cash.
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
              <p className="font-mono text-xs text-blue-400">STEP 03 — MEET & REVIEW</p>
              <h3 className="font-display text-lg font-semibold">Verified Meetup & Payout</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Verified payments unlock instant booking confirmation. After session completion, funds release to companion balance and verified reviews open.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
