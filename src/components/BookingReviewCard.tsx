import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, Star } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import type { BookingRecord, ReviewRecord } from '../types/logeasi.ts';

const REVIEW_HIGHLIGHT_TAGS = [
  'সময়নিষ্ঠ',
  'ভদ্র ব্যবহার',
  'নিরাপদ আড্ডা',
  'দারুণ কথাবার্তা',
  'বিশ্বস্ত ও পেশাদার',
];

const RATING_LABELS: Record<number, string> = {
  1: '১/৫ · অসন্তোষজনক',
  2: '২/৫ · মোটামুটি',
  3: '৩/৫ · ভালো',
  4: '৪/৫ · চমৎকার',
  5: '৫/৫ · অসাধারণ অভিজ্ঞতা',
};

interface BookingReviewCardProps {
  booking: BookingRecord;
  existingReview?: ReviewRecord | null;
  onReviewSubmitted?: (review: ReviewRecord) => void;
  onViewCompanion?: (companionUid: string) => void;
}

export function BookingReviewCard({
  booking,
  existingReview,
  onReviewSubmitted,
  onViewCompanion,
}: BookingReviewCardProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (existingReview) {
    return (
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>আপনার যাচাইকৃত রিভিউ প্রকাশিত হয়েছে</span>
          </div>
          <span className="font-mono text-xs font-bold text-amber-700 tabular-nums">
            {'★'.repeat(existingReview.rating)}
            {'☆'.repeat(Math.max(0, 5 - existingReview.rating))} ({existingReview.rating}/৫)
          </span>
        </div>

        <p className="text-xs text-slate-800 leading-relaxed">{existingReview.comment}</p>

        {existingReview.tags && existingReview.tags.length > 0 && (
          <p className="text-[11px] font-medium text-emerald-800">
            বৈশিষ্ট্য: {existingReview.tags.join(' · ')}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
          <span className="font-mono tabular-nums">
            বুকিং {booking.bookingCode} · {new Date(existingReview.createdAt).toLocaleDateString('bn-BD')}
          </span>
          {onViewCompanion && (
            <button
              type="button"
              onClick={() => onViewCompanion(booking.companionUid)}
              className="text-blue-700 hover:underline font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {booking.companionName}-এর প্রোফাইলে দেখুন →
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length >= 5
          ? prev
          : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!comment.trim() || comment.trim().length < 3) {
      setError('দয়া করে আপনার অভিজ্ঞতা সম্পর্কে সংক্ষেপে কিছু লিখুন।');
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ review: ReviewRecord }>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          rating,
          comment: comment.trim(),
          tags: selectedTags,
        }),
      });
      setComment('');
      setSelectedTags([]);
      if (onReviewSubmitted) {
        onReviewSubmitted(res.review);
      }
    } catch (err: any) {
      setError(err?.message || 'রিভিউ জমা দেওয়া যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
          <h3 className="text-sm font-bold text-slate-950">
            {booking.companionName}-কে রেটিং ও রিভিউ দিন
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
          {booking.bookingCode} · {booking.category}
        </span>
      </div>

      {/* Interactive 5-Star Selector */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="স্টার রেটিং নির্বাচন করুন">
            {[1, 2, 3, 4, 5].map((starValue) => {
              const active = starValue <= displayRating;
              return (
                <button
                  key={starValue}
                  type="button"
                  onMouseEnter={() => setHoverRating(starValue)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(starValue)}
                  aria-label={`${starValue} স্টার`}
                  aria-checked={rating === starValue}
                  role="radio"
                  className="p-1 rounded-md hover:bg-amber-100/70 transition-colors cursor-pointer"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      active ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <span className="text-xs font-semibold text-slate-800 font-mono tabular-nums">
            {RATING_LABELS[displayRating]}
          </span>
        </div>
      </div>

      {/* Interactive Highlight Tag Toggles */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-slate-600">
          সঙ্গীর ভালো দিকগুলো নির্বাচন করুন (ঐচ্ছিক):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_HIGHLIGHT_TAGS.map((tag) => {
            const checked = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={checked}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  checked
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <textarea
          required
          rows={2}
          maxLength={800}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="বুকিংয়ের অভিজ্ঞতা, ব্যবহার ও সময়ানুবর্তিতা সম্পর্কে লিখুন..."
          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono tabular-nums">
          <span>রিভিউটি যাচাইকৃত বুকিং হিসেবে সঙ্গীর প্রোফাইলে যুক্ত হবে</span>
          <span>{comment.length}/800</span>
        </div>
      </div>

      {error && <p className="text-xs font-medium text-red-700">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          {busy ? 'প্রকাশ হচ্ছে...' : 'যাচাইকৃত রিভিউ প্রকাশ করুন'}
        </button>
      </div>
    </form>
  );
}
