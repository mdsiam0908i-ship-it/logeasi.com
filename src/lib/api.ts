import { auth } from './firebase.ts';

const SESSION_TOKEN_KEY = 'logeasi_session_token';

export function getStoredSessionToken(): string {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredSessionToken(token?: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearStoredSessionToken(): void {
  setStoredSessionToken(null);
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const stored = getStoredSessionToken();
  if (stored) {
    headers['Authorization'] = `Bearer ${stored}`;
  } else if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch {
      // Fallback to HttpOnly cookie
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
    if (!res.ok) throw new Error('Download failed.');
    return (await res.text()) as unknown as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function formatBdt(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return `৳${num.toLocaleString('en-BD')}`;
}
