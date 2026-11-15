import React from 'react';
import { DeveloperBanner } from './DeveloperBanner.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function Footer() {
  const { navigate } = useAuth();

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-12">
          <DeveloperBanner variant="spotlight" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1 space-y-3">
            <p className="font-display text-lg font-bold text-white tracking-tight">LOGEASI.COM</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              আপনার সময়। আপনার পছন্দ। আপনার সঙ্গী।
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              বাংলাদেশের সকল বিভাগে প্রাপ্তবয়স্কদের (১৮+) জন্য সম্পূর্ণ অ-যৌন ও নিরাপদ সামাজিক সঙ্গী, পাবলিক ইভেন্ট ও দৈনন্দিন কাজের সহায়তার মার্কেটপ্লেস।
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">মার্কেটপ্লেস</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button type="button" onClick={() => navigate('/explore')} className="hover:text-white cursor-pointer">সঙ্গী খুঁজুন</button></li>
              <li><button type="button" onClick={() => navigate('/how-it-works')} className="hover:text-white cursor-pointer">যেভাবে কাজ করে</button></li>
              <li><button type="button" onClick={() => navigate('/become-companion')} className="hover:text-white cursor-pointer">সঙ্গী হিসেবে যোগ দিন</button></li>
              <li><button type="button" onClick={() => navigate('/bookings')} className="hover:text-white cursor-pointer">বুকিং ইতিহাস</button></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">নিরাপত্তা ও সহায়তা</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button type="button" onClick={() => navigate('/safety')} className="hover:text-white cursor-pointer">নিরাপত্তা কেন্দ্র</button></li>
              <li><button type="button" onClick={() => navigate('/help')} className="hover:text-white cursor-pointer">হেল্প সেন্টার ও সাপোর্ট</button></li>
              <li><button type="button" onClick={() => navigate('/privacy')} className="hover:text-white cursor-pointer">প্রাইভেসি পলিসি</button></li>
              <li><button type="button" onClick={() => navigate('/terms')} className="hover:text-white cursor-pointer">শর্তাবলী</button></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">পোর্টাল ও জরুরি সেবা</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button type="button" onClick={() => navigate('/dashboard/customer')} className="hover:text-white cursor-pointer">গ্রাহক প্যানেল</button></li>
              <li><button type="button" onClick={() => navigate('/dashboard/companion')} className="hover:text-white cursor-pointer">সঙ্গী প্যানেল</button></li>
              <li><button type="button" onClick={() => navigate('/admin/login')} className="hover:text-white cursor-pointer">অ্যাডমিন পোর্টাল</button></li>
            </ul>
            <p className="pt-2 text-xs text-slate-400">
              জাতীয় জরুরি সেবা: <span className="font-mono text-white">999</span> · হেল্পলাইন: <span className="font-mono text-white">109</span>
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} LOGEASI.COM বাংলাদেশ · ডেভেলপার: MD SIAM (@sheik_siam0077)। মুদ্রা: BDT (৳)।</p>
          <p>সর্বদা পাবলিক স্থানে ১৮+ নিরাপদ ও শান্তিপূর্ণ সামাজিক সঙ্গ।</p>
        </div>
      </div>
    </footer>
  );
}
