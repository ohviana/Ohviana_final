import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicBatchList, PublicTrekDetail } from '@ohviana/contracts';
import { DepartureGroups } from '@/components/DepartureGroups';
import { Icon, type IconName } from '@/components/Icon';
import { Mountains } from '@/components/Mountains';
import { apiFetch, apiFetchOrNotFound, qs } from '@/lib/api';
import { price } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { isoDay, type SearchParams } from '@/lib/params';

/** Departures shown on a trek page (grouped by day); a year of weekly trips from a few organizers. */
const DEPARTURES = 100;

type Params = Promise<{ slug: string }>;

const getTrek = (slug: string) =>
  apiFetchOrNotFound(`/v1/treks/${encodeURIComponent(slug)}`, PublicTrekDetail, {
    next: { revalidate: 60 },
  });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const trek = await getTrek(slug);
  const where = [trek.district, trek.state].filter(Boolean).join(', ');
  const description =
    trek.summary ??
    `Book the ${trek.name} trek${where ? ` in ${where}` : ''} with verified organizers: dates, prices and pickup points.`;
  return {
    title: `${trek.name} trek — dates & prices`,
    description,
    alternates: { canonical: `/treks/${trek.slug}` },
    openGraph: {
      title: `${trek.name} trek`,
      description,
      ...(trek.heroImageUrl ? { images: [trek.heroImageUrl] } : {}),
    },
  };
}

export default async function TrekPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const date = isoDay((await searchParams).date);

  const trek = await getTrek(slug);
  // Every upcoming departure, grouped by day; sold-out ones stay visible (faded).
  const departures = await apiFetch(
    `/v1/treks/${encodeURIComponent(slug)}/batches${qs({
      from: date,
      to: date,
      includeUnavailable: 'true',
      limit: DEPARTURES,
    })}`,
    PublicBatchList,
    { next: { revalidate: 30 } },
  )
    .then((l) => l.items)
    .catch(() => null);

  const a = trek.availability;

  return (
    <>
      <section
        className="page-banner"
        style={
          trek.coverPhoto
            ? {
                background: `linear-gradient(120deg, rgb(4 23 15 / 0.92), rgb(4 23 15 / 0.55) 60%, rgb(4 23 15 / 0.3)), url(${mediaUrl(trek.coverPhoto.url)}) center / cover`,
              }
            : undefined
        }
      >
        <div className="container stack" style={{ gap: 10 }}>
          <nav className="small">
            <Link href="/search">Treks</Link> <span className="muted">/ {trek.name}</span>
          </nav>
          <h1 style={{ margin: 0, color: '#fff' }}>{trek.name}</h1>
          {trek.summary && (
            <p className="muted" style={{ margin: 0, maxWidth: 720, fontSize: '1.05rem' }}>
              {trek.summary}
            </p>
          )}
          <div className="fact-chips">
            {[trek.district, trek.state].filter(Boolean).length > 0 && (
              <span>
                <Icon name="pin" size={14} />{' '}
                {[trek.district, trek.state].filter(Boolean).join(', ')}
              </span>
            )}
            {trek.difficulty && (
              <span style={{ textTransform: 'capitalize' }}>
                <Icon name="mountain" size={14} /> {trek.difficulty}
              </span>
            )}
            {trek.maxAltitudeM && (
              <span>
                <Icon name="trendingUp" size={14} /> {trek.maxAltitudeM.toLocaleString('en-IN')} m
              </span>
            )}
            {a.batchCount > 0 ? (
              <span>
                <Icon name="calendar" size={14} /> {a.batchCount} departure
                {a.batchCount === 1 ? '' : 's'} · {a.organizerCount} organizer
                {a.organizerCount === 1 ? '' : 's'}
              </span>
            ) : (
              <span>No upcoming departures yet</span>
            )}
            {a.minPricePaise !== null && (
              <span style={{ background: '#ffd27a', color: '#3b2600' }}>
                <Icon name="rupee" size={14} /> from {price(a.minPricePaise)}
              </span>
            )}
          </div>
        </div>
        <Mountains className="hero-mountains" />
      </section>

      <div className="container stack-lg" style={{ paddingTop: 8 }}>
        {/* Location, difficulty and altitude are in the banner; departures get the full width. */}
        {trek.description && (
          <section className="card stack">
            <h2 style={{ margin: 0 }}>About this trek</h2>
            <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{trek.description}</p>
          </section>
        )}
        <section id="departures" className="stack" style={{ scrollMarginTop: 80 }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>Upcoming departures</h2>
            {date && (
              <Link href={`/treks/${trek.slug}#departures`} className="small">
                All dates
              </Link>
            )}
          </div>
          {departures === null ? (
            <p className="notice danger">Departures are unavailable right now. Please try again.</p>
          ) : departures.length === 0 ? (
            <div className="empty-state">
              <span className="icon-circle">
                <Icon name="calendar" size={26} />
              </span>
              <strong>No upcoming departures yet</strong>
              <span className="muted small">Organizers add new dates regularly.</span>
            </div>
          ) : (
            <DepartureGroups batches={departures} showTrek={false} />
          )}
        </section>

        <OtherOptions trek={trek} date={date} />
      </div>
    </>
  );
}

/** The way out when no date (or no organizer) fits. */
function OtherOptions({ trek, date }: { trek: PublicTrekDetail; date: string | undefined }) {
  const items: { icon: IconName; title: string; text: string; href: string }[] = [
    ...(date
      ? [
          {
            icon: 'calendar' as const,
            title: 'Try another date',
            text: `See every upcoming date for ${trek.name}.`,
            href: `/treks/${trek.slug}#departures`,
          },
        ]
      : []),
    ...(trek.district
      ? [
          {
            icon: 'pin' as const,
            title: `Other treks in ${trek.district}`,
            text: 'Same area, different dates.',
            href: `/search${qs({ district: trek.district })}`,
          },
        ]
      : []),
    trek.difficulty === 'easy'
      ? {
          icon: 'grid' as const,
          title: 'All treks',
          text: 'Browse every trek with upcoming dates.',
          href: '/search',
        }
      : {
          icon: 'sparkle' as const,
          title: 'Beginner-friendly treks',
          text: 'Easier trails, great for a first trek.',
          href: '/search?difficulty=easy',
        },
    {
      icon: 'mail',
      title: 'Ask us',
      text: 'Tell us the date you want; we’ll check with organizers.',
      href: '/contact',
    },
  ];
  return (
    <section className="stack" aria-labelledby="other-options">
      <h2 id="other-options" style={{ margin: 0 }}>
        {date ? 'Not the right date?' : 'Don’t see a date that works?'}
      </h2>
      <ul className="option-grid">
        {items.map((o) => (
          <li key={o.title}>
            <Link href={o.href} className="card option-card">
              <span className="icon-circle">
                <Icon name={o.icon} size={20} />
              </span>
              <span className="stack" style={{ gap: 2 }}>
                <strong>{o.title}</strong>
                <span className="muted small">{o.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
