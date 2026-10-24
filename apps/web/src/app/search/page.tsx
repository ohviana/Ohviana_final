import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicBatchList, PublicOrganizerList } from '@ohviana/contracts';
import { DIFFICULTIES } from '@ohviana/shared';
import { DepartureGroups } from '@/components/DepartureGroups';
import { Icon } from '@/components/Icon';
import { SearchForm } from '@/components/SearchForm';
import { ApiError, apiFetch, qs } from '@/lib/api';
import { isoDay, one, searchText, type SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Explore treks',
  // Result pages for arbitrary queries shouldn't be indexed; trek pages are the canonical ones.
  robots: { index: false, follow: true },
};

/** Departures fetched per page; grouped by day on screen. */
const PAGE = 60;

/**
 * Explore: upcoming departures across every trek, grouped by day, one card per organizer's
 * departure. Filter by text (trek, area, organizer), one date, or the home page chips
 * (`from`/`to` for "This weekend", `difficulty`, `district`).
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const query = searchText(sp.query);
  const date = isoDay(sp.date);
  const from = date ?? isoDay(sp.from);
  const to = date ?? isoDay(sp.to);
  const cursor = one(sp.cursor);
  const difficultyRaw = one(sp.difficulty);
  const difficulty = DIFFICULTIES.includes(difficultyRaw as never) ? difficultyRaw : undefined;
  // "Other treks in <district>" from a trek page.
  const district = one(sp.district)?.trim().slice(0, 80) || undefined;

  let error: string | null = null;
  const [departures, organizers] = await Promise.all([
    apiFetch(
      `/v1/batches${qs({ query, from, to, difficulty, district, cursor, limit: PAGE })}`,
      PublicBatchList,
      { next: { revalidate: 30 } },
    ).catch((err: unknown) => {
      error =
        err instanceof ApiError && err.status === 400
          ? err.message
          : 'Search is unavailable right now.';
      return null;
    }),
    query && !cursor
      ? apiFetch(`/v1/organizers${qs({ query, limit: 6 })}`, PublicOrganizerList, {
          next: { revalidate: 30 },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const filtered = !!(query || from || to || difficulty || district);
  const chips = [
    district && { icon: 'pin' as const, text: `Area: ${district}` },
    difficulty && { icon: 'check' as const, text: `Difficulty: ${difficulty}` },
    !date && (from || to) && { icon: 'calendar' as const, text: 'Selected dates' },
  ].filter((c): c is { icon: 'pin' | 'check' | 'calendar'; text: string } => !!c);

  return (
    <div className="container stack-lg">
      <div className="stack">
        <h1 style={{ margin: 0 }}>
          {query
            ? `Results for “${query}”`
            : district
              ? `Treks in ${district}`
              : difficulty === 'easy'
                ? 'Beginner-friendly treks'
                : 'Explore treks'}
        </h1>
        <div className="card">
          <SearchForm query={query} date={date} difficulty={difficulty} />
          {chips.length > 0 && (
            <div className="chips">
              {chips.map((c) => (
                <span
                  key={c.text}
                  className="chip"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <Icon name={c.icon} size={14} /> {c.text}
                </span>
              ))}
              <Link className="chip" href={`/search${qs({ query, date })}`}>
                Clear {chips.length > 1 ? 'filters' : 'filter'}
              </Link>
            </div>
          )}
        </div>
      </div>

      {error && <p className="notice danger">{error}</p>}

      {organizers && organizers.items.length > 0 && (
        <section className="stack">
          <h2>Organizers</h2>
          <div className="grid-cards">
            {organizers.items.map((o) => (
              <Link key={o.id} href={`/organizers/${o.slug}`} className="card stack">
                <h3 style={{ margin: 0 }}>{o.name}</h3>
                {o.tagline && <span className="muted small">{o.tagline}</span>}
                <span className="small">
                  {o.upcomingBatchCount} upcoming departure{o.upcomingBatchCount === 1 ? '' : 's'}
                  {o.city && <span className="muted"> · {o.city}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {departures &&
        (departures.items.length === 0 ? (
          <div className="empty-state">
            <span className="icon-circle">
              <Icon name="calendar" size={26} />
            </span>
            <strong>No departures {filtered ? 'match' : 'yet'}</strong>
            <span className="muted small">
              {filtered ? 'Try another date, or clear the filters.' : 'Check back soon.'}
            </span>
            {filtered && (
              <Link href="/search" className="btn secondary small">
                See all departures
              </Link>
            )}
          </div>
        ) : (
          <section className="stack">
            <DepartureGroups batches={departures.items} />
            {departures.nextCursor && (
              <Link
                className="btn secondary"
                style={{ alignSelf: 'flex-start' }}
                href={`/search${qs({
                  query,
                  date,
                  from: date ? undefined : from,
                  to: date ? undefined : to,
                  difficulty,
                  district,
                  cursor: departures.nextCursor,
                })}`}
              >
                Later departures →
              </Link>
            )}
          </section>
        ))}
    </div>
  );
}
