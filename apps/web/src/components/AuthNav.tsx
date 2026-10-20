'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isSignedIn, onAuthChange } from '@/lib/session';

type State = { kind: 'unknown' } | { kind: 'signed-out' } | { kind: 'signed-in' };

/**
 * Header links that depend on who is signed in. The marketplace header is the same for
 * everyone: organizers and admins reach their consoles from Account or the footer.
 */
export function AuthNav() {
  const [state, setState] = useState<State>({ kind: 'unknown' });

  useEffect(() => {
    const refresh = async () =>
      setState({ kind: (await isSignedIn()) ? 'signed-in' : 'signed-out' });
    void refresh();
    return onAuthChange(() => void refresh());
  }, []);

  if (state.kind === 'unknown') return null;
  if (state.kind === 'signed-out') {
    // Organizers find "List your treks" and "Organizer sign in" in the footer.
    return <Link href="/login">Sign in</Link>;
  }
  return (
    <>
      <Link href="/my-bookings">My bookings</Link>
      <Link href="/account">Account</Link>
    </>
  );
}
