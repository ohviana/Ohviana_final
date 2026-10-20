'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CustomerBooking } from '@ohviana/contracts';
import { BookingView } from '@/components/BookingView';
import { Icon } from '@/components/Icon';
import { ApiError, apiFetch } from '@/lib/api';
import { authHeader, recallBookingToken, rememberBookingToken } from '@/lib/session';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; booking: CustomerBooking; justBooked: boolean }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

/**
 * Reads the guest access token from the URL fragment (right after booking) or this browser.
 * Memoized per reference: consuming the fragment is a side effect (it is removed from the
 * address bar), and React may run effects twice, so the first result must be reused.
 */
const taken = new Map<string, { token: string | null; fromUrl: boolean }>();

function takeToken(reference: string): { token: string | null; fromUrl: boolean } {
  const cached = taken.get(reference);
  if (cached) return cached;
  let result: { token: string | null; fromUrl: boolean };
  const match = /(?:^#|&)t=([^&]+)/.exec(window.location.hash);
  if (match) {
    const token = decodeURIComponent(match[1]!);
    rememberBookingToken(reference, token);
    // Remove the secret from the address bar and history.
    history.replaceState(null, '', window.location.pathname);
    result = { token, fromUrl: true };
  } else {
    result = { token: recallBookingToken(reference), fromUrl: false };
  }
  taken.set(reference, result);
  return result;
}

export function BookingConfirmation({ reference }: { reference: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const headers = useCallback(
    async (): Promise<Record<string, string>> => ({
      ...(await authHeader()),
      ...(token ? { 'x-booking-token': token } : {}),
    }),
    [token],
  );

  useEffect(() => {
    const { token: t, fromUrl } = takeToken(reference);
    setToken(t);
    (async () => {
      try {
        const booking = await apiFetch(
          `/v1/bookings/${encodeURIComponent(reference)}`,
          CustomerBooking,
          {
            headers: { ...(await authHeader()), ...(t ? { 'x-booking-token': t } : {}) },
            cache: 'no-store',
          },
        );
        setState({ kind: 'ready', booking, justBooked: fromUrl });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404))
          setState({ kind: 'missing' });
        else setState({ kind: 'error', message: 'Could not load this booking. Please try again.' });
      }
    })();
  }, [reference]);

  async function cancel() {
    if (!confirm('Cancel this booking? Your seats will be released.')) return;
    setCancelling(true);
    try {
      const booking = await apiFetch(
        `/v1/bookings/${encodeURIComponent(reference)}/cancel`,
        CustomerBooking,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(await headers()) },
          body: JSON.stringify({}),
        },
      );
      setState({ kind: 'ready', booking, justBooked: false });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  if (state.kind === 'loading') return <p className="muted">Loading your booking…</p>;
  if (state.kind === 'error') return <p className="notice danger">{state.message}</p>;
  if (state.kind === 'missing') {
    return (
      <div className="stack">
        <h1>Booking {reference}</h1>
        <p className="muted">
          We can&apos;t show this booking on this device. Open it from the browser you booked with,
          or find it in <Link href="/my-bookings">My bookings</Link> by signing in with the mobile
          number you booked with.
        </p>
      </div>
    );
  }

  const { booking, justBooked } = state;
  const upcoming = Date.parse(booking.batch.departureAt) > Date.now();
  return (
    <div className="stack-lg">
      {justBooked && booking.status === 'confirmed' && (
        <div className="notice ok cluster" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="icon-circle" style={{ width: 40, height: 40 }}>
            <Icon name="check" />
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <strong>You&apos;re booked!</strong>
            <span className="small">
              Save your booking reference. The organizer will contact you on {booking.contact.phone}{' '}
              with trip details.
            </span>
          </div>
        </div>
      )}

      <article className="ticket">
        <div className="ticket-head stack" style={{ gap: 8 }}>
          <div className="spread">
            <span className="cluster small" style={{ gap: 6, fontWeight: 700, opacity: 0.9 }}>
              <Icon name="ticket" size={16} /> TREK PASS
            </span>
            {booking.status === 'confirmed' ? (
              <span className="badge glass">Confirmed</span>
            ) : (
              <span className="badge danger">Cancelled</span>
            )}
          </div>
          <span className="reference">{booking.bookingReference}</span>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{booking.batch.trekTitle}</span>
        </div>
        <div className="ticket-cut" aria-hidden="true" />
        <div className="ticket-body">
          <BookingView booking={booking} hideHeader />
        </div>
      </article>

      {booking.cancellationPolicy && (
        <details className="card small">
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Cancellation policy</summary>
          <p style={{ whiteSpace: 'pre-line', marginTop: 8, marginBottom: 0 }}>
            {booking.cancellationPolicy}
          </p>
        </details>
      )}
      <div className="cluster">
        <button type="button" className="secondary" onClick={() => window.print()}>
          <Icon name="download" size={16} /> Save / print
        </button>
        {booking.status === 'confirmed' && upcoming && (
          <button type="button" className="danger" onClick={cancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        )}
      </div>
    </div>
  );
}
