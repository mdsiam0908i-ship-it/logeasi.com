import React from 'react';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
import { NoticeBoardModal } from './components/NoticeBoardModal.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import {
  AdminLoginPage,
  AdminManagementPage,
  FinanceDashboardPage,
  RootAdminDashboardPage,
  SecurityDashboardPage,
} from './pages/AdminPortalPages.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import {
  BookingCheckoutPage,
  BookingHistoryPage,
  PaymentPage,
} from './pages/BookingAndPaymentPages.tsx';
import { CompanionDashboardPage } from './pages/CompanionDashboardPage.tsx';
import { CompanionProfilePage } from './pages/CompanionProfilePage.tsx';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage.tsx';
import { ExplorePage } from './pages/ExplorePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import {
  BecomeCompanionPage,
  HelpCenterPage,
  HowItWorksPage,
  PrivacyPolicyPage,
  SafetyCenterPage,
  TermsPage,
} from './pages/PublicInfoPages.tsx';
import { ReferralPage } from './pages/ReferralPage.tsx';
import { TransactionsAndReceiptsPage } from './pages/TransactionsAndReceiptsPage.tsx';

function AppRoutes() {
  const { user, currentPath, profileStatus, navigate, logout } = useAuth();
  const [path, queryPart = ''] = currentPath.split('?');
  const searchParams = new URLSearchParams(queryPart);
  const isProfileEditRoute =
    (path === '/dashboard/customer' || path === '/dashboard/companion') &&
    searchParams.get('editProfile') === '1';

  const renderPage = () => {
    if (
      user &&
      profileStatus.isLockedOut &&
      !isProfileEditRoute &&
      path !== '/auth' &&
      !path.startsWith('/admin')
    ) {
      const targetEditPath =
        user.role === 'companion'
          ? '/dashboard/companion?editProfile=1'
          : '/dashboard/customer?editProfile=1';
      return (
        <main className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white border-2 border-red-200 rounded-2xl p-8 text-center space-y-5 shadow-sm">
            <p className="text-xs font-mono font-bold text-red-700 uppercase tracking-wider">
              অ্যাকাউন্ট সাময়িকভাবে লক (৩ দিনের সময়সীমা শেষ)
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-950">
              প্রোফাইল আপডেট করা ছাড়া অন্যান্য কার্যক্রম বন্ধ রয়েছে
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              সাইন-আপ করার ৩ দিনের মধ্যে প্রোফাইল তথ্য সম্পূর্ণ ও সংরক্ষণ করা বাধ্যতামূলক। এখনই আপনার প্রোফাইল আপডেট ও সেভ করলে টপ ১০০ তালিকা, বুকিং ও পেমেন্টসহ সকল ফিচার সাথে সাথে আনলক হয়ে যাবে।
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => navigate(targetEditPath)}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                এখনই প্রোফাইল আপডেট করুন
              </button>
              <button
                type="button"
                onClick={logout}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg cursor-pointer"
              >
                সাইন আউট
              </button>
            </div>
          </div>
        </main>
      );
    }

    if (path === '/' || path === '') return <HomePage />;
    if (path === '/explore') return <ExplorePage />;
    if (path.startsWith('/companions/')) {
      return <CompanionProfilePage companionUid={path.replace('/companions/', '')} />;
    }
    if (path === '/how-it-works') return <HowItWorksPage />;
    if (path === '/become-companion') return <BecomeCompanionPage />;
    if (path === '/auth') return <AuthPage />;
    if (path === '/dashboard/customer') return <CustomerDashboardPage />;
    if (path === '/dashboard/companion') return <CompanionDashboardPage />;
    if (path.startsWith('/booking/checkout/')) {
      return <BookingCheckoutPage companionUid={path.replace('/booking/checkout/', '')} />;
    }
    if (path.startsWith('/payment/')) {
      return <PaymentPage bookingId={path.replace('/payment/', '')} />;
    }
    if (path === '/bookings') return <BookingHistoryPage />;
    if (path === '/transactions') return <TransactionsAndReceiptsPage />;
    if (path === '/referrals') return <ReferralPage />;
    if (path.startsWith('/invite/')) return <AuthPage />;
    if (path === '/help') return <HelpCenterPage />;
    if (path === '/safety') return <SafetyCenterPage />;
    if (path === '/privacy') return <PrivacyPolicyPage />;
    if (path === '/terms') return <TermsPage />;
    if (path === '/admin/login') return <AdminLoginPage />;
    if (path === '/admin/dashboard') return <RootAdminDashboardPage />;
    if (path === '/admin/management') return <AdminManagementPage />;
    if (path === '/admin/finance') return <FinanceDashboardPage />;
    if (path === '/admin/security') return <SecurityDashboardPage />;
    return <HomePage />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <NoticeBoardModal />
      <div className="flex-1">{renderPage()}</div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
