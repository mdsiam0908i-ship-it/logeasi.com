import React from 'react';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
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

function AppRoutes() {
  const { currentPath } = useAuth();
  const path = currentPath.split('?')[0];

  const renderPage = () => {
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
