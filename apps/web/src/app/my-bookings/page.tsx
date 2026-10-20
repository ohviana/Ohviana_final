'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MyBookingList, type CustomerBooking } from '@ohviana/contracts';
import { AccountStrip } from '@/components/AccountStrip';
import { BookingView } from '@/components/BookingView';
import { PhoneSignIn } from '@/components/PhoneSignIn';
import { apiFetch } from '@/lib/api';
import { authHeader, onAuthChange } from '@/lib/session';

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'ready'; items: CustomerBooking[] }
  | { kind: 'error' };

export default function MyBookingsPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    const load = async () => {
      const headers = await authHeader();
      if (Object.keys(headers).length === 0) return setState({ kind: 'signed-out' });
      try {
        const list = await apiFetch('/v1/me/bookings?limit=50', MyBookingList, {
          headers,
          cache: 'no-store',
        });
        setState({ kind: 'ready', items: list.items });
      } catch {
        setState({ kind: 'error' });
      }
    };
    void load();
    return onAuthChange(() => void load());
  }, []);

  return (
    <div className="container narrow stack-lg">
      <header className="stack" style={{ gap: 8 }}>
        <h1 style={{ margin: 0 }}>My bookings</h1>
        {state.kind === 'ready' && <AccountStrip />}
      </header>
      {state.kind === 'loading' && <p className="muted">Loading…</p>}
      {state.kind === 'signed-out' && (
        <div className="card stack" style={{ maxWidth: 420 }}>
          <p style={{ margin: 0 }}>Sign in with your mobile number to see your bookings.</p>
          <PhoneSignIn />
        </div>
      )}
      {state.kind === 'error' && <p className="notice danger">Could not load your bookings.</p>}
      {state.kind === 'ready' &&
        (state.items.length === 0 ? (
          <p className="muted">
            No bookings yet. <Link href="/search">Find a trek</Link>
          </p>
        ) : (
          state.items.map((b) => (
            <Link
              key={b.bookingReference}
              href={`/bookings/${b.bookingReference}`}
              className="card"
            >
              <BookingView booking={b} />
            </Link>
          ))
        ))}
    </div>
  );
}
