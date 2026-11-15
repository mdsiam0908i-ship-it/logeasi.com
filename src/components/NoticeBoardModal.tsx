import React from 'react';
import { AtSign, Instagram, Mail, Megaphone, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export function NoticeBoardModal() {
  const { user, platformPublic, showNoticeBoard, closeNoticeBoard, navigate } = useAuth();

  if (!showNoticeBoard || !user) return null;

  const adminUsername = platformPublic.adminContactUsername || 'sheik_siam0077';
  const adminEmail = platformPublic.adminContactEmail || 'mdsiam0908i@gmail.com';
  const adminInstagram = platformPublic.adminContactInstagram || '@sheik_siam0077';
  const igClean = adminInstagram.replace(/^@/, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-board-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-slate-950 text-white px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs font-mono uppercase tracking-wider text-blue-300">
              অ্যাডমিন নোটিশ বোর্ড
            </span>
          </div>
          <button
            type="button"
            onClick={closeNoticeBoard}
            aria-label="নোটিশ বোর্ড বন্ধ করুন"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <h2 id="notice-board-title" className="font-display text-xl font-bold text-slate-950">
              {platformPublic.noticeBoardTitle || 'জরুরি নোটিশ বোর্ড — LOGEASI.COM'}
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              {platformPublic.noticeBoardMessage ||
                'টপ ১০০ সামাজিক সঙ্গী ডিরেক্টরিতে স্বাগতম! যেকোনো সহায়তা, ভেরিফিকেশন বা পেমেন্ট সংক্রান্ত বিষয়ে নিচের অ্যাডমিন যোগাযোগ মাধ্যমে সরাসরি যোগাযোগ করুন। বুকিংয়ের পর প্রথমে ৫০% অ্যাডভান্স পেমেন্ট সম্পন্ন করুন।'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              অ্যাডমিন সরাসরি যোগাযোগ তথ্য
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-slate-700" /> অ্যাডমিন ইউজারনেম
                </span>
                <span className="font-mono font-bold text-slate-950 select-all">
                  @{adminUsername.replace(/^@/, '')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-700" /> অ্যাডমিন ইমেইল
                </span>
                <a
                  href={`mailto:${adminEmail}`}
                  className="font-mono font-bold text-blue-700 hover:underline select-all"
                >
                  {adminEmail}
                </a>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-rose-600" /> Instagram আইডি
                </span>
                <a
                  href={`https://instagram.com/${igClean}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-bold text-rose-700 hover:underline select-all"
                >
                  {adminInstagram.startsWith('@') ? adminInstagram : `@${adminInstagram}`}
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={closeNoticeBoard}
              className="flex-1 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
            >
              বন্ধ করুন ও টপ ১০০ তালিকা দেখুন
            </button>
            <button
              type="button"
              onClick={() => {
                closeNoticeBoard();
                navigate(
                  user.role === 'companion'
                    ? '/dashboard/companion?editProfile=1'
                    : '/dashboard/customer?editProfile=1'
                );
              }}
              className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              প্রোফাইল আপডেট
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
