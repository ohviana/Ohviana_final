'use client';

import { OtpSendResponse, SessionResponse } from '@ohviana/contracts';
import { apiFetch } from './api';
import { getSupabase } from './supabase';

/**
 * How people sign in (NEXT_PUBLIC_AUTH_MODE):
 *  - `password` — email + password accounts run by the Ohviana API (no emails sent).
 *  - `supabase` — Supabase magic-link email (rate-limited on the free plan).
 *  - `dev`      — TEMPORARY local testing: email only, no password (API AUTH_MODE=dev).
 * Customers sign in with a phone code at checkout in every mode (an Ohviana API session).
 */
export type AuthMode = 'password' | 'supabase' | 'dev';
export const AUTH_MODE: AuthMode = (['password', 'dev'] as const).includes(
  process.env.NEXT_PUBLIC_AUTH_MODE as 'password' | 'dev',
)
  ? (process.env.NEXT_PUBLIC_AUTH_MODE as AuthMode)
  : 'supabase';

const SESSION_KEY = 'ohviana:session';
const DEV_USER_KEY = 'ohviana:dev-user';
const AUTH_EVENT = 'ohviana:auth-change';

interface StoredSession {
  accessToken: string;
  expiresAt: string;
  email: string | null;
  phone?: string | null;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): the session lasts for this page only.
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function currentSession(): StoredSession | null {
  const s = read<StoredSession>(SESSION_KEY);
  if (!s) return null;
  // Treat as expired a minute early so requests never race the expiry.
  return Date.parse(s.expiresAt) - 60_000 > Date.now() ? s : null;
}

// ---------- Password mode ----------

async function startSession(
  path: '/v1/auth/signin' | '/v1/auth/signup' | '/v1/auth/otp/verify',
  body: object,
) {
  const session = await apiFetch(path, SessionResponse, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  write(SESSION_KEY, {
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    email: session.user.email,
    phone: session.user.phone,
  } satisfies StoredSession);
  return session;
}

export const signInWithPassword = (email: string, password: string) =>
  startSession('/v1/auth/signin', { email, password });

export const signUpWithPassword = (email: string, password: string, fullName?: string) =>
  startSession('/v1/auth/signup', { email, password, ...(fullName ? { fullName } : {}) });

// ---------- Phone + SMS code (customers, any mode) ----------

/** Texts a 6-digit sign-in code to `phone` (E.164). */
export const sendPhoneCode = (phone: string) =>
  apiFetch('/v1/auth/otp/send', OtpSendResponse, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

export const signInWithPhoneCode = (phone: string, code: string) =>
  startSession('/v1/auth/otp/verify', { phone, code });

// ---------- Dev mode ----------

/** Dev mode: "sign in" as this email (or sign out with null). */
export function setDevUser(email: string | null): void {
  try {
    if (email) localStorage.setItem(DEV_USER_KEY, email.trim().toLowerCase());
    else localStorage.removeItem(DEV_USER_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

// ---------- Mode-agnostic API used by pages ----------

/** Credentials header for the signed-in user, or {} for guests. Never throws. */
export async function authHeader(): Promise<Record<string, string>> {
  // An Ohviana session (password or phone sign-in) wins in every mode.
  const s = currentSession();
  if (s) return { authorization: `Bearer ${s.accessToken}` };
  if (AUTH_MODE === 'password') return {};
  if (AUTH_MODE === 'dev') {
    try {
      const email = localStorage.getItem(DEV_USER_KEY);
      return email ? { 'x-dev-user': email } : {};
    } catch {
      return {};
    }
  }
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}

export async function isSignedIn(): Promise<boolean> {
  return Object.keys(await authHeader()).length > 0;
}

/** Email of the signed-in user when known locally (password/dev modes). */
export function signedInEmail(): string | null {
  const s = currentSession();
  if (s) return s.email;
  if (AUTH_MODE === 'password') return null;
  if (AUTH_MODE === 'dev') {
    try {
      return localStorage.getItem(DEV_USER_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

/** Calls `cb` whenever the user signs in or out. Returns an unsubscribe function. */
export function onAuthChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(AUTH_EVENT, handler);
  window.addEventListener('storage', handler);
  const unlisten = () => {
    window.removeEventListener(AUTH_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
  if (AUTH_MODE !== 'supabase') return unlisten;
  try {
    const { data } = getSupabase().auth.onAuthStateChange(() => cb());
    return () => {
      unlisten();
      data.subscription.unsubscribe();
    };
  } catch {
    return unlisten;
  }
}

export async function signOut(): Promise<void> {
  write(SESSION_KEY, null);
  if (AUTH_MODE === 'password') return;
  if (AUTH_MODE === 'dev') return setDevUser(null);
  await getSupabase().auth.signOut();
}

const TOKEN_PREFIX = 'ohviana:booking-token:';

/**
 * Guest booking access tokens live in this browser so the confirmation page keeps working.
 * Storage can be unavailable (private mode); callers must cope with null.
 */
export function rememberBookingToken(reference: string, token: string): void {
  try {
    localStorage.setItem(TOKEN_PREFIX + reference, token);
  } catch {
    // ignore
  }
}

export function recallBookingToken(reference: string): string | null {
  try {
    return localStorage.getItem(TOKEN_PREFIX + reference);
  } catch {
    return null;
  }
}
