import Link from 'next/link';
import type { PublicBatch } from '@ohviana/contracts';
import { dateTime, durationLabel, longDate, price, seatsLabel } from '@/lib/format';
import { Icon } from './Icon';
import { PhotoGallery } from './PhotoGallery';

/** Everything a customer needs to decide: itinerary, inclusions, pickups, policy. */
export function BatchDetails({ batch, via }: { batch: PublicBatch; via?: string | undefined }) {
  const viaQs = via ? `?via=${encodeURIComponent(via)}` : '';
  const t = batch.trek;
  return (
    <div className="two-col">
      <div className="stack-lg">
        <PhotoGallery photos={t.photos} title={t.title} />
        <header className="stack">
          <span className="small muted">
            <Link href={`/treks/${batch.catalogTrek.slug}`}>{batch.catalogTrek.name}</Link> · by{' '}
            <Link href={`/organizers/${batch.organizer.slug}`}>{batch.organizer.name}</Link>
          </span>
          <h1 style={{ margin: 0 }}>{t.title}</h1>
          {t.summary && (
            <p className="muted" style={{ margin: 0 }}>
              {t.summary}
            </p>
          )}
        </header>

        {t.itinerary.length > 0 && (
          <section className="stack">
            <h2>Itinerary</h2>
            <ol className="timeline">
              {t.itinerary.map((d) => (
                <li key={d.day}>
                  <span className="timeline-day">Day {d.day}</span>
                  <strong>{d.title}</strong>
                  {d.details && <div className="muted small">{d.details}</div>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="info-grid">
          {t.inclusions.length > 0 && (
            <div className="card stack">
              <h3>Included</h3>
              <ul className="check-list small">
                {t.inclusions.map((x) => (
                  <li key={x}>
                    <Icon name="check" size={14} /> {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.exclusions.length > 0 && (
            <div className="card stack">
              <h3>Not included</h3>
              <ul className="check-list small off">
                {t.exclusions.map((x) => (
                  <li key={x}>
                    <Icon name="x" size={14} /> {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.thingsToCarry.length > 0 && (
            <div className="card stack">
              <h3>Things to carry</h3>
              <ul className="check-list small">
                {t.thingsToCarry.map((x) => (
                  <li key={x}>
                    <Icon name="check" size={14} /> {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {batch.pickups.length > 0 && (
          <section className="stack">
            <h2>Pickup points</h2>
            <ul className="card pickup-list">
              {batch.pickups.map((p) => (
                <li key={p.pickupPointId} className="spread">
                  <div className="stack" style={{ gap: 2 }}>
                    <strong className="cluster" style={{ gap: 6 }}>
                      <Icon name="pin" size={15} /> {p.name}
                    </strong>
                    {(p.landmark || p.address) && (
                      <span className="muted small">
                        {[p.landmark, p.address].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div className="cluster small">
                    <span className="badge">{dateTime(p.pickupAt)}</span>
                    {p.mapsUrl && (
                      <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer">
                        Map
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="stack">
          <h2>Cancellation policy</h2>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>
            {t.cancellationPolicy ?? 'Contact the organizer for cancellation terms.'}
          </p>
        </section>
      </div>

      <aside className="card stack sticky book-box">
        <span className="price">
          {price(batch.pricePaise)}
          <small> /person</small>
        </span>
        <dl className="kv small">
          <dt>Departs</dt>
          <dd>{dateTime(batch.departureAt)}</dd>
          <dt>Returns</dt>
          <dd>{longDate(batch.returnAt)}</dd>
          <dt>Duration</dt>
          <dd>{durationLabel(batch.departureAt, batch.returnAt)}</dd>
          <dt>Book by</dt>
          <dd>{dateTime(batch.bookingCutoffAt)}</dd>
          <dt>Seats</dt>
          <dd>{seatsLabel(batch.seatsLeft)}</dd>
        </dl>
        {batch.availability === 'available' ? (
          <Link href={`/book/${batch.id}${viaQs}`} className="btn">
            Book seats
          </Link>
        ) : (
          <p className="notice warn small" style={{ margin: 0 }}>
            {batch.availability === 'sold_out'
              ? 'This departure is sold out.'
              : 'Bookings for this departure have closed.'}{' '}
            <Link href={`/treks/${batch.catalogTrek.slug}`}>See other dates</Link>
          </p>
        )}
      </aside>
    </div>
  );
}
