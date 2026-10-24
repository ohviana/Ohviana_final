import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicBatchList, PublicOrganizerList, type PublicBatch } from '@ohviana/contracts';
import { DIFFICULTIES } from '@ohviana/shared';
import { DepartureGroups } from '@/components/DepartureGroups';
import { Icon } from '@/components/Icon';
import { SearchForm } from '@/components/SearchForm';
import { ApiError, apiFetch, qs } from '@/lib/api';
import { todayIst } from '@/lib/format';
import { isoDay, one, searchText, type SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Explore treks',
  // Result pages for arbitrary queries shouldn't be indexed; trek pages are the canonical ones.
  robots: { index: false, follow: true },
};

/** Departures fetched per page; grouped by day on screen. */
const PAGE = 60;
/** The summary line covers this many days from today when nothing is filtered. */
const SUMMARY_DAYS = 28;

/** "24 departures · 6 treks · 4 verified organizers": counted from the listed departures. */
function summarize(items: PublicBatch[], more: boolean) {
  const n = (count: number, one: string, many = `${one}s`) =>
    `${count}${more ? '+' : ''} ${count === 1 && !more ? one : many}`;
  return {
    departures: n(items.length, 'departure'),
    treks: n(new Set(items.map((b) => b.catalogTrek.id)).size, 'trek'),
    organizers: n(new Set(items.map((b) => b.organizer.id)).size, 'verified organizer'),
  };
}

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

  const filtered = !!(query || from || to || difficulty || district);
  const today = todayIst();
  const summaryEnd = new Date(Date.parse(`${today}T00:00:00Z`) + (SUMMARY_DAYS - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let error: string | null = null;
  const [departures, organizers, upcoming] = await Promise.all([
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
    // Unfiltered: the next four weeks across Ohviana, for the summary line.
    filtered || cursor
      ? Promise.resolve(null)
      : apiFetch(`/v1/batches${qs({ from: today, to: summaryEnd, limit: 100 })}`, PublicBatchList, {
          next: { revalidate: 60 },
        }).catch(() => null),
  ]);

  const summary = upcoming
    ? summarize(upcoming.items, !!upcoming.nextCursor)
    : departures && filtered && !cursor && departures.items.length > 0
      ? summarize(departures.items, !!departures.nextCursor)
      : null;
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

      {summary && (
        <p className="explore-summary">
          <span>
            <strong>{summary.departures}</strong>
          </span>
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <span>
            <strong>{summary.treks}</strong>
          </span>
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <span className="cluster" style={{ gap: 5 }}>
            <Icon name="shield" size={15} />
            <strong>{summary.organizers}</strong>
          </span>
          <span className="muted">{upcoming ? 'in the next 4 weeks' : 'match your search'}</span>
        </p>
      )}

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
