import React from 'react';
import { ExternalLink, Instagram } from 'lucide-react';

export function DeveloperBanner({ variant = 'spotlight' }: { variant?: 'topstrip' | 'card' | 'spotlight' }) {
  if (variant === 'topstrip') {
    return (
      <div className="bg-slate-950 text-white border-b border-slate-800 px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-display font-bold tracking-wide uppercase">
            DEVELOPER: <span className="text-blue-400">MD SIAM</span>
          </span>
          <a
            href="https://instagram.com/sheik_siam0077"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono font-bold text-blue-300 hover:text-white transition-colors"
          >
            <Instagram className="w-3.5 h-3.5 text-pink-400" />
            <span>Instagram: @sheik_siam0077</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="bg-slate-950 text-white border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-md">
        <p className="text-[11px] font-mono uppercase tracking-widest text-blue-400 font-bold">
          প্ল্যাটফর্ম ডেভেলপার পরিচিতি (DEVELOPER CREDIT)
        </p>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">
              DEVELOPER: MD SIAM
            </p>
            <p className="text-xs text-slate-300 mt-1">
              ফুল-স্ট্যাক আর্কিটেক্ট ও নির্মাতা — LOGEASI.COM বাংলাদেশ
            </p>
          </div>
          <a
            href="https://instagram.com/sheik_siam0077"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-sm font-bold rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Instagram className="w-4 h-4 text-pink-300" />
            @sheik_siam0077
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white border-2 border-blue-600/80 rounded-2xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-blue-400 font-bold">
            অফিসিয়াল প্ল্যাটফর্ম ডেভেলপার
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white uppercase leading-none">
            DEVELOPER: <span className="text-blue-400">MD SIAM</span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-mono font-semibold pt-1">
            INSTAGRAM ID: <span className="text-white">@sheik_siam0077</span>
          </p>
        </div>

        <a
          href="https://instagram.com/sheik_siam0077"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-display text-base sm:text-lg font-extrabold tracking-tight shadow-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Instagram className="w-6 h-6 text-pink-200" />
          <span>ফলো করুন @sheik_siam0077</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
