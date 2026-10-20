import Link from 'next/link';
import type { CustomerBooking } from '@ohviana/contracts';
import { dateRange, dateTime, dateTimeIst, price } from '@/lib/format';

/** Read-only booking summary shared by the confirmation page and "My bookings". */
export function BookingView({
  booking,
  hideHeader = false,
}: {
  booking: CustomerBooking;
  /** When shown inside a ticket that already displays the reference and status. */
  hideHeader?: boolean;
}) {
  const b = booking;
  return (
    <div className="stack">
      {!hideHeader && (
        <div className="spread">
          <span className="reference">{b.bookingReference}</span>
          {b.status === 'confirmed' ? (
            <span className="badge ok">Confirmed</span>
          ) : (
            <span className="badge danger">Cancelled</span>
          )}
        </div>
      )}
      <dl className="kv">
        <dt>Trek</dt>
        <dd>
          {b.batch.trekTitle} <span className="muted">({b.batch.catalogTrekName})</span>
        </dd>
        <dt>Organizer</dt>
        <dd>
          <Link href={`/organizers/${b.batch.organizer.slug}`}>{b.batch.organizer.name}</Link>
        </dd>
        <dt>Dates</dt>
        <dd>
          {dateRange(b.batch.departureAt, b.batch.returnAt)} · departs{' '}
          {dateTimeIst(b.batch.departureAt)}
        </dd>
        {b.pickup && (
          <>
            <dt>Pickup</dt>
            <dd>
              {b.pickup.name} at {dateTimeIst(b.pickup.pickupAt)}
            </dd>
          </>
        )}
        <dt>Travellers</dt>
        <dd>
          <ol className="plain" style={{ margin: 0 }}>
            {b.guests.map((g, i) => (
              <li key={i}>
                {g.fullName}
                {/* Only worth showing when this traveller boards somewhere else. */}
                {g.pickup && g.pickup.name !== b.pickup?.name && (
                  <span className="muted small">
                    {' '}
                    · boards at {g.pickup.name}, {dateTimeIst(g.pickup.pickupAt)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </dd>
        <dt>Total</dt>
        <dd>
          {price(b.totalPaise)}{' '}
          <span className="muted small">
            ({b.quantity} × {price(b.unitPricePaise)})
          </span>
        </dd>
        <dt>Contact</dt>
        <dd>
          {b.contact.name} · {b.contact.phone}
          {b.contact.email && ` · ${b.contact.email}`}
        </dd>
      </dl>
      {b.status === 'cancelled' && (
        <p className="notice small" style={{ margin: 0 }}>
          Cancelled {b.cancelledAt && dateTime(b.cancelledAt)}
          {b.cancelReason && ` — ${b.cancelReason}`}
        </p>
      )}
    </div>
  );
}
