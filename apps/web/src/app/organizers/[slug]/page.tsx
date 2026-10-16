import type { Metadata } from 'next';
import { PublicBatchList, PublicOrganizer } from '@ohviana/contracts';
import { BatchFilters } from '@/components/BatchFilters';
import { BatchList } from '@/components/BatchList';
import { apiFetch, apiFetchOrNotFound, qs } from '@/lib/api';
import { isoDay, one, type SearchParams } from '@/lib/params';
import Link from 'next/link';

type Params = Promise<{ slug: string }>;

const getOrganizer = (slug: string) =>
  apiFetchOrNotFound(`/v1/organizers/${encodeURIComponent(slug)}`, PublicOrganizer, {
    next: { revalidate: 60 },
  });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const o = await getOrganizer((await params).slug);
  return {
    title: `${o.name} — trek departures`,
    description:
      o.tagline ?? `Upcoming trek departures by ${o.name}${o.city ? `, ${o.city}` : ''}.`,
    alternates: { canonical: `/organizers/${o.slug}` },
  };
}

export default async function OrganizerPage({
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
  const cursor = one(sp.cursor);

  const organizer = await getOrganizer(slug);
  const batches = await apiFetch(
    `/v1/organizers/${encodeURIComponent(slug)}/batches${qs({ from, to, sort, cursor, limit: 20 })}`,
    PublicBatchList,
    { next: { revalidate: 30 } },
  ).catch(() => null);

  return (
    <div className="container stack-lg">
      <header className="stack">
        <span className="badge ok" style={{ alignSelf: 'flex-start' }}>
          Verified organizer
        </span>
        <h1 style={{ margin: 0 }}>{organizer.name}</h1>
        {organizer.tagline && (
          <p className="muted" style={{ margin: 0 }}>
            {organizer.tagline}
          </p>
        )}
        {organizer.city && <span className="small muted">Based in {organizer.city}</span>}
      </header>

      {organizer.description && (
        <p style={{ maxWidth: 720, whiteSpace: 'pre-line' }}>{organizer.description}</p>
      )}

      <section className="stack">
        <h2>Upcoming departures</h2>
        <BatchFilters action={`/organizers/${organizer.slug}`} from={from} to={to} sort={sort} />
        {batches === null ? (
          <p className="notice danger">Departures are unavailable right now.</p>
        ) : batches.items.length === 0 ? (
          <p className="muted">No upcoming departures{from || to ? ' in those dates' : ''}.</p>
        ) : (
          <>
            <BatchList batches={batches.items} showOrganizer={false} showTrek />
            {batches.nextCursor && (
              <Link
                className="btn secondary"
                href={`/organizers/${organizer.slug}${qs({ from, to, sort, cursor: batches.nextCursor })}`}
              >
                More departures
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
