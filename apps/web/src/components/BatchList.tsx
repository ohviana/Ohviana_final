import Link from 'next/link';
import type { PublicBatch } from '@ohviana/contracts';
import { IST, dateRange, dateTime, durationLabel, price, seatsLabel } from '@/lib/format';
import { Avatar } from './dash/ui';
import { Icon } from './Icon';

interface Props {
  batches: PublicBatch[];
  /** Hide the organizer name (e.g. on that organizer's own page). */
  showOrganizer?: boolean;
  /** Hide the trek name (e.g. on that trek's page). */
  showTrek?: boolean;
  /** Direct-link token to carry into checkout. */
  via?: string | undefined;
  /**
   * All rows share one departure day (trek page with a date chosen): lead with the organizer
   * instead of the date.
   */
  byOrganizer?: boolean;
}

function AvailabilityBadge({ b }: { b: PublicBatch }) {
  if (b.availability === 'sold_out') return <span className="badge danger">Sold out</span>;
  if (b.availability === 'booking_closed') return <span className="badge">Booking closed</span>;
  return (
    <span className={`badge ${b.seatsLeft <= 5 ? 'warn' : 'ok'}`}>
      <Icon name="users" size={13} /> {seatsLabel(b.seatsLeft)}
    </span>
  );
}

function DateBlock({ iso }: { iso: string }) {
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, ...opts });
  return (
    <div className="date-block" aria-hidden="true">
      <span className="dow">{part({ weekday: 'short' })}</span>
      <span className="day">{part({ day: 'numeric' })}</span>
      <span className="mon">{part({ month: 'short' })}</span>
    </div>
  );
}

/** Departure comparison, one card per departure (date · details · price & book). */
export function BatchList({
  batches,
  showOrganizer = true,
  showTrek = false,
  via,
  byOrganizer = false,
}: Props) {
  const viaQs = via ? `?via=${encodeURIComponent(via)}` : '';
  return (
    <ul className="batch-list">
      {batches.map((b) => (
        <li
          key={b.id}
          className={`card batch-row${b.availability === 'available' ? '' : ' muted-row'}`}
        >
          {byOrganizer ? <Avatar name={b.organizer.name} /> : <DateBlock iso={b.departureAt} />}
          {byOrganizer ? (
            <div className="stack" style={{ gap: 4 }}>
              <span className="when meta-line">
                <Link href={`/organizers/${b.organizer.slug}`}>{b.organizer.name}</Link>
                <span className="verified" title="Verified by Ohviana">
                  <Icon name="shield" size={14} />
                </span>
              </span>
              <span className="meta-line">
                <Icon name="clock" size={14} />
                <span>
                  Departs {dateTime(b.departureAt)} · {durationLabel(b.departureAt, b.returnAt)}
                  {b.trek.startPoint && ` · from ${b.trek.startPoint}`}
                </span>
              </span>
            </div>
          ) : (
            <div className="stack" style={{ gap: 4 }}>
              <span className="when">
                {showTrek ? b.trek.title : dateRange(b.departureAt, b.returnAt)}
              </span>
              <span className="meta-line">
                <Icon name="clock" size={14} />
                <span>
                  Departs {dateTime(b.departureAt)} · {durationLabel(b.departureAt, b.returnAt)}
                </span>
              </span>
              {showOrganizer && (
                <span className="meta-line">
                  <Link href={`/organizers/${b.organizer.slug}`}>{b.organizer.name}</Link>
                  <span className="verified" title="Verified by Ohviana">
                    <Icon name="shield" size={14} />
                  </span>
                </span>
              )}
            </div>
          )}
          <div className="stack small batch-row-extra" style={{ gap: 6 }}>
            {b.pickups.length > 0 && (
              <span className="meta-line">
                <Icon name="pin" size={14} />
                <span>{b.pickups.map((p) => p.name).join(' · ')}</span>
              </span>
            )}
            {b.trek.inclusions.length > 0 && (
              <span className="meta-line">
                <Icon name="check" size={14} />
                <span>{b.trek.inclusions.slice(0, 3).join(' · ')}</span>
              </span>
            )}
          </div>
          <div className="actions">
            <div style={{ textAlign: 'right' }}>
              <span className="price">{price(b.pricePaise)}</span>
              <div className="small muted">per person</div>
            </div>
            <AvailabilityBadge b={b} />
            <div className="cluster">
              <Link href={`/batches/${b.id}${viaQs}`} className="small">
                Details
              </Link>
              {b.availability === 'available' && (
                <Link href={`/book/${b.id}${viaQs}`} className="btn small">
                  Book
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
