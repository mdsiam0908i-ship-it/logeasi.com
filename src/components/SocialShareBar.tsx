import React, { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

interface SocialShareBarProps {
  displayName: string;
  headline?: string;
  city?: string;
  division?: string;
  ratingAvg?: number;
  profileUrl: string;
}

export function SocialShareBar({
  displayName,
  headline,
  city,
  division,
  ratingAvg,
  profileUrl,
}: SocialShareBarProps) {
  const [copied, setCopied] = useState(false);

  const locationLabel = [city, division ? `${division} বিভাগ` : ''].filter(Boolean).join(', ');
  const ratingText = ratingAvg && ratingAvg > 0 ? ` ★ ${ratingAvg.toFixed(1)}/৫` : '';
  const summaryParts = [
    `LOGEASI.COM-এ যাচাইকৃত সঙ্গী: ${displayName}${ratingText}`,
    locationLabel ? `এলাকা: ${locationLabel}` : '',
    headline || '',
  ].filter(Boolean);
  const shareText = summaryParts.join(' · ');

  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedWhatsapp = encodeURIComponent(`${shareText}\n${profileUrl}`);

  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
  const whatsappHref = `https://wa.me/?text=${encodedWhatsapp}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard?.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access unavailable in restricted contexts
    }
  };

  return (
    <div className="pt-5 border-t border-slate-100 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-blue-700" />
          <span>প্রোফাইলটি সোশ্যাল মিডিয়ায় শেয়ার করুন</span>
        </p>
        <span className="text-[11px] font-mono text-slate-400 truncate max-w-xs">{profileUrl}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${displayName}-এর প্রোফাইল Facebook-এ শেয়ার করুন`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-[#1877F2] hover:bg-[#1565D8] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.57v1.89h2.77l-.44 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
          </svg>
          <span>Facebook</span>
        </a>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${displayName}-এর প্রোফাইল WhatsApp-এ শেয়ার করুন`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-[#25D366] hover:bg-[#1EB857] text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.79 14.01c-.24.68-1.42 1.3-1.95 1.38-.51.07-1.15.1-1.85-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.9-4.27-5.05-4.47-.15-.2-1.21-1.61-1.21-3.07s.77-2.18 1.04-2.48c.27-.3.6-.37.8-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.06 1.13 1.01 2.09 1.32 2.39 1.47.3.15.47.12.65-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.34.07.12.07.7-.17 1.38z" />
          </svg>
          <span>WhatsApp</span>
        </a>

        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${displayName}-এর প্রোফাইল Twitter-এ শেয়ার করুন`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Twitter / X</span>
        </a>

        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">লিঙ্ক কপি হয়েছে</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>লিঙ্ক কপি করুন</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
