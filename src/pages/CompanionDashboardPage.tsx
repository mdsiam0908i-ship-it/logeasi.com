import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Instagram,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { PaymentGatewayLogo } from '../components/PaymentGatewayLogo.tsx';
import { ReferralInviteWidget } from '../components/ReferralInviteWidget.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
import { DEFAULT_BENGALI_BOOKING_CATEGORIES } from '../data/bookingCategories.ts';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type {
  BookingRecord,
  CompanionPayoutRecord,
  CompanionPostRecord,
  VerificationRequestRecord,
} from '../types/logeasi.ts';

export function CompanionDashboardPage() {
  const { user, companionProfile, platformPublic, currentPath, refreshSession, logout, navigate } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [payouts, setPayouts] = useState<CompanionPayoutRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequestRecord[]>([]);
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

  // Companion profile controls
  const [displayName, setDisplayName] = useState(user?.fullName || '');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [city, setCity] = useState('Dhaka');
  const [areasText, setAreasText] = useState('Gulshan, Banani');
  const [languagesText, setLanguagesText] = useState('Bengali, English');
  const [categoriesText, setCategoriesText] = useState('Corporate Events, Dining & Coffee');
  const [interestsText, setInterestsText] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [hourlyRateBdt, setHourlyRateBdt] = useState(1800);
  const [sessionRateBdt, setSessionRateBdt] = useState(5000);
  const [availabilityDays, setAvailabilityDays] = useState<string[]>(['Fri', 'Sat', 'Sun']);
  const [availabilityHours, setAvailabilityHours] = useState('10:00 AM – 9:00 PM');
  const [isAvailableNow, setIsAvailableNow] = useState(true);
  const [photoUrl, setPhotoUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');

  // Verification submission
  const [docType, setDocType] = useState<'nid' | 'school_roll' | 'student_id' | 'passport' | 'driving_license'>('nid');
  const [docNumber, setDocNumber] = useState('');
  const [dob, setDob] = useState('1996-05-10');

  // Payout form
  const [payoutAmount, setPayoutAmount] = useState(1000);
  const [payoutMethod, setPayoutMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'bank_eft'>('bkash');
  const [payoutAccount, setPayoutAccount] = useState('');

  // Companion personal posts
  const [posts, setPosts] = useState<CompanionPostRecord[]>([]);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postTag, setPostTag] = useState('আমার আপডেট');
  const [postPhotoUrl, setPostPhotoUrl] = useState('');
  const [postBusy, setPostBusy] = useState(false);

  // Counter offer price map
  const [counterPrices, setCounterPrices] = useState<Record<string, string>>({});
  const [milestoneBusyId, setMilestoneBusyId] = useState('');
  const [notice, setNotice] = useState('');

  const loadCompanionData = async () => {
    if (!user) return;
    try {
      const [bRes, pRes, vRes, postsRes] = await Promise.all([
        apiRequest<{ bookings: BookingRecord[] }>('/api/bookings'),
        apiRequest<{ payouts: CompanionPayoutRecord[] }>('/api/payouts/mine'),
        apiRequest<{ verifications: VerificationRequestRecord[] }>('/api/verifications/mine'),
        apiRequest<{ posts: CompanionPostRecord[] }>(`/api/companions/${user.uid}/posts`).catch(() => ({ posts: [] })),
      ]);
      setBookings((bRes.bookings || []).filter((b) => b.companionUid === user.uid));
      setPayouts(pRes.payouts || []);
      setVerifications(vRes.verifications || []);
      setPosts(postsRes.posts || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (companionProfile) {
      setDisplayName(companionProfile.displayName);
      setHeadline(companionProfile.headline);
      setBio(companionProfile.bio);
      setDivision(companionProfile.division || 'Dhaka');
      setCity(companionProfile.city);
      setAreasText((companionProfile.areas || []).join(', '));
      setLanguagesText((companionProfile.languages || []).join(', '));
      setCategoriesText((companionProfile.categories || []).join(', '));
      setInterestsText((companionProfile.interests || []).join(', '));
      setSkillsText((companionProfile.skills || []).join(', '));
      setHourlyRateBdt(companionProfile.hourlyRateBdt);
      setSessionRateBdt(companionProfile.sessionRateBdt);
      setAvailabilityDays(companionProfile.availabilityDays || ['Fri', 'Sat']);
      setAvailabilityHours(companionProfile.availabilityHours);
      setIsAvailableNow(companionProfile.isAvailableNow);
      setPhotoUrl(companionProfile.photoUrl || '');
      setInstagramHandle(companionProfile.instagramHandle || '');
      setWhatsappNumber(companionProfile.whatsappNumber || user?.phone || '');
      setContactEmail(companionProfile.contactEmail || user?.email || '');
      if (companionProfile.gender) setGender(companionProfile.gender);
      else if (user?.gender) setGender(user.gender);
    } else if (user) {
      setWhatsappNumber(user.phone || '');
      setContactEmail(user.email || '');
      if (user.gender) setGender(user.gender);
    }
    if (user) loadCompanionData();
  }, [user, companionProfile]);

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">সঙ্গী (কম্প্যানিয়ন) ড্যাশবোর্ড</h1>
        <p className="text-sm text-slate-600">
          সঙ্গী অ্যাকাউন্ট সরাসরি খোলা যায় না। অ্যাডমিন আপনার আবেদন অনুমোদন করে WhatsApp-এ যে ইমেইল ও পাসওয়ার্ড দিয়েছেন, তা দিয়ে লগইন করুন অথবা নতুন আবেদন জমা দিন।
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/auth?mode=companion')}
            className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
          >
            অ্যাডমিন প্রদত্ত অ্যাকাউন্টে লগইন করুন
          </button>
          <button
            type="button"
            onClick={() => navigate('/become-companion')}
            className="px-5 py-2.5 border border-slate-300 text-slate-800 rounded-lg text-sm font-semibold cursor-pointer"
          >
            নতুন সঙ্গী আবেদন জমা দিন
          </button>
        </div>
      </main>
    );
  }

  if (user.role === 'customer') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-950">সঙ্গী ড্যাশবোর্ড সংরক্ষিত</h1>
        <p className="text-sm text-slate-600">
          আপনি বর্তমানে কাস্টমার অ্যাকাউন্টে লগইন আছেন। সঙ্গী হতে চাইলে আবেদন ফর্ম জমা দিন — অ্যাডমিন যাচাই করে আপনার WhatsApp-এ ইমেইল ও পাসওয়ার্ড তৈরি করে বুঝিয়ে দেবেন।
        </p>
        <button
          type="button"
          onClick={() => navigate('/become-companion')}
          className="px-5 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          সঙ্গী হওয়ার আবেদন ফর্মে যান →
        </button>
      </main>
    );
  }

  const activeDivisionObj =
    BANGLADESH_DIVISIONS.find((d) => d.id === division) || BANGLADESH_DIVISIONS[0];

  const toggleDay = (day: string) => {
    setAvailabilityDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const saveCompanionProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/companion/profile', {
        method: 'PUT',
        body: JSON.stringify({
          displayName,
          headline,
          bio,
          division,
          city,
          areas: areasText.split(',').map((s) => s.trim()).filter(Boolean),
          languages: languagesText.split(',').map((s) => s.trim()).filter(Boolean),
          categories: categoriesText.split(',').map((s) => s.trim()).filter(Boolean),
          interests: interestsText.split(',').map((s) => s.trim()).filter(Boolean),
          skills: skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          hourlyRateBdt: Number(hourlyRateBdt),
          sessionRateBdt: Number(sessionRateBdt),
          availabilityDays,
          availabilityHours,
          isAvailableNow,
          photoUrl,
          instagramHandle,
          whatsappNumber,
          contactEmail,
          gender,
        }),
      });
      await refreshSession();
      setNotice('সঙ্গী প্রোফাইল, ইনস্টাগ্রাম/হোয়াটসঅ্যাপ/ইমেইল চ্যানেল, মূল্য ও সময়সূচি সংরক্ষিত হয়েছে।');
    } catch (err: any) {
      setNotice(err.message);
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
      await refreshSession();
      await loadCompanionData();
      setNotice('১৮+ পরিচয় যাচাইয়ের আবেদন ভেরিফিকেশন অ্যাডমিনের কাছে পাঠানো হয়েছে।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const respondBooking = async (bookingId: string, decision: 'accept' | 'decline') => {
    setNotice('');
    try {
      const counter = counterPrices[bookingId] ? Number(counterPrices[bookingId]) : undefined;
      await apiRequest(`/api/bookings/${bookingId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision, counterPriceBdt: counter }),
      });
      await loadCompanionData();
      setNotice(`বুকিং ${decision === 'accept' ? 'গ্রহণ করা হয়েছে' : 'প্রত্যাখ্যান করা হয়েছে'}।`);
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/payouts/request', {
        method: 'POST',
        body: JSON.stringify({
          amountBdt: Number(payoutAmount),
          method: payoutMethod,
          accountNumber: payoutAccount,
        }),
      });
      setPayoutAccount('');
      await refreshSession();
      await loadCompanionData();
      setNotice('পেআউট অনুরোধ অ্যাডমিনের অনুমোদনের জন্য পাঠানো হয়েছে। অ্যাডমিন WhatsApp বা নির্বাচিত মাধ্যমে টাকা বুঝিয়ে দেবেন।');
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const createCompanionPost = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    setPostBusy(true);
    try {
      const res = await apiRequest<{ post: CompanionPostRecord }>('/api/companion/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: postTitle,
          content: postContent,
          tag: postTag,
          photoUrl: postPhotoUrl,
        }),
      });
      setPosts((prev) => [res.post, ...prev]);
      setPostTitle('');
      setPostContent('');
      setPostPhotoUrl('');
      setNotice('আপনার পোস্ট পাবলিক প্রোফাইলে প্রকাশিত হয়েছে!');
    } catch (err: any) {
      setNotice(err.message || 'পোস্ট প্রকাশ করা যায়নি।');
    } finally {
      setPostBusy(false);
    }
  };

  const deleteCompanionPost = async (postId: string) => {
    setNotice('');
    try {
      await apiRequest(`/api/companion/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setNotice('পোস্ট মুছে ফেলা হয়েছে।');
    } catch (err: any) {
      setNotice(err.message || 'পোস্ট মুছে ফেলা যায়নি।');
    }
  };

  const updateJourneyMilestone = async (bookingId: string, stage: 'departed' | 'arrived') => {
    setNotice('');
    setMilestoneBusyId(`${bookingId}_${stage}`);
    try {
      await apiRequest(`/api/bookings/${bookingId}/milestone`, {
        method: 'POST',
        body: JSON.stringify({ stage }),
      });
      await loadCompanionData();
      setNotice(
        stage === 'departed'
          ? 'কাস্টমার ও অ্যাডমিনকে জানানো হয়েছে যে আপনি ব্যাগ গুছিয়ে লোকেশনের উদ্দেশ্যে রওনা দিয়েছেন!'
          : 'লোকেশনে সফল আগমন রেকর্ড হয়েছে! এখন সরাসরি কাস্টমারের সাথে কনভারসেশন শুরু করতে পারেন।'
      );
    } catch (err: any) {
      setNotice(err.message || 'যাত্রা আপডেট দেওয়া যায়নি।');
    } finally {
      setMilestoneBusyId('');
    }
  };

  const verStatus = companionProfile?.verificationStatus || 'unverified';
  const dayOptions = [
    { key: 'Sun', label: 'রবি' },
    { key: 'Mon', label: 'সোম' },
    { key: 'Tue', label: 'মঙ্গল' },
    { key: 'Wed', label: 'বুধ' },
    { key: 'Thu', label: 'বৃহঃ' },
    { key: 'Fri', label: 'শুক্র' },
    { key: 'Sat', label: 'শনি' },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
            সঙ্গী (কম্প্যানিয়ন) ড্যাশবোর্ড
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            ভেরিফিকেশন অবস্থা: <span className="font-semibold capitalize text-blue-700">{verStatus}</span> · আপনার BDT (৳) মূল্য, Instagram/WhatsApp/Email ও সময়সূচি পরিচালনা করুন
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {companionProfile && (
            <button
              type="button"
              onClick={() => navigate(`/companions/${user.uid}`)}
              className="px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              পাবলিক প্রোফাইল দেখুন
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/bookings')}
            className="px-4 py-2 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            সকল বুকিং ও চ্যাট
          </button>
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            পেমেন্ট, অ্যাডভান্স ও রসিদ লেজার
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

      {/* Earnings & Booking Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">উত্তোলনযোগ্য আয়</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {formatBdt(companionProfile?.availableBalanceBdt || 0)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">এস্ক্রোতে অপেক্ষমাণ</p>
          <p className="font-mono text-2xl font-bold text-blue-700 tabular-nums mt-1">
            {formatBdt(companionProfile?.pendingBalanceBdt || 0)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">নতুন অনুরোধ</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {bookings.filter((b) => b.status === 'requested').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-slate-500">সম্পন্ন সেশন</p>
          <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums mt-1">
            {companionProfile?.completedBookings || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Referral + Profile (collapsed by default unless ?editProfile=1), Pricing, Availability */}
        <div className="lg:col-span-6 space-y-6">
          <ReferralInviteWidget />
          {!showProfileEditor ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-700" /> সঙ্গী প্রোফাইল ও রেট
                </h2>
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(true)}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 rounded-lg cursor-pointer"
                >
                  প্রোফাইল আপডেট / এডিট
                </button>
              </div>
              <p className="text-xs text-slate-600">
                {displayName || user.fullName} · {city} ({division}) · {formatBdt(hourlyRateBdt)}/ঘণ্টা
              </p>
            </div>
          ) : (
            <form onSubmit={saveCompanionProfile} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-700" /> প্রোফাইল, সোশ্যাল চ্যানেল ও সময়সূচি
                </h2>
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  সংক্ষিপ্ত করুন
                </button>
              </div>

            <DevicePhotoPicker
              label="সঙ্গীর প্রোফাইল ছবি (ডিভাইস থেকে দিন)"
              helperText="ফোন গ্যালারি বা কম্পিউটার থেকে সরাসরি পরিষ্কার ছবি বাছাই করুন — URL লাগবে না।"
              value={photoUrl}
              onChange={setPhotoUrl}
            />

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">প্রদর্শিত নাম</label>
              <input
                required
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                লিঙ্গ নির্বাচন করুন (ছেলে নাকি মেয়ে)
              </label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">বাংলাদেশের বিভাগ</label>
                <select
                  value={division}
                  onChange={(e) => {
                    const nextDiv = e.target.value;
                    setDivision(nextDiv);
                    const found = BANGLADESH_DIVISIONS.find((d) => d.id === nextDiv);
                    if (found && found.districts.length > 0) setCity(found.districts[0]);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {BANGLADESH_DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">জেলা / প্রধান শহর</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {Array.from(new Set([...activeDivisionObj.districts, ...activeDivisionObj.metroAreas])).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Social & Contact Options */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <p className="text-xs font-bold text-slate-900">
                ইনস্টাগ্রাম, হোয়াটসঅ্যাপ ও যোগাযোগের ইমেইল
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
                    placeholder="@handle বা লিংক"
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
                    <Mail className="w-3 h-3 text-blue-700" /> যোগাযোগের ইমেইল
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@email.com"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">শিরোনাম (Headline)</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">সংক্ষিপ্ত পরিচিতি</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">ঘণ্টাপ্রতি রেট (BDT ৳)</label>
                <input
                  type="number"
                  min={500}
                  value={hourlyRateBdt}
                  onChange={(e) => setHourlyRateBdt(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">৪-ঘণ্টা সেশন রেট (BDT ৳)</label>
                <input
                  type="number"
                  min={1000}
                  value={sessionRateBdt}
                  onChange={(e) => setSessionRateBdt(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">এলাকা (কমা দিয়ে)</label>
                <input
                  type="text"
                  value={areasText}
                  onChange={(e) => setAreasText(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">ভাষা</label>
                <input
                  type="text"
                  value={languagesText}
                  onChange={(e) => setLanguagesText(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">ক্যাটাগরি</label>
                <input
                  type="text"
                  value={categoriesText}
                  onChange={(e) => setCategoriesText(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">আগ্রহ ও শখ (Interests — কমা দিয়ে)</label>
                <input
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="যেমন: Tea, Photography, Cricket, Book Fair"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">বিশেষ দক্ষতা (Skills — কমা দিয়ে)</label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="যেমন: Airport Escort, Corporate Hosting, City Tour"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-600">
                বাংলা ও জনপ্রিয় ক্যাটাগরি যোগ করুন (ক্লিক করে অন/অফ করুন):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(platformPublic.bookingCategories && platformPublic.bookingCategories.length > 0
                  ? platformPublic.bookingCategories
                  : DEFAULT_BENGALI_BOOKING_CATEGORIES
                ).map((cat) => {
                  const currentList = categoriesText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const active = currentList.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? currentList.filter((item) => item !== cat)
                          : [...currentList, cat];
                        setCategoriesText(next.join(', '));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                        active
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">উপলব্ধ দিনের তালিকা</label>
              <div className="flex flex-wrap gap-1.5">
                {dayOptions.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      availabilityDays.includes(d.key)
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">সময়ের পরিসর</label>
                <input
                  type="text"
                  value={availabilityHours}
                  onChange={(e) => setAvailabilityHours(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 py-2">
                <input
                  type="checkbox"
                  checked={isAvailableNow}
                  onChange={(e) => setIsAvailableNow(e.target.checked)}
                />
                এখনই উপলব্ধ দেখান
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              সঙ্গী প্রোফাইল সংরক্ষণ করুন
            </button>
          </form>
          )}

          {/* 18+ Identity Verification */}
          <form onSubmit={submitVerification} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" /> ১৮+ পরিচয় যাচাই (NID / স্কুল রোল)
            </h2>
            <p className="text-xs text-slate-600">
              ভেরিফিকেশন অ্যাডমিনের অনুমোদনের পরই ভেরিফায়েড ব্যাজ প্রদান করা হয়।
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
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
                placeholder="NID নম্বর বা স্কুল রোল লিখুন"
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
              />
              <input
                required
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              ভেরিফিকেশন রিভিউয়ে পাঠান
            </button>
            {verifications.length > 0 && (
              <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                সর্বশেষ জমা: <span className="font-semibold capitalize">{verifications[0].status}</span> ({verifications[0].documentType.toUpperCase()} {verifications[0].documentNumberMasked})
              </div>
            )}
          </form>
        </div>

        {/* Right: Companion Personal Posts + Incoming Bookings + Earnings & Admin WhatsApp Payouts */}
        <div className="lg:col-span-6 space-y-6">
          {/* Companion Personal Posts Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700" /> নিজের বিষয়ে পোস্ট লিখুন ও প্রকাশ করুন
                </h2>
                <p className="text-xs text-slate-500">
                  আপনার পোস্টগুলো পাবলিক প্রোফাইলে কাস্টমাররা দেখতে পাবেন। (অ্যাডমিন প্রয়োজনে মডারেশন করতে পারেন)
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/companions/${user.uid}`)}
                className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
              >
                প্রোফাইলে দেখুন →
              </button>
            </div>

            <form onSubmit={createCompanionPost} className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  required
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="পোস্টের শিরোনাম (যেমন: আজ সন্ধ্যায় গুলশান আড্ডা)"
                  className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
                <select
                  value={postTag}
                  onChange={(e) => setPostTag(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs"
                >
                  <option value="আমার আপডেট">আমার আপডেট</option>
                  <option value="আজকের সময়সূচি">আজকের সময়সূচি</option>
                  <option value="ভ্রমণ ও কফি">ভ্রমণ ও কফি</option>
                  <option value="বিশেষ ঘোষণা">বিশেষ ঘোষণা</option>
                </select>
              </div>
              <textarea
                required
                rows={2}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="আপনার সম্পর্কে, পছন্দের জায়গা বা কখন সময় দিতে পারবেন তা লিখুন..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
              />
              <DevicePhotoPicker
                label="পোস্টের ছবি (ঐচ্ছিক)"
                helperText="চাইলে ডিভাইস থেকে একটি ছবি যুক্ত করুন।"
                value={postPhotoUrl}
                onChange={setPostPhotoUrl}
              />
              <button
                type="submit"
                disabled={postBusy}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {postBusy ? 'প্রকাশ হচ্ছে...' : 'পোস্ট প্রকাশ করুন'}
              </button>
            </form>

            {posts.length > 0 && (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {posts.map((p) => (
                  <div key={p.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-semibold text-blue-700">{p.tag || 'আপডেট'}</span>
                        <span className="text-slate-400 font-mono">
                          {new Date(p.createdAt).toLocaleDateString('bn-BD')}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{p.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCompanionPost(p.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg shrink-0 cursor-pointer"
                      title="পোস্ট মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="font-display text-lg font-bold text-slate-950">আগত ও চলমান বুকিং (ব্যাগ গুছিয়ে যাত্রা ও লোকেশন)</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">এখনো কোনো বুকিং অনুরোধ আসেনি।</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  const canTravel = !['requested', 'declined', 'cancelled', 'completed'].includes(b.status);
                  const waHref = b.customerWhatsapp
                    ? `https://wa.me/${b.customerWhatsapp.replace(/[^\d]/g, '')}`
                    : '';
                  return (
                    <div key={b.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-900">{b.bookingCode}</span>
                        <span className="capitalize font-semibold text-blue-700">{b.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-950">
                        {b.customerName} · {b.venueName} ({b.city})
                      </p>
                      <p className="text-xs text-slate-600 font-mono tabular-nums">
                        {b.bookingDate} {b.startTime} · {b.durationHours} ঘণ্টা · প্রস্তাবিত {formatBdt(b.agreedPriceBdt)} (আপনার আয় {formatBdt(b.companionNetBdt)})
                      </p>
                      {b.notes && <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded">{b.notes}</p>}

                      {b.status === 'requested' && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <input
                            type="number"
                            placeholder="নতুন প্রস্তাব BDT (ঐচ্ছিক)"
                            value={counterPrices[b.id] || ''}
                            onChange={(e) =>
                              setCounterPrices((prev) => ({ ...prev, [b.id]: e.target.value }))
                            }
                            className="w-44 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => respondBooking(b.id, 'accept')}
                            className="px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            গ্রহণ / নতুন মূল্য প্রস্তাব
                          </button>
                          <button
                            type="button"
                            onClick={() => respondBooking(b.id, 'decline')}
                            className="px-3 py-1.5 border border-red-200 text-red-700 text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            প্রত্যাখ্যান
                          </button>
                        </div>
                      )}

                      {b.customerLiveLocation && (
                        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            কাস্টমার লাইভ লোকেশন শেয়ার করেছেন: {b.customerLiveLocation.addressLabel || b.venueName} (
                            <span className="font-mono text-[11px]">
                              {b.customerLiveLocation.lat.toFixed(4)}, {b.customerLiveLocation.lng.toFixed(4)}
                            </span>
                            )
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${b.customerLiveLocation.lat},${b.customerLiveLocation.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 font-bold underline"
                          >
                            Google Maps-এ দেখুন
                          </a>
                        </div>
                      )}

                      {!['declined', 'cancelled'].includes(b.status) && !canTravel && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/bookings?bookingId=${b.id}`)}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> কাস্টমারের সাথে আলাপ-আলোচনা ও লাইভ ম্যাপ
                          </button>
                        </div>
                      )}

                      {canTravel && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-semibold text-slate-700">সার্ভিস যাত্রা ধাপ:</span>
                            {b.companionDepartedAt && (
                              <span className="text-blue-700 font-mono font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> রওনা দিয়েছেন
                              </span>
                            )}
                            {b.companionArrivedAt && (
                              <span className="text-emerald-700 font-mono font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> লোকেশনে পৌঁছেছেন
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!b.companionDepartedAt && (
                              <button
                                type="button"
                                disabled={milestoneBusyId === `${b.id}_departed`}
                                onClick={() => updateJourneyMilestone(b.id, 'departed')}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Navigation className="w-3.5 h-3.5" /> ব্যাগ গুছিয়ে রওনা দিয়েছি
                              </button>
                            )}
                            {!b.companionArrivedAt && (
                              <button
                                type="button"
                                disabled={milestoneBusyId === `${b.id}_arrived`}
                                onClick={() => updateJourneyMilestone(b.id, 'arrived')}
                                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <MapPin className="w-3.5 h-3.5" /> সফলভাবে লোকেশনে পৌঁছেছি
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/bookings?bookingId=${b.id}`)}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> LOGEASI চ্যাট ও ম্যাপ
                            </button>
                            {waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                              >
                                কাস্টমার WhatsApp
                              </a>
                            )}
                            {b.customerEmail && (
                              <a
                                href={`mailto:${b.customerEmail}`}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                              >
                                ইমেইল
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={requestPayout} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-700" /> আয় উত্তোলনের অনুরোধ (অ্যাডমিন সমন্বিত)
              </h2>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                অ্যাডভান্স, বকেয়া ও রসিদ দেখুন →
              </button>
            </div>
            <p className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-2.5 leading-relaxed">
              কাস্টমারের সমস্ত পেমেন্ট অ্যাডমিন রিসিভ করেন। সেশন শেষে অ্যাডমিন আপনার WhatsApp নম্বরে যোগাযোগ করে সরাসরি অথবা bKash/Nagad-এ টাকা বুঝিয়ে দেবেন।
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                type="number"
                min={500}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(Number(e.target.value))}
                placeholder="পরিমাণ BDT"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <div className="flex items-center gap-2">
                <PaymentGatewayLogo gateway={payoutMethod} size="sm" />
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as any)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="bank_eft">Bank EFT</option>
                </select>
              </div>
              <input
                required
                type="text"
                value={payoutAccount}
                onChange={(e) => setPayoutAccount(e.target.value)}
                placeholder="ওয়ালেট / অ্যাকাউন্ট নম্বর"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Banknote className="w-4 h-4" /> পেআউট অনুরোধ পাঠান
            </button>

            {payouts.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <h3 className="text-xs font-semibold text-slate-600">পেআউট ইতিহাস</h3>
                {payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg">
                    <span className="uppercase font-medium inline-flex items-center gap-2">
                      <PaymentGatewayLogo gateway={p.method} size="xs" />
                      {p.method} ({p.accountMasked})
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatBdt(p.amountBdt)} · {p.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
