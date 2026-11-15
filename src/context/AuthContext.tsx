import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiRequest, clearStoredSessionToken, setStoredSessionToken } from '../lib/api.ts';
import { DEFAULT_BENGALI_BOOKING_CATEGORIES } from '../data/bookingCategories.ts';
import type {
  CompanionProfile,
  NotificationRecord,
  PlatformSettings,
  UserAccount,
} from '../types/logeasi.ts';

export interface ProfileStatusMeta {
  needsUpdate: boolean;
  daysLeft: number;
  hoursLeft: number;
  isLockedOut: boolean;
}

const ADMIN_ROLES = new Set([
  'root_super_admin',
  'super_admin',
  'finance_admin',
  'support_admin',
  'verification_admin',
  'content_manager',
]);

export function computeProfileStatus(user: UserAccount | null): ProfileStatusMeta {
  if (!user) return { needsUpdate: false, daysLeft: 3, hoursLeft: 72, isLockedOut: false };
  if (ADMIN_ROLES.has(user.role)) return { needsUpdate: false, daysLeft: 3, hoursLeft: 72, isLockedOut: false };
  if (user.uid.startsWith('cmp_') || user.uid.startsWith('root_')) {
    return { needsUpdate: false, daysLeft: 3, hoursLeft: 72, isLockedOut: false };
  }
  if (user.profileCompleted === true) {
    return { needsUpdate: false, daysLeft: 3, hoursLeft: 72, isLockedOut: false };
  }

  const graceMs = 3 * 24 * 60 * 60 * 1000;
  const deadlineMs = user.profileDeadlineAt
    ? new Date(user.profileDeadlineAt).getTime()
    : new Date(user.createdAt || Date.now()).getTime() + graceMs;
  const remainingMs = deadlineMs - Date.now();
  const isLockedOut = remainingMs <= 0;
  const daysLeft = isLockedOut ? 0 : Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const hoursLeft = isLockedOut ? 0 : Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));

  return {
    needsUpdate: true,
    daysLeft,
    hoursLeft,
    isLockedOut,
  };
}

interface AuthContextValue {
  user: UserAccount | null;
  customerProfile: Record<string, any> | null;
  companionProfile: CompanionProfile | null;
  platformPublic: Partial<PlatformSettings> & { rootInitialized?: boolean };
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  currentPath: string;
  showNoticeBoard: boolean;
  profileStatus: ProfileStatusMeta;
  pendingReferralCode: string;
  setPendingReferralCode: (code: string) => void;
  openNoticeBoard: () => void;
  closeNoticeBoard: () => void;
  navigate: (path: string) => void;
  refreshSession: () => Promise<void>;
  refreshPublicPlatform: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  loginWithGoogle: (
    intendedRole?: 'customer' | 'companion',
    dateOfBirth?: string,
    totpCode?: string,
    referralCode?: string
  ) => Promise<{ user?: UserAccount; requires2FA?: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [customerProfile, setCustomerProfile] = useState<Record<string, any> | null>(null);
  const [companionProfile, setCompanionProfile] = useState<CompanionProfile | null>(null);
  const [platformPublic, setPlatformPublic] = useState<
    Partial<PlatformSettings> & { rootInitialized?: boolean }
  >({
    serviceFeePercent: 12,
    paymentMode: 'sandbox',
    cashPaymentEnabled: true,
    maxCashBookingBdt: 3000,
    bkashPersonalNumber: '01700-000000',
    nagadPersonalNumber: '01877pokpok',
    customPaymentLabel: '৩. অ্যাডমিন পার্সোনাল রকেট / কাস্টম সেন্ড মানি',
    customPaymentNumber: '01700-000000',
    customPaymentInstructions: 'বুকিং নিশ্চিত করতে মোট টাকার ৫০% অ্যাডমিন পার্সোনাল নম্বরে সেন্ড মানি করে TrxID জমা দিন।',
    bensonPaymentLabel: '৪. বেনসন সিগারেট পেমেন্ট (১,০০০৳ = ৩ প্যাকেট)',
    bensonBaseBdt: 1000,
    bensonPacketsPerBase: 3,
    bensonItemName: 'প্যাকেট বেনসন সিগারেট',
    bensonContactNumber: '01700-000000',
    bensonPaymentInstructions:
      'প্রতি ১,০০০ টাকা সমান ৩ প্যাকেট বেনসন সিগারেট। নির্ধারিত প্যাকেট হস্তান্তর করে ডেলিভারি রেফারেন্স/ফোন নম্বর লিখে জমা দিন।',
    noticeBoardTitle: 'জরুরি নোটিশ বোর্ড — LOGEASI.COM',
    noticeBoardMessage:
      'টপ ১০০ সামাজিক সঙ্গী ডিরেক্টরিতে স্বাগতম! যেকোনো সহায়তা, ভেরিফিকেশন বা পেমেন্ট সংক্রান্ত বিষয়ে নিচের অ্যাডমিন যোগাযোগ মাধ্যমে সরাসরি যোগাযোগ করুন। বুকিংয়ের পর প্রথমে ৫০% অ্যাডভান্স পেমেন্ট সম্পন্ন করুন।',
    adminContactUsername: 'sheik_siam0077',
    adminContactEmail: 'mdsiam0908i@gmail.com',
    adminContactInstagram: '@sheik_siam0077',
    allowedDivision: 'All Bangladesh Divisions',
    bookingCategories: DEFAULT_BENGALI_BOOKING_CATEGORIES,
    referralReferrerBonusCredits: 250,
    referralSignupBonusCredits: 150,
  });
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingReferralCode, setPendingReferralCodeState] = useState<string>(() => {
    try {
      const searchRef = new URLSearchParams(window.location.search).get('ref') || '';
      const pathInvite = window.location.pathname.startsWith('/invite/')
        ? window.location.pathname.replace('/invite/', '').split('/')[0]
        : '';
      const found = (searchRef || pathInvite).trim().toUpperCase();
      if (found) {
        localStorage.setItem('logeasi_pending_ref_code', found);
        return found;
      }
      return localStorage.getItem('logeasi_pending_ref_code') || '';
    } catch {
      return '';
    }
  });

  const setPendingReferralCode = useCallback((code: string) => {
    const clean = (code || '').trim().toUpperCase();
    setPendingReferralCodeState(clean);
    try {
      if (clean) localStorage.setItem('logeasi_pending_ref_code', clean);
      else localStorage.removeItem('logeasi_pending_ref_code');
    } catch {
      // ignore
    }
  }, []);
  const [showNoticeBoard, setShowNoticeBoard] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('logeasi_show_notice_board') === '1';
    } catch {
      return false;
    }
  });
  const [currentPath, setCurrentPath] = useState<string>(
    () => `${window.location.pathname || '/'}${window.location.search || ''}`
  );

  const openNoticeBoard = useCallback(() => {
    try {
      sessionStorage.setItem('logeasi_show_notice_board', '1');
    } catch {
      // ignore
    }
    setShowNoticeBoard(true);
  }, []);

  const closeNoticeBoard = useCallback(() => {
    try {
      sessionStorage.removeItem('logeasi_show_notice_board');
    } catch {
      // ignore
    }
    setShowNoticeBoard(false);
  }, []);

  const navigate = useCallback((path: string) => {
    const cleanUrl = path || '/';
    if (`${window.location.pathname}${window.location.search}` !== cleanUrl) {
      window.history.pushState({}, '', cleanUrl);
    }
    setCurrentPath(cleanUrl);
    const [pPart, qPart = ''] = cleanUrl.split('?');
    const qRef = new URLSearchParams(qPart).get('ref') || '';
    const invRef = pPart.startsWith('/invite/') ? pPart.replace('/invite/', '').split('/')[0] : '';
    const detected = (qRef || invRef).trim().toUpperCase();
    if (detected) {
      setPendingReferralCode(detected);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setPendingReferralCode]);

  useEffect(() => {
    const onPop = () =>
      setCurrentPath(`${window.location.pathname || '/'}${window.location.search || ''}`);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshPublicPlatform = useCallback(async () => {
    try {
      const data = await apiRequest('/api/platform/public');
      setPlatformPublic(data);
    } catch {
      // Non-fatal
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await apiRequest<{ notifications: NotificationRecord[] }>('/api/notifications');
      setNotifications(data.notifications || []);
    } catch {
      setNotifications([]);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest<{
        user: UserAccount | null;
        customerProfile?: Record<string, any> | null;
        companionProfile?: CompanionProfile | null;
      }>('/api/auth/me');
      setUser(data.user);
      setCustomerProfile(data.customerProfile || null);
      setCompanionProfile(data.companionProfile || null);
      if (data.user) {
        refreshNotifications();
      } else {
        setNotifications([]);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    refreshPublicPlatform();
    const unsub = onAuthStateChanged(auth, () => {
      refreshSession();
    });
    return () => unsub();
  }, [refreshPublicPlatform, refreshSession]);

  const loginWithGoogle = async (
    intendedRole: 'customer' | 'companion' = 'customer',
    dateOfBirth?: string,
    totpCode?: string,
    referralCode?: string
  ) => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const effectiveRef = (referralCode || pendingReferralCode || '').trim().toUpperCase();
      const res = await apiRequest<{ user?: UserAccount; requires2FA?: boolean; sessionToken?: string }>(
        '/api/auth/google',
        {
          method: 'POST',
          body: JSON.stringify({
            idToken,
            intendedRole,
            dateOfBirth,
            totpCode,
            ...(effectiveRef ? { referralCode: effectiveRef } : {}),
          }),
        }
      );
      if (res.sessionToken) {
        setStoredSessionToken(res.sessionToken);
      }
      if (res.user) {
        if (effectiveRef) setPendingReferralCode('');
        await refreshSession();
        await refreshPublicPlatform();
      }
      return res;
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code.includes('unauthorized-domain')) {
        throw new Error(
          'এই প্রকাশিত ডোমেইনটি এখনো Google Sign-In Authorized Domains-এ যোগ করা হয়নি। এখনই নিচে Email / Password অথবা +880 Phone OTP দিয়ে লগইন ও সাইন আপ করুন (অথবা Firebase Console -> Authentication -> Settings -> Authorized domains-এ ডোমেইনটি যোগ করুন)।'
        );
      }
      if (code.includes('popup-blocked')) {
        throw new Error(
          'ব্রাউজার পপ-আপ ব্লক করেছে। পপ-আপ Allow করুন অথবা Email / +880 Phone OTP ব্যবহার করুন।'
        );
      }
      if (code.includes('popup-closed-by-user')) {
        throw new Error('Google সাইন-ইন পপ-আপটি বন্ধ করা হয়েছে। আবার চেষ্টা করুন বা Email ব্যবহার করুন।');
      }
      throw err;
    }
  };

  const logout = async () => {
    clearStoredSessionToken();
    closeNoticeBoard();
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setUser(null);
    setCustomerProfile(null);
    setCompanionProfile(null);
    setNotifications([]);
    navigate('/');
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const profileStatus = useMemo(() => computeProfileStatus(user), [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        customerProfile,
        companionProfile,
        platformPublic,
        notifications,
        unreadCount,
        loading,
        currentPath,
        showNoticeBoard,
        profileStatus,
        pendingReferralCode,
        setPendingReferralCode,
        openNoticeBoard,
        closeNoticeBoard,
        navigate,
        refreshSession,
        refreshPublicPlatform,
        refreshNotifications,
        markAllNotificationsRead,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
