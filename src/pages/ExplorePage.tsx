import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, MapPin, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { CompanionCard } from '../components/CompanionCard.tsx';
import { DeveloperBanner } from '../components/DeveloperBanner.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  BANGLADESH_DIVISIONS,
  getLocationsForDivision,
  normalizeDivisionKey,
  resolveDivisionForLocation,
} from '../data/bangladeshRegions.ts';
import {
  DEFAULT_BENGALI_BOOKING_CATEGORIES,
  type ParsedPreferenceQuery,
} from '../data/bookingCategories.ts';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type { CompanionProfile } from '../types/logeasi.ts';

const QUICK_KEYWORD_PRESETS = [
  'Corporate',
  'Dining & Coffee',
  'Tea',
  'Cultural',
  'Book Fair',
  'Airport',
  'Senior Support',
  'Dhanmondi',
];

export function ExplorePage() {
  const { platformPublic, navigate } = useAuth();
  const [companions, setCompanions] = useState<CompanionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [safetyNotice, setSafetyNotice] = useState('');
  const [matchMeta, setMatchMeta] = useState<ParsedPreferenceQuery | null>(null);

  // Read initial query params if navigated from Home search or direct division URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialCity = urlParams.get('city') || 'all';
  const initialDivision =
    normalizeDivisionKey(urlParams.get('division')) ||
    (initialCity !== 'all' ? resolveDivisionForLocation(initialCity) : '') ||
    'all';

  const [q, setQ] = useState(urlParams.get('q') || '');
  const [preference, setPreference] = useState(urlParams.get('preference') || '');
  const [division, setDivision] = useState(initialDivision);
  const [city, setCity] = useState(initialCity);
  const [category, setCategory] = useState(urlParams.get('category') || 'all');
  const [language, setLanguage] = useState('all');
  const [sort, setSort] = useState('top');
  const [minRating, setMinRating] = useState('0');
  const [maxPrice, setMaxPrice] = useState('10000');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const categoryChoices = useMemo(() => {
    const dynamicCats =
      platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0
        ? platformPublic.bookingCategories
        : DEFAULT_BENGALI_BOOKING_CATEGORIES;
    return Array.from(new Set(dynamicCats));
  }, [platformPublic.bookingCategories]);

  const scopedLocations = useMemo(() => getLocationsForDivision(division), [division]);

  const activeDivisionMeta = useMemo(
    () => BANGLADESH_DIVISIONS.find((d) => d.id === division) || null,
    [division]
  );

  const handleDivisionChange = (nextDivision: string) => {
    setDivision(nextDivision);
    if (nextDivision === 'all') {
      setCity('all');
      return;
    }
    const allowedInNext = new Set(getLocationsForDivision(nextDivision).map((l) => l.toLowerCase()));
    if (city !== 'all' && !allowedInNext.has(city.toLowerCase())) {
      setCity('all');
    }
  };

  const requestSeqRef = useRef(0);
  const firstRenderRef = useRef(true);

  const fetchCompanions = useCallback(
    async (opts?: { overridePref?: string; overrideQ?: string }) => {
      const reqId = ++requestSeqRef.current;
      setLoading(true);
      setError('');
      setSafetyNotice('');
      try {
        const activePref = opts?.overridePref !== undefined ? opts.overridePref : preference;
        const activeQ = opts?.overrideQ !== undefined ? opts.overrideQ : q;
        const params = new URLSearchParams();
        params.set('top100', 'true');
        params.set('sort', sort);
        if (activeQ.trim()) params.set('q', activeQ.trim());
        if (activePref.trim()) params.set('preference', activePref.trim());
        if (division !== 'all') params.set('division', division);
        if (city !== 'all') params.set('city', city);
        if (category !== 'all') params.set('category', category);
        if (language !== 'all') params.set('language', language);
        if (Number(minRating) > 0) params.set('minRating', minRating);
        if (Number(maxPrice) > 0 && Number(maxPrice) < 10000) params.set('maxPrice', maxPrice);
        if (availableOnly) params.set('availableOnly', 'true');
        if (verifiedOnly) params.set('verifiedOnly', 'true');

        const res = await apiRequest<{
          companions: CompanionProfile[];
          safetyNotice?: string;
          matchMeta?: ParsedPreferenceQuery;
        }>(`/api/companions?${params.toString()}`);

        if (reqId !== requestSeqRef.current) return;
        setCompanions(res.companions || []);
        setSafetyNotice(res.safetyNotice || '');
        setMatchMeta(res.matchMeta || null);
      } catch (err: any) {
        if (reqId !== requestSeqRef.current) return;
        setError(err.message || 'Unable to load companions.');
      } finally {
        if (reqId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [q, preference, division, city, category, language, sort, minRating, maxPrice, availableOnly, verifiedOnly]
  );

  useEffect(() => {
    fetchCompanions();
  }, [division, city, category, language, sort, minRating, maxPrice, availableOnly, verifiedOnly]);

  // Live debounced keyword search when user types in the search bar
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchCompanions({ overrideQ: q });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const toggleCompare = (uid: string) => {
    setCompareIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : prev.length < 3 ? [...prev, uid] : prev
    );
  };

  const comparedProfiles = companions.filter((c) => compareIds.includes(c.uid));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight">
            {activeDivisionMeta
              ? `${activeDivisionMeta.label}-এর সঙ্গী খুঁজুন`
              : 'সারা বাংলাদেশের টপ ১০০ সঙ্গী খুঁজুন'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            বাংলাদেশের সকল ৮টি বিভাগ (ঢাকা, চট্টগ্রাম, সিলেট, রাজশাহী, খুলনা, বরিশাল, রংপুর, ময়মনসিংহ) ও স্থানীয় এলাকা অনুযায়ী ১৮+ যাচাইকৃত সঙ্গী ফিল্টার করুন।
          </p>
        </div>
        <p className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap shrink-0">
          {companions.length} জন সঙ্গী · {activeDivisionMeta ? activeDivisionMeta.label : 'সকল ৮ বিভাগ'}
        </p>
      </div>

      {/* Keyword-Based Search Bar (Names, Interests, Skills) */}
      <section
        aria-label="কীওয়ার্ড ভিত্তিক সঙ্গী অনুসন্ধান"
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="explore-keyword-search" className="font-display text-sm sm:text-base font-bold text-slate-950">
            নাম, আগ্রহ বা দক্ষতা দিয়ে সঙ্গী খুঁজুন
          </label>
          <span className="text-xs text-slate-500">
            সঙ্গীর নাম · দক্ষতা · আগ্রহ · ক্যাটাগরি · ভাষা · এলাকা
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchCompanions({ overrideQ: q });
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="flex-1 flex items-center gap-2.5 border border-slate-300 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-100 rounded-xl px-3.5 py-2.5 bg-slate-50/60 transition-colors">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              id="explore-keyword-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="নাম, আগ্রহ বা দক্ষতা লিখুন (যেমন: Rafiq, Corporate, Tea Garden, Book Fair, Airport, Senior Support)..."
              className="w-full text-sm text-slate-950 placeholder:text-slate-400 bg-transparent focus:outline-none"
            />
            {q.trim() && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  fetchCompanions({ overrideQ: '' });
                }}
                aria-label="সার্চ কীওয়ার্ড মুছুন"
                className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Search className="w-4 h-4" />
            কীওয়ার্ড খুঁজুন
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium pr-1">জনপ্রিয় কীওয়ার্ড:</span>
          {QUICK_KEYWORD_PRESETS.map((kw) => {
            const isActive = q.trim().toLowerCase() === kw.toLowerCase();
            return (
              <button
                key={kw}
                type="button"
                onClick={() => {
                  const nextQ = isActive ? '' : kw;
                  setQ(nextQ);
                  fetchCompanions({ overrideQ: nextQ });
                }}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {kw}
              </button>
            );
          })}
        </div>

        {q.trim() && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              <strong className="text-slate-950 font-semibold">“{q.trim()}”</strong> কীওয়ার্ড অনুযায়ী{' '}
              <span className="font-mono font-bold text-blue-700 tabular-nums">{companions.length}</span> জন সঙ্গী প্রদর্শিত হচ্ছে
              <span aria-hidden="true"> · </span>
              নাম, দক্ষতা, আগ্রহ ও পরিচিতি থেকে ম্যাচ করা হয়েছে
            </span>
            <button
              type="button"
              onClick={() => {
                setQ('');
                fetchCompanions({ overrideQ: '' });
              }}
              className="text-blue-700 hover:underline font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              সার্চ মুছুন
            </button>
          </div>
        )}
      </section>

      {/* Smart Bangla Preference & Rate Matcher */}
      <div className="mt-4 bg-slate-950 text-white rounded-2xl p-5 border border-slate-800 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h2 className="font-display text-sm sm:text-base font-bold">
              যেমন সঙ্গী ও রেট চাই বিস্তারিত লিখুন (স্মার্ট বাংলা ম্যাচার)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            ধরন + এলাকা + BDT বাজেট লিখলেই ম্যাচিং সঙ্গী চলে আসবে
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={preference}
            onChange={(e) => setPreference(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCompanions()}
            placeholder="যেমন: ঢাকায় চা ও সিগারেট ব্রেক আড্ডার জন্য ১৫০০ টাকার মধ্যে বন্ধু চাই বা টং আড্ডার সঙ্গী..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => fetchCompanions()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
          >
            ম্যাচিং সঙ্গী খুঁজুন
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400">দ্রুত পছন্দ:</span>
          {[
            'চা ও সিগারেট ব্রেক আড্ডার জন্য ১৫০০ টাকার মধ্যে বন্ধু চাই',
            'টং এর আড্ডার রাজা ও গল্পের জন্য বন্ধু চাই',
            'ঢাকায় মেয়ে বন্ধু / কফি আউটিং ২০০০ টাকার মধ্যে',
            'শান্তিপূর্ণ গ্যাঞ্জাম সমাধান ও মিটমাটের জন্য বিশ্বস্ত ভাই চাই',
            'সিলেটে ঘোরা ফেরা ও শহর ভ্রমণের জন্য ভাই সঙ্গী চাই',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setPreference(preset);
                fetchCompanions({ overridePref: preset });
              }}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-200 cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>

        {matchMeta && (matchMeta.detectedDivision || matchMeta.extractedMaxRate || matchMeta.searchTokens.length > 0) && (
          <div className="p-2.5 bg-blue-950/60 border border-blue-800/70 rounded-lg text-xs text-blue-200 flex flex-wrap gap-3">
            <span>ম্যাচ করা শর্ত:</span>
            {matchMeta.detectedDivision && (
              <span className="font-mono">বিভাগ: {matchMeta.detectedDivision}</span>
            )}
            {matchMeta.extractedMaxRate && (
              <span className="font-mono">সর্বোচ্চ রেট: ৳{matchMeta.extractedMaxRate.toLocaleString()}/hr</span>
            )}
            {matchMeta.preferredGender && (
              <span className="font-mono">
                ধরন: {matchMeta.preferredGender === 'female' ? 'মেয়ে বন্ধু / কফি আউটিং' : 'ভাই / বন্ধু সঙ্গী'}
              </span>
            )}
          </div>
        )}

        {safetyNotice && (
          <div className="p-3 bg-red-950/70 border border-red-700 rounded-lg text-xs text-red-200">
            {safetyNotice}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        {/* Administrative Division Quick Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap shrink-0 pr-1">
            <MapPin className="w-3.5 h-3.5 text-blue-700" />
            বিভাগ:
          </span>
          <button
            type="button"
            onClick={() => handleDivisionChange('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              division === 'all'
                ? 'bg-slate-950 text-white border-slate-950'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            সারা বাংলাদেশ
          </button>
          {BANGLADESH_DIVISIONS.map((div) => (
            <button
              key={div.id}
              type="button"
              onClick={() => handleDivisionChange(div.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                division === div.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {div.shortLabel}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={division}
            onChange={(e) => handleDivisionChange(e.target.value)}
            aria-label="বাংলাদেশের বিভাগ অনুযায়ী ফিল্টার"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">সকল ৮ বিভাগ (বাংলাদেশ)</option>
            {BANGLADESH_DIVISIONS.map((div) => (
              <option key={div.id} value={div.id}>
                {div.label}
              </option>
            ))}
          </select>

          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="জেলা বা এলাকা অনুযায়ী ফিল্টার"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">
              {activeDivisionMeta ? `${activeDivisionMeta.shortLabel}-এর সকল এলাকা` : 'সকল জেলা ও এলাকা'}
            </option>
            {scopedLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="ক্যাটাগরি অনুযায়ী ফিল্টার"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">সকল ক্যাটাগরি</option>
            {categoryChoices.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fetchCompanions()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Filter className="w-4 h-4" />
            ফিল্টার খুঁজুন
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span className="font-medium">শুধু ভেরিফায়েড আইডি</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-700"
              />
              <span className="font-medium">এখনই অ্যাভেইলেবল</span>
            </label>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>সর্বোচ্চ ঘণ্টা রেট:</span>
              <select
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono"
              >
                <option value="10000">যেকোনো BDT</option>
                <option value="1500">৳১,৫০০/ঘণ্টা পর্যন্ত</option>
                <option value="2000">৳২,০০০/ঘণ্টা পর্যন্ত</option>
                <option value="2500">৳২,৫০০/ঘণ্টা পর্যন্ত</option>
                <option value="4000">৳৪,০০০/ঘণ্টা পর্যন্ত</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span>ভাষা:</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
              >
                <option value="all">যেকোনো ভাষা</option>
                <option value="Bengali">বাংলা</option>
                <option value="English">ইংরেজি</option>
                <option value="Hindi">হিন্দি</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span>সাজান:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="সঙ্গী সাজান"
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
              >
                <option value="top">টপ ১০০ র‍্যাঙ্ক</option>
                <option value="rating">সর্বোচ্চ রেটিং</option>
                <option value="completed">সবচেয়ে বেশি সেশন</option>
                <option value="price_asc">সবচেয়ে কম রেট (BDT)</option>
                <option value="price_desc">সর্বোচ্চ রেট (BDT)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setQ('');
              setPreference('');
              setMatchMeta(null);
              setSafetyNotice('');
              setDivision('all');
              setCity('all');
              setCategory('all');
              setLanguage('all');
              setSort('top');
              setMinRating('0');
              setMaxPrice('10000');
              setAvailableOnly(false);
              setVerifiedOnly(false);
              fetchCompanions({ overridePref: '', overrideQ: '' });
            }}
            className="text-blue-700 hover:underline font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      </div>

      {/* Side-by-side comparison bar */}
      {comparedProfiles.length > 0 && (
        <section className="mt-6 bg-slate-950 text-white rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold">
              পাশাপাশি তুলনা ({comparedProfiles.length}/৩)
            </h2>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> তুলনা মুছুন
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4">সঙ্গী</th>
                  <th className="py-2 px-4">বিভাগ ও এলাকা</th>
                  <th className="py-2 px-4">ঘণ্টা প্রতি রেট</th>
                  <th className="py-2 px-4">সেশন রেট</th>
                  <th className="py-2 px-4">রেটিং</th>
                  <th className="py-2 px-4">ভেরিফিকেশন</th>
                  <th className="py-2 pl-4 text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {comparedProfiles.map((c) => (
                  <tr key={c.uid}>
                    <td className="py-2.5 pr-4 font-semibold text-white">{c.displayName}</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {c.division ? `${c.division} · ` : ''}
                      {c.city} ({(c.areas || []).slice(0, 2).join(', ')})
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{formatBdt(c.hourlyRateBdt)}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{formatBdt(c.sessionRateBdt)}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{c.ratingAvg > 0 ? `${c.ratingAvg} (${c.reviewCount})` : 'নতুন'}</td>
                    <td className="py-2.5 px-4">
                      {c.verificationStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-blue-300">
                          <ShieldCheck className="w-3.5 h-3.5" /> ভেরিফায়েড
                        </span>
                      ) : (
                        <span className="text-slate-400 capitalize">{c.verificationStatus}</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/booking/checkout/${c.uid}`)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold whitespace-nowrap cursor-pointer"
                      >
                        সিলেক্ট ও বুক করুন
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[440px] bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : companions.length === 0 ? (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="font-display text-lg font-semibold text-slate-900">আপনার ফিল্টারের সাথে কোনো সঙ্গী মেলেনি</p>
          <p className="text-sm text-slate-600">
            দয়া করে "সারা বাংলাদেশ" নির্বাচন করুন, এলাকা ফিল্টার রিসেট করুন অথবা সর্বোচ্চ রেট বাড়িয়ে দেখুন।
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {companions.map((cmp) => (
            <CompanionCard
              key={cmp.uid}
              companion={cmp}
              onViewProfile={(uid) => navigate(`/companions/${uid}`)}
              onBook={(uid) => navigate(`/booking/checkout/${uid}`)}
              onToggleCompare={toggleCompare}
              isCompared={compareIds.includes(cmp.uid)}
            />
          ))}
        </div>
      )}

      <div className="mt-10">
        <DeveloperBanner variant="card" />
      </div>
    </main>
  );
}
