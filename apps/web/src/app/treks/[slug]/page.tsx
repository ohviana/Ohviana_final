import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicBatchList, PublicTrekDetail } from '@ohviana/contracts';
import { BatchFilters } from '@/components/BatchFilters';
import { BatchList } from '@/components/BatchList';
import { Icon } from '@/components/Icon';
import { Mountains } from '@/components/Mountains';
import { ApiError, apiFetch, apiFetchOrNotFound, qs } from '@/lib/api';
import { price } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { isoDay, one, type SearchParams } from '@/lib/params';

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
    `Compare ${trek.name} trek departures${where ? ` in ${where}` : ''} from verified organizers.`;
  return {
    title: `${trek.name} trek — compare departures`,
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
  const sp = await searchParams;
  const from = isoDay(sp.from);
  const to = isoDay(sp.to);
  const sort = one(sp.sort) === 'price_asc' ? 'price_asc' : 'departure_asc';
  const includeUnavailable = one(sp.includeUnavailable) === 'true';
  const cursor = one(sp.cursor);

  const trek = await getTrek(slug);
  let listError: string | null = null;
  const batches = await apiFetch(
    `/v1/treks/${encodeURIComponent(slug)}/batches${qs({
      from,
      to,
      sort,
      cursor,
      includeUnavailable: includeUnavailable ? 'true' : undefined,
      limit: 20,
    })}`,
    PublicBatchList,
    { next: { revalidate: 30 } },
  ).catch((err: unknown) => {
    listError =
      err instanceof ApiError && err.status === 400
        ? err.message
        : 'Departures are unavailable right now.';
    return null;
  });

  const a = trek.availability;
  const facts = [
    trek.district && ['District', trek.district],
    trek.state && ['State', trek.state],
    trek.difficulty && ['Difficulty', trek.difficulty],
    trek.maxAltitudeM && ['Highest point', `${trek.maxAltitudeM.toLocaleString('en-IN')} m`],
  ].filter(Boolean) as [string, string][];

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
        <div className="two-col">
          <section className="stack" aria-labelledby="departures">
            <h2 id="departures">Compare departures</h2>
            <BatchFilters
              action={`/treks/${trek.slug}`}
              from={from}
              to={to}
              sort={sort}
              includeUnavailable={includeUnavailable}
            />
            {listError && <p className="notice danger">{listError}</p>}
            {batches &&
              (batches.items.length === 0 ? (
                <div className="empty-state">
                  <span className="icon-circle">
                    <Icon name="calendar" size={26} />
                  </span>
                  <strong>No departures match</strong>
                  <span className="muted small">
                    Try other dates, or include sold-out departures.
                  </span>
                </div>
              ) : (
                <>
                  <BatchList batches={batches.items} />
                  {batches.nextCursor && (
                    <Link
                      className="btn secondary"
                      href={`/treks/${trek.slug}${qs({
                        from,
                        to,
                        sort,
                        includeUnavailable: includeUnavailable ? 'true' : undefined,
                        cursor: batches.nextCursor,
                      })}`}
                    >
                      More departures
                    </Link>
                  )}
                </>
              ))}
          </section>

          <aside className="card stack sticky">
            <h2>About this trek</h2>
            {facts.length > 0 && (
              <dl className="kv">
                {facts.map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd style={{ textTransform: k === 'Difficulty' ? 'capitalize' : undefined }}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {trek.description && (
              <p className="small" style={{ whiteSpace: 'pre-line', margin: 0 }}>
                {trek.description}
              </p>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
