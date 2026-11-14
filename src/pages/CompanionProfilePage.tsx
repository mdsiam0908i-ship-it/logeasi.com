import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Flag,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, formatBdt } from '../lib/api.ts';
import type { CompanionProfile, ReviewRecord } from '../types/logeasi.ts';

function formatInstagramHref(handle: string): string {
  const clean = handle.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://instagram.com/${clean.replace(/^@/, '')}`;
}

function formatWhatsappHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}`;
}

export function CompanionProfilePage({ companionUid }: { companionUid: string }) {
  const { user, navigate } = useAuth();
  const [companion, setCompanion] = useState<CompanionProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [blockAlso, setBlockAlso] = useState(true);
  const [reportStatus, setReportStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    apiRequest<{ companion: CompanionProfile; reviews: ReviewRecord[] }>(
      `/api/companions/${companionUid}`
    )
      .then((res) => {
        setCompanion(res.companion);
        setReviews(res.reviews || []);
      })
      .catch((err) => setError(err.message || 'Profile unavailable'))
      .finally(() => setLoading(false));
  }, [companionUid]);

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUid: companionUid,
          reason: reportReason,
          blockUser: blockAlso,
        }),
      });
      setReportStatus('Report submitted to Trust & Safety. If blocked, this profile is now hidden for you.');
      setReportReason('');
    } catch (err: any) {
      setReportStatus(err.message || 'Unable to submit report.');
    }
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (error || !companion) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-lg font-semibold text-slate-900">{error || 'Companion not found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold cursor-pointer"
        >
          Back to Explore
        </button>
      </main>
    );
  }

  const hasChannels = Boolean(
    companion.instagramHandle || companion.whatsappNumber || companion.contactEmail
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        type="button"
        onClick={() => navigate('/explore')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Explore Companions
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Portrait & Pricing Box */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="aspect-[3/4] bg-slate-100">
              {companion.photoUrl ? (
                <img
                  src={companion.photoUrl}
                  alt={companion.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                  <User className="w-16 h-16 text-blue-300" />
                </div>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="text-xs text-slate-500">Hourly Rate</p>
                  <p className="font-mono text-2xl font-bold text-slate-950 tabular-nums">
                    {formatBdt(companion.hourlyRateBdt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">4-Hour Session</p>
                  <p className="font-mono text-lg font-semibold text-slate-800 tabular-nums">
                    {formatBdt(companion.sessionRateBdt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/booking/checkout/${companion.uid}`)}
                className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Request Booking
              </button>

              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" /> Report or Block Profile
              </button>
            </div>
          </div>

          {reportOpen && (
            <form
              onSubmit={submitReport}
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold text-slate-900">Safety Report & Block</h3>
              <textarea
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
                placeholder="Describe policy violation or safety concern..."
                className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-blue-600"
              />
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={blockAlso}
                  onChange={(e) => setBlockAlso(e.target.checked)}
                />
                Block this user from my directory
              </label>
              <button
                type="submit"
                className="w-full py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Submit Safety Report
              </button>
              {reportStatus && <p className="text-xs text-blue-700">{reportStatus}</p>}
            </form>
          )}
        </div>

        {/* Right: Bio, Categories, Direct Social Channels, Availability, Reviews */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-2 border-b border-slate-100 pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {companion.verificationStatus === 'approved' ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                    <ShieldCheck className="w-4 h-4" /> 18+ Identity Verified
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">
                    Verification Status: {companion.verificationStatus}
                  </span>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {companion.ratingAvg > 0 ? `${companion.ratingAvg.toFixed(1)} (${companion.reviewCount} reviews)` : 'New Companion'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{companion.completedBookings} completed sessions</span>
              </div>

              <h1 className="font-display text-3xl font-bold text-slate-950 tracking-tight">
                {companion.displayName}
              </h1>
              <p className="text-base text-slate-700">{companion.headline}</p>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-base font-semibold text-slate-950">About</h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {companion.bio || 'Verified adult companion offering respectful, non-sexual social companionship in public spaces.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100 text-sm">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Service Locations
                </p>
                <p className="text-slate-900 font-medium">
                  {companion.division ? `${companion.division} Division · ` : ''}
                  {companion.city} — {(companion.areas || []).join(', ')}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Languages Spoken
                </p>
                <p className="text-slate-900 font-medium">{(companion.languages || []).join(' · ')}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500">Service Categories</p>
                <p className="text-slate-900">{(companion.categories || []).join(' · ')}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Availability Schedule
                </p>
                <p className="text-slate-900">
                  {(companion.availabilityDays || []).join(', ')} · {companion.availabilityHours}
                </p>
              </div>
            </div>

            {hasChannels && (
              <div className="pt-5 border-t border-slate-100 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Social & Direct Contact Channels
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {companion.instagramHandle && (
                    <a
                      href={formatInstagramHref(companion.instagramHandle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                    >
                      <Instagram className="w-4 h-4 text-blue-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">Instagram</p>
                        <p className="font-semibold text-slate-950 truncate">{companion.instagramHandle}</p>
                      </div>
                    </a>
                  )}
                  {companion.whatsappNumber && (
                    <a
                      href={formatWhatsappHref(companion.whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">WhatsApp</p>
                        <p className="font-mono font-semibold text-slate-950 truncate">{companion.whatsappNumber}</p>
                      </div>
                    </a>
                  )}
                  {companion.contactEmail && (
                    <a
                      href={`mailto:${companion.contactEmail}`}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-blue-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">Contact Email</p>
                        <p className="font-semibold text-slate-950 truncate">{companion.contactEmail}</p>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Verified Reviews */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-slate-950">
              Verified Customer Reviews ({reviews.length})
            </h2>

            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No verified reviews yet. Only customers with completed bookings can leave a review.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {reviews.map((rev) => (
                  <div key={rev.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900">{rev.customerName}</span>
                      <span className="font-mono text-amber-600 tabular-nums">
                        {'★'.repeat(rev.rating)} ({rev.rating}/5)
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{rev.comment}</p>
                    <p className="text-[11px] font-mono text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString('en-BD')}
                    </p>
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
