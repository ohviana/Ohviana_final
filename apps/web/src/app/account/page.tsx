'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MeResponse } from '@ohviana/contracts';
import { ApiError } from '@/lib/api';
import { authedFetch } from '@/lib/authed';
import { DEV_AUTH, isSignedIn, onAuthChange, signOut } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'ready'; me: MeResponse }
  | { kind: 'error'; message: string };

export default function AccountPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      if (!(await isSignedIn())) return setState({ kind: 'signed-out' });
      try {
        setState({ kind: 'ready', me: await authedFetch('/v1/me', MeResponse) });
      } catch (err) {
        const message =
          err instanceof ApiError ? `${err.code}: ${err.message}` : 'Could not reach the API';
        setState({ kind: 'error', message });
      }
    }
    void load();
    return onAuthChange(() => void load());
  }, []);

  // Dev convenience: paste into the API docs' "Authorize" dialog to try authenticated endpoints.
  async function copyToken() {
    const { data } = await getSupabase().auth.getSession();
    if (!data.session) return;
    await navigator.clipboard.writeText(data.session.access_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="container narrow">
      <h1>My account</h1>
      {state.kind === 'loading' && <p className="muted">Loading…</p>}
      {state.kind === 'signed-out' && (
        <p>
          You are signed out. <Link href="/login">Sign in</Link>
        </p>
      )}
      {state.kind === 'error' && <p className="error">{state.message}</p>}
      {state.kind === 'ready' && (
        <div className="stack">
          <dl>
            <dt>Email</dt>
            <dd>{state.me.user.email ?? '—'}</dd>
            <dt>Name</dt>
            <dd>{state.me.user.fullName ?? '—'}</dd>
            <dt>User ID</dt>
            <dd>
              <code>{state.me.user.id}</code>
            </dd>
            <dt>Platform admin</dt>
            <dd>{state.me.isAdmin ? 'Yes' : 'No'}</dd>
            <dt>Organizers</dt>
            <dd>
              {state.me.memberships.length === 0
                ? 'None'
                : state.me.memberships.map((m) => `${m.name} (${m.role}, ${m.status})`).join(', ')}
            </dd>
          </dl>
          {DEV_AUTH ? (
            <p className="small muted" style={{ margin: 0 }}>
              Testing mode: to call the API from the docs page, send the header{' '}
              <code>x-dev-user: {state.me.user.email}</code>.
            </p>
          ) : (
            process.env.NODE_ENV !== 'production' && (
              <button type="button" className="secondary" onClick={copyToken}>
                {copied ? 'Copied — valid for about 1 hour' : 'Copy access token (dev only)'}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => void signOut().then(() => setState({ kind: 'signed-out' }))}
          >
            Sign out
          </button>
        </div>
      )}
    </main>
  );
}
