'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { Icon } from '@/components/Icon';
import { ApiError } from '@/lib/api';
import { AUTH_MODE, setDevUser, signInWithPassword, signUpWithPassword } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

export default function LoginPage() {
  return (
    <div className="container">
      <div className="auth-wrap">
        <AuthSide />
        <div className="card stack" style={{ padding: 28, justifyContent: 'center' }}>
          <Suspense fallback={null}>
            {AUTH_MODE === 'password' ? (
              <PasswordAuth />
            ) : AUTH_MODE === 'dev' ? (
              <DevLogin />
            ) : (
              <MagicLinkLogin />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function AuthSide() {
  return (
    <aside className="auth-side">
      <span className="brand" style={{ color: '#fff' }}>
        <BrandMark />
        Ohviana
      </span>
      <h2 style={{ color: '#fff', fontSize: '1.7rem', margin: 0 }}>
        Your treks, departures and bookings — in one place.
      </h2>
      <ul className="check-list">
        <li>
          <Icon name="check" size={16} /> Organizers: list treks, publish departures, share booking
          links
        </li>
        <li>
          <Icon name="check" size={16} /> See attendees and download lists for trek leaders
        </li>
        <li>
          <Icon name="check" size={16} /> Trekkers: keep all your bookings in one account
        </li>
      </ul>
    </aside>
  );
}

/** Where to go after signing in: `?next=` (same-site paths only), else the dashboard. */
function useNext(): string {
  const next = useSearchParams().get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

function PasswordAuth() {
  const router = useRouter();
  const params = useSearchParams();
  const next = useNext();
  const [mode, setMode] = useState<'signin' | 'signup'>(
    params.get('mode') === 'signup' ? 'signup' : 'signin',
  );
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === 'signup') {
        await signUpWithPassword(form.email, form.password, form.fullName.trim() || undefined);
      } else {
        await signInWithPassword(form.email, form.password);
      }
      router.push(next);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not reach Ohviana. Please try again.',
      );
      setPending(false);
    }
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 16 }}>
      <div>
        <h1 style={{ fontSize: '1.7rem', marginBottom: 4 }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {mode === 'signup'
            ? 'It takes a minute — no email confirmation needed.'
            : 'Sign in with your email and password.'}
        </p>
      </div>
      <div className="segmented" role="group" aria-label="Sign in or create account">
        <button type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
          Sign in
        </button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
          Create account
        </button>
      </div>
      {mode === 'signup' && (
        <div className="field">
          <label htmlFor="fullName">Your name</label>
          <div className="input-icon">
            <Icon name="user" />
            <input
              id="fullName"
              autoComplete="name"
              value={form.fullName}
              onChange={set('fullName')}
            />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <div className="input-icon">
          <Icon name="inbox" />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="input-icon">
          <Icon name="shield" />
          <input
            id="password"
            type="password"
            required
            minLength={mode === 'signup' ? 8 : 1}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={form.password}
            onChange={set('password')}
          />
        </div>
        {mode === 'signup' && <span className="hint">At least 8 characters.</span>}
      </div>
      {error && (
        <p className="notice danger small" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}

/** TEMPORARY testing login (NEXT_PUBLIC_AUTH_MODE=dev): no password, no email. */
function DevLogin() {
  const router = useRouter();
  const next = useNext();
  const [email, setEmail] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setDevUser(email);
    router.push(next);
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <h1 style={{ fontSize: '1.7rem', margin: 0 }}>Sign in</h1>
      <p className="notice warn small" style={{ margin: 0 }}>
        Testing mode: enter any email to sign in instantly — no password and no email is sent.
      </p>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">Sign in</button>
    </form>
  );
}

function MagicLinkLogin() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
      setState(error ? { error: error.message } : 'sent');
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'Sign-in failed' });
    }
  }

  if (state === 'sent') {
    return (
      <p>
        Check <strong>{email}</strong> for a sign-in link. Open it in this browser.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="stack">
      <h1 style={{ fontSize: '1.7rem', margin: 0 }}>Sign in</h1>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {typeof state === 'object' && <p className="error">{state.error}</p>}
    </form>
  );
}
