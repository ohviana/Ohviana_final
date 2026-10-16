'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MeResponse } from '@ohviana/contracts';
import { authedFetch } from '@/lib/authed';
import { isSignedIn, onAuthChange } from '@/lib/session';

type State = { kind: 'unknown' } | { kind: 'signed-out' } | { kind: 'signed-in'; isAdmin: boolean };

/** Header links that depend on whether someone is signed in (and is an admin). */
export function AuthNav() {
  const [state, setState] = useState<State>({ kind: 'unknown' });

  useEffect(() => {
    const refresh = async () => {
      if (!(await isSignedIn())) return setState({ kind: 'signed-out' });
      try {
        const me = await authedFetch('/v1/me', MeResponse);
        setState({ kind: 'signed-in', isAdmin: me.isAdmin });
      } catch {
        setState({ kind: 'signed-in', isAdmin: false });
      }
    };
    void refresh();
    return onAuthChange(() => void refresh());
  }, []);

  if (state.kind === 'unknown') return null;
  if (state.kind === 'signed-out') {
    return (
      <>
        <Link href="/login">Sign in</Link>
        <Link href="/dashboard" className="nav-cta">
          List your treks
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/my-bookings">My bookings</Link>
      {state.isAdmin && <Link href="/admin">Admin</Link>}
      <Link href="/account">Account</Link>
      <Link href="/dashboard" className="nav-cta">
        Dashboard
      </Link>
    </>
  );
}
