import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicBatchList, PublicOrganizerDetail } from '@ohviana/contracts';
import { DepartureGroups, OrgMark } from '@/components/DepartureGroups';
import { Icon, type IconName } from '@/components/Icon';
import { apiFetch, apiFetchOrNotFound, qs } from '@/lib/api';
import { one, type SearchParams } from '@/lib/params';

type Params = Promise<{ slug: string }>;

/** Departures fetched per page; grouped by day on screen. */
const PAGE = 40;

const getOrganizer = (slug: string) =>
  apiFetchOrNotFound(`/v1/organizers/${encodeURIComponent(slug)}`, PublicOrganizerDetail, {
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

/** An organizer's public page: who they are, their track record, and their departures. */
export default async function OrganizerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const cursor = one((await searchParams).cursor);

  const o = await getOrganizer(slug);
  const batches = await apiFetch(
    `/v1/organizers/${encodeURIComponent(slug)}/batches${qs({ cursor, limit: PAGE })}`,
    PublicBatchList,
    { next: { revalidate: 30 } },
  ).catch(() => null);

  // A brand-new organizer's zeros say nothing good: show their record once they have one.
  const isNew = o.stats.completedBatches === 0;
  const stats: { icon: IconName; value: string; label: string; hide?: boolean }[] = [
    {
      hide: isNew,
      icon: 'check',
      value: o.stats.completedBatches.toLocaleString('en-IN'),
      label: o.stats.completedBatches === 1 ? 'trek completed' : 'treks completed',
    },
    {
      hide: isNew,
      icon: 'users',
      value: o.stats.trekkersHosted.toLocaleString('en-IN'),
      label: o.stats.trekkersHosted === 1 ? 'trekker hosted' : 'trekkers hosted',
    },
    {
      icon: 'mountain',
      value: o.stats.treksOffered.toLocaleString('en-IN'),
      label: o.stats.treksOffered === 1 ? 'trek offered' : 'treks offered',
    },
    { icon: 'calendar', value: String(o.upcomingBatchCount), label: 'upcoming departures' },
  ];

  return (
    <div className="container stack-lg">
      <header className="card org-hero">
        <OrgMark name={o.name} logoUrl={o.logoUrl} size={84} />
        <div className="stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="cluster" style={{ gap: 6 }}>
            <span className="badge ok">
              <Icon name="shield" size={13} /> Verified organizer
            </span>
            {isNew && <span className="badge warn">New on Ohviana</span>}
          </span>
          <h1 style={{ margin: 0 }}>{o.name}</h1>
          {o.tagline && (
            <p className="lead" style={{ margin: 0 }}>
              {o.tagline}
            </p>
          )}
          <span className="small muted">
            {[o.city && `Based in ${o.city}`, `On Ohviana since ${o.stats.memberSince}`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </header>

      <ul className="org-stats" aria-label="Track record">
        {stats
          .filter((s) => !s.hide)
          .map((s) => (
            <li key={s.label} className="card">
              <Icon name={s.icon} size={18} />
              <strong>{s.value}</strong>
              <span className="muted small">{s.label}</span>
            </li>
          ))}
      </ul>

      {o.description && (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>About {o.name}</h2>
          <p style={{ margin: 0, whiteSpace: 'pre-line', maxWidth: 760 }}>{o.description}</p>
        </section>
      )}

      <section className="stack">
        <h2 style={{ margin: 0 }}>Upcoming departures</h2>
        {batches === null ? (
          <p className="notice danger">Departures are unavailable right now.</p>
        ) : batches.items.length === 0 ? (
          <div className="empty-state">
            <span className="icon-circle">
              <Icon name="calendar" size={26} />
            </span>
            <strong>No upcoming departures right now</strong>
            <span className="muted small">{o.name} adds new dates regularly. Check back soon.</span>
          </div>
        ) : (
          <>
            <DepartureGroups batches={batches.items} />
            {batches.nextCursor && (
              <Link
                className="btn secondary"
                style={{ alignSelf: 'flex-start' }}
                href={`/organizers/${o.slug}${qs({ cursor: batches.nextCursor })}`}
              >
                Later departures →
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
