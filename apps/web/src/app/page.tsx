import Link from 'next/link';
import { PublicTrekList } from '@ohviana/contracts';
import { Icon } from '@/components/Icon';
import { Mountains } from '@/components/Mountains';
import { SearchForm, thisWeekend } from '@/components/SearchForm';
import { TrekCard } from '@/components/TrekCard';
import { apiFetch, qs } from '@/lib/api';

export const revalidate = 60;

export default async function HomePage() {
  const treks = await apiFetch('/v1/treks?limit=6', PublicTrekList, {
    next: { revalidate: 60 },
  }).catch(() => null);
  const weekend = thisWeekend();

  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="badge glass">
            <Icon name="shield" size={14} /> Verified trek organizers only
          </span>
          <h1 style={{ marginTop: 16 }}>
            Find your next <em>weekend trek</em> and book in minutes
          </h1>
          <p className="lead">
            Compare dated departures across organizers — price, pickup points, inclusions and seats
            left, side by side.
          </p>
        </div>
        <Mountains className="hero-mountains" />
      </section>

      <div className="container" style={{ paddingTop: 0 }}>
        <div className="search-card">
          <SearchForm />
          <div className="chips">
            <Link className="chip" href={`/search${qs({ from: weekend.from, to: weekend.to })}`}>
              <Icon name="sun" size={15} /> This weekend
            </Link>
            <Link className="chip" href="/search?difficulty=easy">
              <Icon name="sparkle" size={15} /> Beginner friendly
            </Link>
            <Link className="chip" href="/search?difficulty=difficult">
              <Icon name="mountain" size={15} /> Challenging climbs
            </Link>
            <Link className="chip" href="/search">
              <Icon name="grid" size={15} /> All treks
            </Link>
          </div>
        </div>

        <div className="stack-lg" style={{ marginTop: 48 }}>
          <section className="stack">
            <div className="section-head">
              <div>
                <span className="eyebrow">Popular right now</span>
                <h2>Treks people are booking</h2>
              </div>
              <Link href="/search" className="cluster small" style={{ gap: 4 }}>
                See all treks <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            {treks === null ? (
              <p className="notice warn">
                We couldn&apos;t load treks right now. Please try again shortly.
              </p>
            ) : treks.items.length === 0 ? (
              <div className="empty-state">
                <span className="icon-circle">
                  <Icon name="mountain" size={26} />
                </span>
                <strong>Treks are coming soon</strong>
                <span className="muted small">Organizers are adding their departures.</span>
              </div>
            ) : (
              <div className="grid-cards">
                {treks.items.map((t) => (
                  <TrekCard key={t.id} trek={t} />
                ))}
              </div>
            )}
          </section>

          <section className="stack">
            <div>
              <span className="eyebrow">How it works</span>
              <h2>Booking a trek, the easy way</h2>
            </div>
            <div className="grid-cards">
              <div className="card feature">
                <span className="icon-circle">
                  <Icon name="search" size={22} />
                </span>
                <div>
                  <h3>Search &amp; compare</h3>
                  <p className="muted small" style={{ margin: 0 }}>
                    See every departure for a trek — dates, prices, pickups and what&apos;s
                    included.
                  </p>
                </div>
              </div>
              <div className="card feature">
                <span className="icon-circle sun">
                  <Icon name="ticket" size={22} />
                </span>
                <div>
                  <h3>Book your seats</h3>
                  <p className="muted small" style={{ margin: 0 }}>
                    Pick your pickup point, add travellers and confirm — no account needed.
                  </p>
                </div>
              </div>
              <div className="card feature">
                <span className="icon-circle">
                  <Icon name="zap" size={22} />
                </span>
                <div>
                  <h3>Instant confirmation</h3>
                  <p className="muted small" style={{ margin: 0 }}>
                    Seats are held the moment you book. Get your trek pass with a booking reference.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="cta-band">
            <div className="stack" style={{ gap: 4 }}>
              <h2 style={{ margin: 0, color: '#fff' }}>Run treks? List them on Ohviana.</h2>
              <p>
                Reach new trekkers, manage departures and attendees, and share your own booking
                links — free.
              </p>
            </div>
            <Link href="/dashboard" className="btn sun">
              List your treks <Icon name="arrowRight" size={16} />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
