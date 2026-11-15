import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, Gift, LogOut, Megaphone, Menu, Shield, User as UserIcon, X } from 'lucide-react';
import { DeveloperBanner } from './DeveloperBanner.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function Navbar() {
  const {
    user,
    unreadCount,
    notifications,
    markAllNotificationsRead,
    currentPath,
    profileStatus,
    openNoticeBoard,
    navigate,
    logout,
  } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const isAdmin =
    user &&
    [
      'root_super_admin',
      'super_admin',
      'finance_admin',
      'support_admin',
      'verification_admin',
      'content_manager',
    ].includes(user.role);

  const navLinks = [
    { label: 'সঙ্গী খুঁজুন', path: '/explore' },
    { label: 'যেভাবে কাজ করে', path: '/how-it-works' },
    { label: 'সঙ্গী হোন', path: '/become-companion' },
    { label: 'নিরাপত্তা', path: '/safety' },
    { label: 'সহায়তা', path: '/help' },
  ];

  const handleNav = (path: string) => {
    setMobileOpen(false);
    setMenuOpen(false);
    navigate(path);
  };

  const activeBase = currentPath.split('?')[0];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90">
      <DeveloperBanner variant="topstrip" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => handleNav('/')}
          className="font-display text-lg font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-700 inline-block" aria-hidden="true" />
          <span>LOGEASI.COM</span>
        </button>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {navLinks.map((item) => {
            const isActive = activeBase === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
                  isActive
                    ? 'text-blue-700 font-semibold underline underline-offset-8 decoration-2'
                    : 'hover:text-blue-700 hover:underline underline-offset-8 decoration-2'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Auth actions */}
        <div className="flex items-center gap-2.5 shrink-0" ref={dropdownRef}>
          {!user ? (
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleNav('/auth?tab=login')}
                className="px-3.5 py-2 text-sm font-semibold text-slate-800 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                সাইন ইন
              </button>
              <button
                type="button"
                onClick={() => handleNav('/auth?tab=register')}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                সাইন আপ
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((v) => !v);
                    if (!menuOpen && unreadCount > 0) {
                      markAllNotificationsRead();
                    }
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-blue-700" />
                  <span className="max-w-[130px] truncate">{user.fullName}</span>
                  {unreadCount > 0 && (
                    <span className="text-xs font-mono text-blue-700 tabular-nums">({unreadCount})</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {user.email || (user.username ? `@${user.username}` : '') || user.phone} · {user.role.replace(/_/g, ' ')}
                      </p>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => handleNav('/dashboard/customer')}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-700 cursor-pointer"
                      >
                        গ্রাহক ড্যাশবোর্ড
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('/dashboard/companion')}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-700 cursor-pointer"
                      >
                        সঙ্গী ড্যাশবোর্ড
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('/bookings')}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-700 cursor-pointer"
                      >
                        বুকিং ইতিহাস ও চ্যাট
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('/transactions')}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-700 cursor-pointer"
                      >
                        পেমেন্ট ও রসিদ ইতিহাস
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('/referrals')}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-700 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Gift className="w-3.5 h-3.5 text-blue-700" /> রেফারেল ও ক্রেডিট বোনাস
                        </span>
                        {(user.referralCreditsBdt || 0) > 0 && (
                          <span className="font-mono text-xs font-bold text-blue-700 tabular-nums">
                            {user.referralCreditsBdt} পয়েন্ট
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          openNoticeBoard();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-700 flex items-center gap-2 cursor-pointer"
                      >
                        <Megaphone className="w-3.5 h-3.5 text-blue-700" /> অ্যাডমিন নোটিশ বোর্ড
                      </button>
                      {isAdmin && (
                        <>
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            type="button"
                            onClick={() => handleNav('/admin/dashboard')}
                            className="w-full text-left px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Shield className="w-4 h-4" />
                            অ্যাডমিন কন্ট্রোল সেন্টার
                          </button>
                        </>
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="border-t border-slate-100 px-4 py-2 max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Bell className="w-3.5 h-3.5" /> সাম্প্রতিক নোটিফিকেশন
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {notifications.slice(0, 4).map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => n.link && handleNav(n.link)}
                              className="w-full text-left block p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <p className="text-xs font-medium text-slate-900 truncate">{n.title}</p>
                              <p className="text-[11px] text-slate-500 line-clamp-2">{n.message}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" /> সাইন আউট
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                title="সাইন আউট"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                সাইন আউট
              </button>
            </div>
          )}

          {!user && (
            <button
              type="button"
              onClick={() => handleNav('/auth?tab=login')}
              className="sm:hidden px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              সাইন ইন
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="মেনু খুলুন"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {navLinks.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              className="block w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 mt-2 border-t border-slate-100 space-y-1.5">
            {!user ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleNav('/auth?tab=login')}
                  className="py-2 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg"
                >
                  সাইন ইন
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/auth?tab=register')}
                  className="py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg"
                >
                  সাইন আপ
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleNav(user.role === 'companion' ? '/dashboard/companion' : '/dashboard/customer')}
                  className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg"
                >
                  আমার ড্যাশবোর্ড ({user.fullName})
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/referrals')}
                  className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg"
                >
                  রেফারেল ও ক্রেডিট বোনাস ({user.referralCreditsBdt || 0} পয়েন্ট)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="block w-full text-left px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 rounded-lg"
                >
                  সাইন আউট
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {user && profileStatus.needsUpdate && (
        <div
          className={`border-t text-[11px] sm:text-xs transition-colors ${
            profileStatus.isLockedOut
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-amber-50/75 border-amber-200/80 text-amber-900'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                handleNav(
                  user.role === 'companion'
                    ? '/dashboard/companion?editProfile=1'
                    : '/dashboard/customer?editProfile=1'
                )
              }
              className="w-full text-left flex flex-wrap items-center justify-between gap-2 hover:underline cursor-pointer"
            >
              <span>
                {profileStatus.isLockedOut
                  ? 'জরুরি নোটিশ: ৩ দিনের মধ্যে প্রোফাইল আপডেট না করায় সব ফিচার লক আছে — আনলক করতে এখানে ক্লিক করে প্রোফাইল আপডেট করুন।'
                  : `হালকা নোটিশ: আপনার প্রোফাইল তথ্য এখনো আপডেট করা হয়নি (আর ${profileStatus.daysLeft} দিন / ${profileStatus.hoursLeft} ঘণ্টা বাকি) — ৩ দিনের মধ্যে আপডেট না করলে সব কার্যক্রম লক হয়ে যাবে।`}
              </span>
              <span className="font-semibold text-blue-800 whitespace-nowrap shrink-0">
                প্রোফাইল আপডেট করুন →
              </span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
