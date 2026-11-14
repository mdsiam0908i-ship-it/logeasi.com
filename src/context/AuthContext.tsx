import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

interface AuthContextValue {
  user: UserAccount | null;
  customerProfile: Record<string, any> | null;
  companionProfile: CompanionProfile | null;
  platformPublic: Partial<PlatformSettings> & { rootInitialized?: boolean };
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  currentPath: string;
  navigate: (path: string) => void;
  refreshSession: () => Promise<void>;
  refreshPublicPlatform: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  loginWithGoogle: (intendedRole?: 'customer' | 'companion', dateOfBirth?: string, totpCode?: string) => Promise<{ user?: UserAccount; requires2FA?: boolean }>;
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
    allowedDivision: 'All Bangladesh Divisions',
    bookingCategories: DEFAULT_BENGALI_BOOKING_CATEGORIES,
  });
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  const navigate = useCallback((path: string) => {
    const cleanUrl = path || '/';
    if (`${window.location.pathname}${window.location.search}` !== cleanUrl) {
      window.history.pushState({}, '', cleanUrl);
    }
    setCurrentPath(cleanUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
    totpCode?: string
  ) => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const res = await apiRequest<{ user?: UserAccount; requires2FA?: boolean; sessionToken?: string }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, intendedRole, dateOfBirth, totpCode }),
    });
    if (res.sessionToken) {
      setStoredSessionToken(res.sessionToken);
    }
    if (res.user) {
      await refreshSession();
      await refreshPublicPlatform();
    }
    return res;
  };

  const logout = async () => {
    clearStoredSessionToken();
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
