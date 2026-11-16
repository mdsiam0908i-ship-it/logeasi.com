import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  Instagram,
  Mail,
  MessageCircle,
  PhoneCall,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DeveloperBanner } from '../components/DeveloperBanner.tsx';
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
import { apiRequest } from '../lib/api.ts';
import type { CompanionApplicationRecord, SupportTicketRecord } from '../types/logeasi.ts';

export function HowItWorksPage() {
  const { navigate } = useAuth();
  const steps = [
    {
      num: '০১',
      title: 'আপনার ১৮+ অ্যাকাউন্ট যাচাই করুন',
      desc: 'Google, বাংলাদেশি ফোন OTP অথবা ইমেইল দিয়ে নিবন্ধন করুন। শুধুমাত্র ১৮ বছর বা তার বেশি বয়সী প্রাপ্তবয়স্করা বুকিং বা সঙ্গী সেবা দিতে পারবেন।',
    },
    {
      num: '০২',
      title: 'বাংলাদেশের সব বিভাগে সঙ্গী খুঁজুন ও তুলনা করুন',
      desc: 'ঢাকা, চট্টগ্রাম, সিলেট, রাজশাহী, খুলনা, বরিশাল, রংপুর ও ময়মনসিংহ—এই ৮টি বিভাগের সেরা ১০০ ভাই/বন্ধু ও সঙ্গী প্রোফাইল এলাকা, রেটিং, ভাষা ও BDT রেট অনুযায়ী ফিল্টার করুন।',
    },
    {
      num: '০৩',
      title: 'বুকিং অনুরোধ ও চূড়ান্ত মূল্য সম্মতি',
      desc: 'পাবলিক ভেন্যু, তারিখ ও সময়সীমা দিয়ে অনুরোধ পাঠান। সঙ্গী প্রোফাইল প্রস্তাব গ্রহণ করলে বা নতুন BDT কোট দিলে উভয় পক্ষের সম্মতির পর পেমেন্ট আনলক হবে।',
    },
    {
      num: '০৪',
      title: 'যাচাইকৃত মাধ্যমে নিরাপদ পেমেন্ট',
      desc: 'পার্সোনাল bKash, পার্সোনাল Nagad, Rocket, SSLCommerz বা অনুমোদিত ক্যাশের মাধ্যমে পেমেন্ট সম্পন্ন করুন। প্রতিটি অনলাইন লেনদেন সার্ভার-স্বাক্ষরিতভাবে যাচাই করা হয়।',
    },
    {
      num: '০৫',
      title: 'পাবলিক স্থানে সাক্ষাৎ, সমাপ্তি ও রিভিউ',
      desc: 'সর্বদা রেস্তোরাঁ, টং চা স্টল, শপিং মল, কর্পোরেট ইভেন্ট বা পাবলিক স্থানে দেখা করুন। সেশন শেষে সঙ্গীর আয় রিলিজ হয় এবং আপনি যাচাইকৃত রিভিউ দিতে পারেন।',
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">
          LOGEASI.COM কীভাবে কাজ করে
        </h1>
        <p className="text-base text-slate-600 max-w-2xl">
          বাংলাদেশের প্রাপ্তবয়স্ক (১৮+) ব্যবহারকারীদের জন্য একটি স্বচ্ছ, নিরাপদ ও নির্ভরযোগ্য সামাজিক সঙ্গী মার্কেটপ্লেস।
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 shadow-sm">
        {steps.map((s) => (
          <div key={s.num} className="p-6 sm:p-8 flex flex-col sm:flex-row gap-4 sm:gap-8">
            <span className="font-mono text-lg font-bold text-blue-700 shrink-0">{s.num}</span>
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-semibold text-slate-950">{s.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
        >
          সঙ্গী খুঁজুন
        </button>
        <button
          type="button"
          onClick={() => navigate('/safety')}
          className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg cursor-pointer"
        >
          নিরাপত্তা নীতিমালা পড়ুন
        </button>
      </div>

      <DeveloperBanner variant="card" />
    </main>
  );
}

export function BecomeCompanionPage() {
  const { user, companionProfile, navigate } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || companionProfile?.displayName || '');
  const [dateOfBirth, setDateOfBirth] = useState('1996-05-14');
  const [division, setDivision] = useState(companionProfile?.division || 'Dhaka');
  const [city, setCity] = useState(companionProfile?.city || 'Dhaka');
  const [gender, setGender] = useState<'male' | 'female'>(
    companionProfile?.gender || user?.gender || 'male'
  );
  const [headline, setHeadline] = useState(
    companionProfile?.headline || 'যাচাইকৃত সামাজিক সঙ্গী · আড্ডা, ভ্রমণ ও দৈনন্দিন সহায়তা'
  );
  const [bio, setBio] = useState(companionProfile?.bio || '');
  const [hourlyRateBdt, setHourlyRateBdt] = useState(companionProfile?.hourlyRateBdt || 1500);
  const [sessionRateBdt, setSessionRateBdt] = useState(companionProfile?.sessionRateBdt || 4200);
  const [instagramHandle, setInstagramHandle] = useState(companionProfile?.instagramHandle || '');
  const [whatsappNumber, setWhatsappNumber] = useState(
    companionProfile?.whatsappNumber || user?.phone || '+88017'
  );
  const [contactEmail, setContactEmail] = useState(
    companionProfile?.contactEmail || user?.email || ''
  );
  const [photoUrl, setPhotoUrl] = useState(
    companionProfile?.photoUrl || user?.photoUrl || ''
  );
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedApp, setSubmittedApp] = useState<CompanionApplicationRecord | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.fullName);
      setContactEmail((prev) => prev || companionProfile?.contactEmail || user.email);
      setWhatsappNumber((prev) => prev || companionProfile?.whatsappNumber || user.phone || '+88017');
      setPhotoUrl((prev) => prev || companionProfile?.photoUrl || user.photoUrl || '');
    }
    if (companionProfile) {
      setDivision(companionProfile.division || 'Dhaka');
      setCity(companionProfile.city || 'Dhaka');
      setHeadline(companionProfile.headline || '');
      setBio(companionProfile.bio || '');
      setHourlyRateBdt(companionProfile.hourlyRateBdt || 1500);
      setSessionRateBdt(companionProfile.sessionRateBdt || 4200);
      setInstagramHandle(companionProfile.instagramHandle || '');
      if (companionProfile.photoUrl) setPhotoUrl(companionProfile.photoUrl);
    }
  }, [user, companionProfile]);

  const activeDivisionObj =
    BANGLADESH_DIVISIONS.find((d) => d.id === division) || BANGLADESH_DIVISIONS[0];

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!adultConfirmed) {
      setError('সঙ্গী হওয়ার আবেদন করতে আপনার বয়স ১৮+ হওয়া নিশ্চিত করতে হবে।');
      return;
    }

    setBusy(true);
    try {
      const res = await apiRequest<{ application: CompanionApplicationRecord; message: string }>(
        '/api/companion-applications',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            whatsappNumber,
            contactEmail,
            city,
            division,
            gender,
            dateOfBirth,
            hourlyRateBdt: Number(hourlyRateBdt),
            sessionRateBdt: Number(sessionRateBdt),
            headline,
            bio,
            instagramHandle,
            photoUrl,
          }),
        }
      );
      setSubmittedApp(res.application);
      setSuccess(
        res.message ||
          'আপনার আবেদন অ্যাডমিনের কাছে জমা হয়েছে! অ্যাডমিন যাচাই করে WhatsApp-এ আপনার ইমেইল ও পাসওয়ার্ড তৈরি করে বুঝিয়ে দেবেন।'
      );
    } catch (err: any) {
      setError(err.message || 'সঙ্গী আবেদন জমা দেওয়া যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="bg-slate-950 text-white rounded-2xl p-8 sm:p-12 hero-architectural-grid border border-slate-800 space-y-5">
        <p className="text-xs font-mono uppercase tracking-widest text-blue-400">
          সঙ্গী আবেদন ও অ্যাডমিন অনুমোদন ডেস্ক · বাংলাদেশের ৮টি বিভাগ
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance max-w-3xl">
          সঙ্গী হওয়ার আবেদন জমা দিন — অ্যাডমিন যাচাই করে অ্যাকাউন্ট বুঝিয়ে দেবেন
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          নিরাপত্তা ও গুণগত মান নিশ্চিত করতে সরাসরি সঙ্গী অ্যাকাউন্ট খোলা যায় না। নিচের ফর্মে আপনার সঠিক WhatsApp নম্বর ও তথ্য দিন — অ্যাডমিন অনুমোদন করে WhatsApp-এ যোগাযোগের পর আপনার ইমেইল ও পাসওয়ার্ড তৈরি করে দেবেন।
        </p>
        {user?.role === 'companion' && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard/companion')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              আপনার অনুমোদিত সঙ্গী ড্যাশবোর্ডে যান →
            </button>
          </div>
        )}
      </div>

      {submittedApp && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-emerald-950 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" /> আবেদন সফলভাবে অ্যাডমিনের কাছে জমা হয়েছে!
            </h2>
            <span className="font-mono text-xs font-bold text-emerald-800 bg-white border border-emerald-300 px-3 py-1 rounded-lg">
              আবেদন আইডি: {submittedApp.id}
            </span>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            আবেদনকারী: <strong>{submittedApp.fullName}</strong> · WhatsApp: <strong className="font-mono">{submittedApp.whatsappNumber}</strong> · এলাকা: <strong>{submittedApp.city}</strong>।
            অ্যাডমিন আপনার আবেদন অনুমোদন করে আপনার WhatsApp নম্বরে যোগাযোগ করে একটি ইমেইল ও পাসওয়ার্ড তৈরি করে বুঝিয়ে দেবেন। এরপর লগইন পেজ থেকে প্রবেশ করে আপনার বিষয়ে পোস্ট করতে ও বুকিং গ্রহণ করতে পারবেন।
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleApplicationSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-950">
                নতুন সঙ্গী হওয়ার আবেদন ফর্ম
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                অ্যাডমিন অনুমোদন ও WhatsApp-এ লগইন তথ্য হস্তান্তরের জন্য সঠিক তথ্য দিন
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/auth?mode=companion')}
              className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              আগেই অ্যাকাউন্ট পেয়েছেন? লগইন করুন
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
              {success}
            </div>
          )}

          <DevicePhotoPicker
            label="প্রোফাইল ছবি (সরাসরি ডিভাইস থেকে দিন)"
            helperText="ফোন গ্যালারি বা কম্পিউটার থেকে সরাসরি ছবি বাছাই করুন — কোনো URL লাগবে না।"
            value={photoUrl}
            onChange={setPhotoUrl}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">প্রদর্শিত / পূর্ণ নাম</label>
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="যেমন: তারেক মাহমুদ (ভাই)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
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
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                মেয়ে / নারী
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">জেলা / এলাকা</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {Array.from(new Set([...activeDivisionObj.districts, ...activeDivisionObj.metroAreas])).map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">ঘণ্টাপ্রতি রেট (৳ BDT)</label>
              <input
                required
                type="number"
                min={500}
                value={hourlyRateBdt}
                onChange={(e) => setHourlyRateBdt(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">৪-ঘণ্টা সেশন (৳ BDT)</label>
              <input
                required
                type="number"
                min={1000}
                value={sessionRateBdt}
                onChange={(e) => setSessionRateBdt(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          {/* Instagram, WhatsApp & Public Contact Email */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-xs font-bold text-slate-900">
              সঙ্গীর সরাসরি যোগাযোগ ও সোশ্যাল মাধ্যম
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-blue-700" /> ইনস্টাগ্রাম
                </label>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@your_instagram"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> হোয়াটসঅ্যাপ নম্বর
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+8801712345678"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-700" /> যোগাযোগের ইমেইল
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="companion@email.com"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">প্রোফাইল শিরোনাম</label>
            <input
              required
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="যেমন: আড্ডা, শহর ভ্রমণ, কফি ও পাবলিক ইভেন্ট সঙ্গী"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">সংক্ষিপ্ত পরিচিতি</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="আপনার ভাষা, অভিজ্ঞতা এবং কোন কোন এলাকায় সময় দিতে পারবেন তা লিখুন..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">জন্ম তারিখ (১৮+ বয়স যাচাইয়ের জন্য বাধ্যতামূলক)</label>
              <input
                required
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">WhatsApp নম্বর নিশ্চিত করুন (অ্যাডমিন যোগাযোগ করবেন)</label>
              <input
                required
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+8801712345678"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={adultConfirmed}
              onChange={(e) => setAdultConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              আমি নিশ্চিত করছি যে আমার বয়স ১৮+ এবং অ্যাডমিন আবেদন অনুমোদন করে WhatsApp-এ আমার ইমেইল ও পাসওয়ার্ড তৈরি করে দিলে তবেই আমার সঙ্গী অ্যাকাউন্ট চালু হবে।
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy ? 'আবেদন জমা হচ্ছে...' : 'অ্যাডমিনের কাছে সঙ্গী আবেদন জমা দিন'}
          </button>
        </form>

        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-blue-700" />
            <h3 className="font-display text-base font-bold text-slate-950">১. আবেদন জমা ও WhatsApp-এ অ্যাডমিন যোগাযোগ</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              আবেদন জমা দেওয়ার পর অ্যাডমিন আপনার তথ্য যাচাই করবেন এবং আপনার WhatsApp নম্বরে যোগাযোগ করে একটি ইমেইল ও পাসওয়ার্ড তৈরি করে বুঝিয়ে দেবেন।
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5 shadow-sm">
            <Shield className="w-5 h-5 text-blue-700" />
            <h3 className="font-display text-base font-bold text-slate-950">২. নিজের পোস্ট প্রকাশ ও বুকিং পরিচালনা</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              অ্যাকাউন্ট বুঝে পাওয়ার পর প্রোফাইলে নিজের বিষয়ে পোস্ট লিখতে পারবেন, বুকিং দেখে লোকেশনে রওনা দিতে পারবেন এবং গ্রাহকের সাথে নিরাপদ কনভারসেশন করতে পারবেন।
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h3 className="font-display text-base font-bold text-slate-950">৩. অ্যাডমিন কর্তৃক পেমেন্ট রিসিভ ও WhatsApp হস্তান্তর</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              গ্রাহকের সমস্ত পেমেন্ট অ্যাডমিন রিসিভ করবেন। সেশন শেষে অ্যাডমিন আপনার পাওনা টাকা WhatsApp বা bKash/Nagad-এ যোগাযোগ করে সরাসরি বুঝিয়ে দেবেন।
            </p>
          </div>
          <DeveloperBanner variant="card" />
        </div>
      </div>
    </main>
  );
}

export function HelpCenterPage() {
  const { user, navigate } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [category, setCategory] = useState('account_help');
  const [bookingId, setBookingId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('');

  const loadTickets = () => {
    if (!user) return;
    apiRequest<{ tickets: SupportTicketRecord[] }>('/api/support/tickets')
      .then((res) => setTickets(res.tickets || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    setNotice('');
    try {
      await apiRequest('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ category, bookingId, subject, description }),
      });
      setSubject('');
      setDescription('');
      setBookingId('');
      setNotice('সাপোর্ট টিকিট তৈরি হয়েছে। আমাদের সাপোর্ট টিম দ্রুত উত্তর দেবে।');
      loadTickets();
    } catch (err: any) {
      setNotice(err.message || 'টিকিট পাঠানো যায়নি।');
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight flex items-center gap-2.5">
          <HelpCircle className="w-7 h-7 text-blue-700" />
          সহায়তা কেন্দ্র ও সাপোর্ট টিকিট
        </h1>
        <p className="text-sm text-slate-600">
          বুকিং সংক্রান্ত সমস্যা, পেমেন্ট জিজ্ঞাসা, রিফান্ড অনুরোধ বা নিরাপত্তা অভিযোগ জানান।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold text-slate-950">সাপোর্ট টিকিট পাঠান</h2>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">সমস্যার ধরন</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="account_help">অ্যাকাউন্ট ও ভেরিফিকেশন সহায়তা</option>
              <option value="booking_dispute">বুকিং সংক্রান্ত সমস্যা</option>
              <option value="payment_complaint">পেমেন্ট / গেটওয়ে অভিযোগ</option>
              <option value="refund_request">রিফান্ড অনুরোধ</option>
              <option value="safety_report">নিরাপত্তা রিপোর্ট</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">বুকিং আইডি (ঐচ্ছিক)</label>
            <input
              type="text"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="যেমন: BKG_..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">বিষয়</label>
            <input
              required
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="আপনার অনুরোধের সংক্ষিপ্ত শিরোনাম"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">বিস্তারিত বিবরণ</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="বুকিং কোড, TrxID বা বিস্তারিত তথ্য লিখুন..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            {user ? 'সাপোর্ট টিকিট জমা দিন' : 'টিকিট পাঠাতে সাইন ইন করুন'}
          </button>
          {notice && <p className="text-xs text-blue-700 font-medium">{notice}</p>}
        </form>

        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-slate-950">আপনার সাপোর্ট টিকিটসমূহ</h2>
            {!user ? (
              <p className="text-sm text-slate-500">সাপোর্ট ইতিহাস ও অ্যাডমিনের উত্তর দেখতে সাইন ইন করুন।</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500">আপনার কোনো সাপোর্ট টিকিট নেই।</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <div key={t.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-900">{t.ticketCode}</span>
                      <span className="capitalize font-medium text-blue-700">{t.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{t.subject}</p>
                    <p className="text-xs text-slate-600">{t.description}</p>
                    {t.adminReply && (
                      <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800">
                        <span className="font-semibold">সাপোর্ট উত্তর:</span> {t.adminReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DeveloperBanner variant="card" />
        </div>
      </div>
    </main>
  );
}

export function SafetyCenterPage() {
  const { platformPublic, navigate } = useAuth();
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight">
          নিরাপত্তা কেন্দ্র ও কমিউনিটি নীতিমালা
        </h1>
        <p className="text-sm text-slate-600">
          LOGEASI.COM বাংলাদেশে শুধুমাত্র ১৮+ প্রাপ্তবয়স্কদের জন্য মার্জিত, অহিংস ও আইনসম্মত পাবলিক সামাজিক সঙ্গী সেবা নিশ্চিত করে।
        </p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-red-900 flex items-center gap-2">
            <PhoneCall className="w-4 h-4" /> জরুরি হেল্পলাইন (বাংলাদেশ)
          </p>
          <p className="text-xs text-red-800">
            {platformPublic.safetyNotice ||
              'জাতীয় জরুরি সেবা ৯৯৯ (পুলিশ/অ্যাম্বুলেন্স) · নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন ১০৯।'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/help')}
          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
        >
          নিরাপত্তা রিপোর্ট করুন
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">০১. শুধুমাত্র পাবলিক স্থান</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            সব বুকিং অবশ্যই পাবলিক স্থানে (ক্যাফে, টং চা স্টল, হোটেল, ইভেন্ট হল, হাসপাতাল, শপিং মল) হতে হবে। ব্যক্তিগত বাসাবাড়িতে সাক্ষাৎ সম্পূর্ণ নিষিদ্ধ।
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">০২. সহিংসতা ও অনৈতিক কাজে জিরো-টলারেন্স</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            মারামারি, হুমকি, মাদক, অশ্লীল প্রস্তাব বা বেআইনি কাজের যেকোনো অনুরোধ করলে তাৎক্ষণিক অ্যাকাউন্ট স্থগিত ও স্থায়ীভাবে ব্যান করা হয়।
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">০৩. ১৮+ পরিচয় যাচাই</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            সঙ্গীদের জমা দেওয়া NID, স্কুল রোল বা পাসপোর্ট তথ্য ভেরিফিকেশন অ্যাডমিন দ্বারা ম্যানুয়ালি যাচাই ও অনুমোদন করা হয়।
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">০৪. তাৎক্ষণিক রিপোর্ট ও ব্লক</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            যেকোনো প্রোফাইল বা বুকিং থ্রেড থেকে সরাসরি রিপোর্ট ও ব্লক করতে পারবেন। ব্লক করা প্রোফাইল আপনার তালিকা থেকে সাথে সাথেই সরে যাবে।
          </p>
        </div>
      </div>

      <DeveloperBanner variant="card" />
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950">গোপনীয়তা নীতি (Privacy Policy)</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
        <p><strong>১. ব্যক্তিগত তথ্যের সুরক্ষা:</strong> LOGEASI.COM আপনার জন্ম তারিখ, হ্যাশকৃত পাসওয়ার্ড, 2FA সিক্রেট ও পরিচয়পত্রের তথ্য নিরাপদ সার্ভার সাবকালেকশনে সংরক্ষণ করে, যা কখনোই পাবলিক এন্ডপয়েন্টে উন্মুক্ত করা হয় না।</p>
        <p><strong>২. পেমেন্ট তথ্যের শূন্য-সংরক্ষণ নীতি:</strong> আমরা কখনোই কার্ড নম্বর, CVV বা বিকাশ/নগদ/রকেট PIN সংগ্রহ বা সংরক্ষণ করি না। ডিজিটাল পেমেন্ট HMAC-SHA256 স্বাক্ষরিত ওয়েবহুক বা TrxID যাচাইয়ের মাধ্যমে সম্পন্ন হয়।</p>
        <p><strong>৩. প্রশাসনিক নিয়ন্ত্রণ ও অডিট:</strong> কোনো অ্যাডমিন ব্যবহারকারীর পাসওয়ার্ড, OTP বা পেমেন্ট পিন দেখতে পারেন না। প্রতিটি গুরুত্বপূর্ণ প্রশাসনিক কাজ অডিট লগে সংরক্ষিত থাকে।</p>
        <p><strong>৪. তথ্য নিয়ন্ত্রণ:</strong> ব্যবহারকারীরা যেকোনো সময় ড্যাশবোর্ড থেকে তাদের প্রোফাইল, ব্লকলিস্ট ও জরুরি যোগাযোগের তথ্য পরিবর্তন করতে পারবেন।</p>
        <p><strong>৫. লাইভ লোকেশন ও Google Maps গোপনীয়তা:</strong> লাইভ GPS লোকেশন শেয়ারিং শুধুমাত্র ব্যবহারকারীর সুস্পষ্ট সম্মতিতে চালু হয় এবং যেকোনো সময় &ldquo;লোকেশন বন্ধ করুন&rdquo; বাটনের মাধ্যমে তাৎক্ষণিক বাতিলযোগ্য। Google Maps ব্যবহারের ক্ষেত্রে{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">Google Privacy Policy</a> প্রযোজ্য।
        </p>
      </div>
    </main>
  );
}

export function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950">শর্তাবলী (Terms & Conditions)</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
        <p><strong>১. প্রাপ্তবয়স্ক যোগ্যতা (১৮+):</strong> LOGEASI.COM-এ অ্যাকাউন্ট তৈরি বা বুকিং করার মাধ্যমে আপনি নিশ্চিত করছেন যে আপনার বয়স কমপক্ষে ১৮ বছর।</p>
        <p><strong>২. শুধুমাত্র আইনসম্মত ও অহিংস সেবা:</strong> LOGEASI.COM শুধুমাত্র সামাজিক আড্ডা, ঘোরাফেরা, পাবলিক ইভেন্ট ও দৈনন্দিন সহায়তার প্ল্যাটফর্ম। মারামারি, মাদক, হুমকি বা অনৈতিক কোনো কাজ সম্পূর্ণ নিষিদ্ধ।</p>
        <p><strong>৩. মূল্য, ফি ও এস্ক্রো:</strong> সকল মূল্য বাংলাদেশি টাকায় (BDT ৳) নির্ধারিত। পেমেন্টের আগে কাস্টমার ও সঙ্গী উভয়ের চূড়ান্ত মূল্যে সম্মতি প্রয়োজন।</p>
        <p><strong>৪. বাতিল ও রিফান্ড:</strong> সেশন সম্পন্ন হওয়ার আগে পরিশোধিত বুকিং বাতিল হলে ফিন্যান্স ও সাপোর্ট অ্যাডমিনের রিভিউয়ের জন্য স্বয়ংক্রিয়ভাবে রিফান্ড অনুরোধ তৈরি হয়।</p>
        <p><strong>৫. Google Maps Platform ব্যবহারের শর্তাবলী:</strong> এই ওয়েবসাইটে মিটআপ লোকেশন সমন্বয়ের জন্য Google Maps ফিচার সংযুক্ত রয়েছে, যা{' '}
          <a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">Google Maps/Google Earth Additional Terms of Service</a>-এর অধীন।
        </p>
      </div>
    </main>
  );
}
