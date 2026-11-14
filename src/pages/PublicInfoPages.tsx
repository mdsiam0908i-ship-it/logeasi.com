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
import { DevicePhotoPicker } from '../components/DevicePhotoPicker.tsx';
import { BANGLADESH_DIVISIONS } from '../data/bangladeshRegions.ts';
import { apiRequest, setStoredSessionToken } from '../lib/api.ts';
import type { SupportTicketRecord } from '../types/logeasi.ts';

export function HowItWorksPage() {
  const { navigate } = useAuth();
  const steps = [
    {
      num: '01',
      title: 'Verify Your 18+ Account',
      desc: 'Register with Google, verified Bangladesh phone OTP, or email. Only adults aged 18+ may register, book, or offer services.',
    },
    {
      num: '02',
      title: 'Search & Compare Companions Across Bangladesh',
      desc: 'Filter verified Top 100 Bhai/Brother & companion profiles across all 8 Bangladesh Divisions (Dhaka, Chittagong, Sylhet, Rajshahi, Khulna, Barishal, Rangpur, Mymensingh) by area, rating, languages, and BDT rates.',
    },
    {
      num: '03',
      title: 'Request & Agree on Final Price',
      desc: 'Submit your public venue, date, and duration. The companion accepts or proposes an adjusted BDT quote. Both parties confirm before payment.',
    },
    {
      num: '04',
      title: 'Pay Securely via Verified Gateways',
      desc: 'Checkout with Personal bKash, Personal Nagad, Rocket, SSLCommerz, or permitted cash. Digital transactions are verified through server callbacks.',
    },
    {
      num: '05',
      title: 'Public Meetup, Completion & Review',
      desc: 'Meet strictly at public venues (cafés, corporate events, malls, cultural halls). Once completed, companion earnings release and you can submit a verified review.',
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="space-y-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 tracking-tight">
          How LOGEASI.COM Works
        </h1>
        <p className="text-base text-slate-600 max-w-2xl">
          A transparent, safe, Uber-inspired social companionship marketplace designed for verified adults across Bangladesh.
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
          Browse Companions
        </button>
        <button
          type="button"
          onClick={() => navigate('/safety')}
          className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg cursor-pointer"
        >
          Read Safety Standards
        </button>
      </div>
    </main>
  );
}

export function BecomeCompanionPage() {
  const { user, companionProfile, refreshSession, navigate } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || companionProfile?.displayName || '');
  const [accountEmail, setAccountEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1996-05-14');
  const [division, setDivision] = useState(companionProfile?.division || 'Dhaka');
  const [city, setCity] = useState(companionProfile?.city || 'Dhaka');
  const [headline, setHeadline] = useState(
    companionProfile?.headline || 'Verified Social Companion · Public Events & Everyday Assistance'
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
  const [adultConfirmed, setAdultConfirmed] = useState(Boolean(user));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFullName((prev) => prev || user.fullName);
      setAccountEmail((prev) => prev || user.email);
      setContactEmail((prev) => prev || companionProfile?.contactEmail || user.email);
      setWhatsappNumber((prev) => prev || companionProfile?.whatsappNumber || user.phone || '+88017');
      setPhotoUrl((prev) => prev || companionProfile?.photoUrl || user.photoUrl || '');
      setAdultConfirmed(true);
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

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!adultConfirmed) {
      setError('You must confirm you are aged 18+ to register as a companion.');
      return;
    }

    setBusy(true);
    try {
      if (!user) {
        const res = await apiRequest<{ user: any; sessionToken?: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: accountEmail,
            password,
            fullName,
            dateOfBirth,
            city,
            division,
            role: 'companion',
            phone: whatsappNumber,
            instagramHandle,
            whatsappNumber,
            contactEmail: contactEmail || accountEmail,
            headline,
            bio,
            hourlyRateBdt: Number(hourlyRateBdt),
            sessionRateBdt: Number(sessionRateBdt),
            photoUrl,
          }),
        });
        if (res.sessionToken) {
          setStoredSessionToken(res.sessionToken);
        }
        await refreshSession();
        setSuccess('Companion profile created! Redirecting to your Companion Dashboard...');
        setTimeout(() => navigate('/dashboard/companion'), 400);
      } else {
        await apiRequest('/api/companion/profile', {
          method: 'PUT',
          body: JSON.stringify({
            displayName: fullName,
            headline,
            bio,
            city,
            division,
            areas: [city === 'Dhaka' ? 'Gulshan' : city],
            languages: companionProfile?.languages || ['Bengali', 'English'],
            categories: companionProfile?.categories || ['Bhai / Brother Companion', 'Dining & Coffee'],
            hourlyRateBdt: Number(hourlyRateBdt),
            sessionRateBdt: Number(sessionRateBdt),
            availabilityDays: companionProfile?.availabilityDays || ['Fri', 'Sat', 'Sun'],
            availabilityHours: companionProfile?.availabilityHours || '10:00 AM – 9:00 PM',
            isAvailableNow: true,
            instagramHandle,
            whatsappNumber,
            contactEmail: contactEmail || user.email,
            photoUrl,
          }),
        });
        await refreshSession();
        setSuccess('Your companion profile, picture & Instagram/WhatsApp/Email channels have been saved!');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to save companion details.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="bg-slate-950 text-white rounded-2xl p-8 sm:p-12 hero-architectural-grid border border-slate-800 space-y-5">
        <p className="text-xs font-mono uppercase tracking-widest text-blue-400">
          COMPANION PARTNER STUDIO · ALL 8 BANGLADESH DIVISIONS
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance max-w-3xl">
          Offer Verified Social Companionship on Your Schedule
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          Set your own BDT hourly and session rates, attach your Instagram, WhatsApp, and public contact email, and manage bookings directly from your dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleOnboardingSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-950">
                {user ? 'Activate / Update Your Companion Profile' : 'Become a Companion (Direct Application)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Includes Instagram, WhatsApp, Contact Email & Custom BDT Rate controls
              </p>
            </div>
            {user && (
              <button
                type="button"
                onClick={() => navigate('/dashboard/companion')}
                className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Open Full Dashboard
              </button>
            )}
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
            label="Profile Picture (Select Directly from Device)"
            helperText="Pick a photo from your phone or computer — no URL needed."
            value={photoUrl}
            onChange={setPhotoUrl}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Display / Legal Name</label>
              <input
                required
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Tariq Mahmud (Bhai)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Bangladesh Division</label>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">District / Area</label>
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
              <label className="text-xs font-semibold text-slate-700">Hourly Rate (৳ BDT)</label>
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
              <label className="text-xs font-semibold text-slate-700">4-Hour Session (৳ BDT)</label>
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
              Companion Social & Direct Contact Options
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-blue-700" /> Instagram
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
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Number
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
                  <Mail className="w-3.5 h-3.5 text-blue-700" /> Contact Email
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
            <label className="text-xs font-semibold text-slate-700">Profile Headline</label>
            <input
              required
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Corporate Event, Travel & Public Dining Companion"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Short Biography</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your languages, background, and public venues you cover..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {!user && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Login Email</label>
                <input
                  required
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Password (8+ chars)</label>
                <input
                  required
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date of Birth (18+)</label>
                <input
                  required
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={adultConfirmed}
              onChange={(e) => setAdultConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I confirm I am aged 18+ and will offer strictly respectful, non-sexual public social companionship or permitted assistance.
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60"
          >
            {busy
              ? 'Saving Companion Profile...'
              : user
                ? 'Save & Activate Companion Profile'
                : 'Create Companion Account & Publish Profile'}
          </button>
        </form>

        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-blue-700" />
            <h3 className="font-display text-base font-bold text-slate-950">Full Rate & Schedule Autonomy</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Configure custom BDT hourly and 4-hour session rates, and counter-propose pricing before accepting any booking.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5 shadow-sm">
            <Shield className="w-5 h-5 text-blue-700" />
            <h3 className="font-display text-base font-bold text-slate-950">Verified 18+ NID Protection</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Submit your NID or Passport inside your Companion Dashboard for official Verification Admin approval.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-2.5 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h3 className="font-display text-base font-bold text-slate-950">Fast bKash & Nagad Payouts</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Withdraw completed session earnings directly to bKash, Nagad, Rocket, or local bank EFT after finance review.
            </p>
          </div>
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
      setNotice('Support ticket created. Our support team will respond shortly.');
      loadTickets();
    } catch (err: any) {
      setNotice(err.message || 'Unable to submit ticket.');
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight flex items-center gap-2.5">
          <HelpCircle className="w-7 h-7 text-blue-700" />
          Help Center & Support Tickets
        </h1>
        <p className="text-sm text-slate-600">
          Resolve booking disputes, payment inquiries, refund requests, or safety concerns.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold text-slate-950">Submit a Support Ticket</h2>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="account_help">Account & Verification Help</option>
              <option value="booking_dispute">Booking Dispute</option>
              <option value="payment_complaint">Payment / Gateway Complaint</option>
              <option value="refund_request">Refund Request</option>
              <option value="safety_report">Safety Report</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Booking ID (Optional)</label>
            <input
              type="text"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="e.g. BKG_..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Subject</label>
            <input
              required
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your request"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Details</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide booking code, transaction ID, or details..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            {user ? 'Create Support Ticket' : 'Sign In to Submit Ticket'}
          </button>
          {notice && <p className="text-xs text-blue-700 font-medium">{notice}</p>}
        </form>

        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-slate-950">Your Support Tickets</h2>
            {!user ? (
              <p className="text-sm text-slate-500">Sign in to view your support history and admin replies.</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-slate-500">You have no open or past support tickets.</p>
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
                        <span className="font-semibold">Support Response:</span> {t.adminReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
          Safety Center & Community Standards
        </h1>
        <p className="text-sm text-slate-600">
          LOGEASI.COM enforces strict non-sexual, adult-only (18+) public social companionship standards across Bangladesh.
        </p>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-red-900 flex items-center gap-2">
            <PhoneCall className="w-4 h-4" /> Immediate Emergency Helplines (Bangladesh)
          </p>
          <p className="text-xs text-red-800">
            {platformPublic.safetyNotice ||
              'Dial 999 for National Emergency Police/Ambulance · Dial 109 for National Helpline for Women & Children.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/help')}
          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer"
        >
          File Safety Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">01. Public Venues Only</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            All bookings must occur in reputable public locations (hotels, coffee shops, event halls, hospitals, shopping centers). Private residential meetups are prohibited.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">02. Zero-Tolerance Non-Sexual Policy</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Any solicitation, harassment, or request for sexual services triggers immediate account suspension and permanent reporting to Trust & Safety.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">03. 18+ Identity Verification</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Every companion verification submission checks government-issued NID or Passport age (18+) and is manually approved by a Verification Admin.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-950">04. Instant Report & Block</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            You can report and block any user directly from their profile or booking thread. Blocked profiles are immediately hidden from your directory view.
          </p>
        </div>
      </div>
    </main>
  );
}

export function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950">Privacy Policy</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
        <p><strong>1. PII Isolation & Data Protection:</strong> LOGEASI.COM isolates private personal data (date of birth, hashed credentials, encrypted 2FA secrets, masked ID references) inside protected server-only subcollections that are never exposed to public endpoints or unauthorized users.</p>
        <p><strong>2. Payment Credential Zero-Storage Guarantee:</strong> We never collect, transmit, or store credit/debit card numbers, CVVs, mobile financial service PINs (bKash/Nagad/Rocket), or banking passwords. All digital checkouts route through hosted payment sessions verified via HMAC-SHA256 server webhooks.</p>
        <p><strong>3. Administrative Access Controls:</strong> Administrators cannot view user passwords, OTPs, or payment credentials. Every sensitive administrative action is logged to an immutable security audit trail.</p>
        <p><strong>4. Data Retention & Recovery:</strong> Users may manage their profiles, blocklist, and emergency contacts at any time from their personal dashboard.</p>
      </div>
    </main>
  );
}

export function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-950">Terms & Conditions</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
        <p><strong>1. Adult Eligibility (18+):</strong> By creating an account or booking on LOGEASI.COM, you certify that you are at least 18 years of age.</p>
        <p><strong>2. Permitted Services Only:</strong> LOGEASI.COM is strictly a social companionship, public event accompaniment, cultural outing, and everyday assistance marketplace. Sexual, romantic escorting, or unlawful services are strictly prohibited.</p>
        <p><strong>3. Pricing, Fees & Escrow:</strong> All listed prices are in Bangladeshi Taka (BDT ৳). Both customer and companion must agree on the final booking price prior to checkout. A transparent platform service fee is deducted upon settlement.</p>
        <p><strong>4. Cancellations & Refunds:</strong> Paid bookings cancelled prior to meetup completion automatically generate a refund review record handled by Finance/Support Administrators.</p>
      </div>
    </main>
  );
}
