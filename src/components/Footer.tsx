import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';

export function Footer() {
  const { navigate } = useAuth();

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1 space-y-3">
            <p className="font-display text-lg font-bold text-white tracking-tight">LOGEASI.COM</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your Time. Your Choice. Your Companion.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Adult-only (18+) non-sexual social companionship, public event attendance, and everyday assistance marketplace across Bangladesh.
            </p>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">Marketplace</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button type="button" onClick={() => navigate('/explore')} className="hover:text-white cursor-pointer">Explore Companions</button></li>
              <li><button type="button" onClick={() => navigate('/how-it-works')} className="hover:text-white cursor-pointer">How It Works</button></li>
              <li><button type="button" onClick={() => navigate('/become-companion')} className="hover:text-white cursor-pointer">Become a Companion</button></li>
              <li><button type="button" onClick={() => navigate('/bookings')} className="hover:text-white cursor-pointer">Booking History</button></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">Trust & Support</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button type="button" onClick={() => navigate('/safety')} className="hover:text-white cursor-pointer">Safety Center</button></li>
              <li><button type="button" onClick={() => navigate('/help')} className="hover:text-white cursor-pointer">Help Center & Tickets</button></li>
              <li><button type="button" onClick={() => navigate('/privacy')} className="hover:text-white cursor-pointer">Privacy Policy</button></li>
              <li><button type="button" onClick={() => navigate('/terms')} className="hover:text-white cursor-pointer">Terms & Conditions</button></li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">Portals & Emergency</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><button type="button" onClick={() => navigate('/dashboard/customer')} className="hover:text-white cursor-pointer">Customer Panel</button></li>
              <li><button type="button" onClick={() => navigate('/dashboard/companion')} className="hover:text-white cursor-pointer">Companion Panel</button></li>
              <li><button type="button" onClick={() => navigate('/admin/login')} className="hover:text-white cursor-pointer">Admin Portal</button></li>
            </ul>
            <p className="pt-2 text-xs text-slate-400">
              Bangladesh National Emergency: <span className="font-mono text-white">999</span> · Helpline: <span className="font-mono text-white">109</span>
            </p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} LOGEASI.COM Bangladesh. All rights reserved. Currency: BDT (৳).</p>
          <p>Strictly 18+ non-sexual social companionship in public venues.</p>
        </div>
      </div>
    </footer>
  );
}
