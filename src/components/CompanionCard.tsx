import React, { useEffect, useState } from 'react';
import { Instagram, MessageCircle, ShieldCheck, Star, User } from 'lucide-react';
import { formatBdt } from '../lib/api.ts';
import type { CompanionProfile } from '../types/logeasi.ts';

interface CompanionCardProps {
  companion: CompanionProfile;
  onViewProfile: (uid: string) => void;
  onBook: (uid: string) => void;
  onToggleCompare?: (uid: string) => void;
  isCompared?: boolean;
}

export function CompanionCard({
  companion,
  onViewProfile,
  onBook,
  onToggleCompare,
  isCompared,
}: CompanionCardProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [companion.photoUrl]);

  return (
    <article className="group bg-white border border-slate-200 hover:border-blue-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
      <button
        type="button"
        onClick={() => onViewProfile(companion.uid)}
        className="relative aspect-[3/4] w-full bg-slate-100 overflow-hidden text-left cursor-pointer"
      >
        {companion.photoUrl && !imgError ? (
          <img
            src={companion.photoUrl}
            alt={companion.displayName}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 flex flex-col items-center justify-center text-white p-6">
            <User className="w-12 h-12 text-blue-300 mb-2" />
            <span className="font-display text-lg font-semibold text-center">{companion.displayName}</span>
          </div>
        )}
        {companion.topRank && companion.topRank <= 100 && (
          <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tabular-nums tracking-wide border border-white/10">
            TOP #{String(companion.topRank).padStart(2, '0')}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent p-4 flex flex-col justify-end">
          <div className="flex items-center justify-between gap-2 text-white">
            <h3 className="font-display text-lg font-bold truncate">{companion.displayName}</h3>
            <span className="flex items-center gap-1 text-sm font-mono tabular-nums shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {companion.ratingAvg > 0 ? companion.ratingAvg.toFixed(1) : 'New'}
            </span>
          </div>
        </div>
      </button>

      <div className="p-4 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          {/* Clean unboxed inline metadata with typographic separators */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              {companion.city}
              {companion.division && companion.division.toLowerCase() !== companion.city.toLowerCase()
                ? `, ${companion.division}`
                : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[140px]">{(companion.areas || []).slice(0, 2).join(', ')}</span>
            {companion.verificationStatus === 'approved' && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-blue-700 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </>
            )}
          </div>

          <p className="text-sm text-slate-700 line-clamp-2 leading-snug">{companion.headline}</p>

          <p className="text-xs text-slate-500 truncate">
            {(companion.languages || []).join(' / ')} · {(companion.categories || []).slice(0, 2).join(', ')}
          </p>

          {(companion.instagramHandle || companion.whatsappNumber) && (
            <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5 truncate">
              {companion.instagramHandle && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Instagram className="w-3 h-3 text-blue-700 shrink-0" />
                  <span className="truncate">{companion.instagramHandle}</span>
                </span>
              )}
              {companion.whatsappNumber && (
                <span className="inline-flex items-center gap-1 shrink-0 font-mono">
                  <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>WhatsApp</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="font-mono text-base font-bold text-slate-950 tabular-nums">
                {formatBdt(companion.hourlyRateBdt)}
              </span>
              <span className="text-xs text-slate-500"> / hour</span>
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              Session {formatBdt(companion.sessionRateBdt)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onBook(companion.uid)}
              className="flex-1 py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Book Companion
            </button>
            {onToggleCompare && (
              <button
                type="button"
                onClick={() => onToggleCompare(companion.uid)}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  isCompared
                    ? 'bg-slate-950 text-white border-slate-950'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isCompared ? 'Compared' : 'Compare'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
