import React, { useState } from 'react';
import { Check, Copy, Gift, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatBdt } from '../lib/api.ts';

export function ReferralInviteWidget() {
  const { user, platformPublic, navigate } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const code = user.referralCode || '';
  const credits = Math.max(0, Math.round(Number(user.referralCreditsBdt || 0)));
  const count = Math.max(0, Math.round(Number(user.referralCount || 0)));
  const referrerBonus = platformPublic.referralReferrerBonusCredits ?? 250;
  const signupBonus = platformPublic.referralSignupBonusCredits ?? 150;
  const inviteUrl =
    typeof window !== 'undefined' && code
      ? `${window.location.origin}/auth?tab=register&ref=${encodeURIComponent(code)}`
      : '';

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
            <Gift className="w-4 h-4 text-blue-700" /> ইনভাইট করুন ও ক্রেডিট জিতুন
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            প্রতি রেফারেলে +{referrerBonus} পয়েন্ট · বন্ধু পাবে +{signupBonus} পয়েন্ট
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/referrals')}
          className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          বিস্তারিত →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-slate-500">ব্যবহারযোগ্য ক্রেডিট</p>
          <p className="font-mono text-lg font-bold text-blue-700 tabular-nums mt-0.5">
            {credits} পয়েন্ট ({formatBdt(credits)})
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-slate-500">সফল রেফারেল</p>
          <p className="font-mono text-lg font-bold text-slate-950 tabular-nums mt-0.5">
            {count} জন
          </p>
        </div>
      </div>

      {code && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span className="font-mono text-xs font-bold text-slate-900 shrink-0">{code}</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-[11px] text-slate-600 truncate flex-1">{inviteUrl}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'লিংক কপি হয়েছে' : 'ইনভাইট লিংক কপি'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/referrals')}
              className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" /> লেজার
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
