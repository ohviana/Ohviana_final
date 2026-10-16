import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicOrganizerList, PublicTrekList } from '@ohviana/contracts';
import { DIFFICULTIES } from '@ohviana/shared';
import { Icon } from '@/components/Icon';
import { SearchForm } from '@/components/SearchForm';
import { TrekCard } from '@/components/TrekCard';
import { ApiError, apiFetch, qs } from '@/lib/api';
import { isoDay, one, searchText, type SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Search treks',
  // Result pages for arbitrary queries shouldn't be indexed; trek pages are the canonical ones.
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const query = searchText(sp.query);
  const from = isoDay(sp.from);
  const to = isoDay(sp.to);
  const cursor = one(sp.cursor);
  const difficultyRaw = one(sp.difficulty);
  const difficulty = DIFFICULTIES.includes(difficultyRaw as never) ? difficultyRaw : undefined;

  let error: string | null = null;
  const [treks, organizers] = await Promise.all([
    apiFetch(`/v1/treks${qs({ query, from, to, difficulty, cursor, limit: 24 })}`, PublicTrekList, {
      next: { revalidate: 30 },
    }).catch((err: unknown) => {
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

  const dateQuery = qs({ from, to });
  const hasDates = !!(from || to);

  return (
    <div className="container stack-lg">
      <div className="stack">
        <h1 style={{ margin: 0 }}>
          {query
            ? `Results for “${query}”`
            : difficulty === 'easy'
              ? 'Beginner-friendly treks'
              : 'Explore treks'}
        </h1>
        <div className="card">
          <SearchForm query={query} from={from} to={to} difficulty={difficulty} />
          {difficulty && (
            <div className="chips">
              <span
                className="chip"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <Icon name="check" size={14} /> Difficulty: {difficulty}
              </span>
              <Link className="chip" href={`/search${qs({ query, from, to })}`}>
                Clear filter
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

      {treks && (
        <section className="stack">
          <h2>
            Treks{hasDates && <span className="muted small"> with departures in your dates</span>}
          </h2>
          {treks.items.length === 0 ? (
            <p className="muted">
              No treks match{hasDates ? ' those dates' : ''}. Try a different name
              {hasDates ? ' or widen the dates' : ''}.
            </p>
          ) : (
            <div className="grid-cards">
              {treks.items.map((t) => (
                <TrekCard key={t.id} trek={t} dateQuery={dateQuery} />
              ))}
            </div>
          )}
          {treks.nextCursor && (
            <Link
              className="btn secondary"
              href={`/search${qs({ query, from, to, difficulty, cursor: treks.nextCursor })}`}
            >
              More treks
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
