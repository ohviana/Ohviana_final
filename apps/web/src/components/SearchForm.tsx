import { todayIst } from '@/lib/format';
import { Icon } from './Icon';

interface Props {
  query?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  difficulty?: string | undefined;
}

/** Plain GET form: works before (and without) JavaScript, and the URL is shareable. */
export function SearchForm({ query, from, to, difficulty }: Props) {
  const min = todayIst();
  return (
    <form action="/search" method="get" className="search-grid" role="search">
      {difficulty && <input type="hidden" name="difficulty" value={difficulty} />}
      <div className="field">
        <label htmlFor="q">Where do you want to trek?</label>
        <div className="input-icon">
          <Icon name="search" />
          <input
            id="q"
            name="query"
            type="search"
            placeholder="Kudremukh, Coorg, an organizer…"
            defaultValue={query}
            minLength={2}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="from">From</label>
        <div className="input-icon">
          <Icon name="calendar" />
          <input id="from" name="from" type="date" min={min} defaultValue={from} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="to">To</label>
        <div className="input-icon">
          <Icon name="calendar" />
          <input id="to" name="to" type="date" min={min} defaultValue={to} />
        </div>
      </div>
      <button type="submit">
        <Icon name="search" /> Search
      </button>
    </form>
  );
}

/** Upcoming Saturday–Sunday in IST, as YYYY-MM-DD (today if it is already the weekend). */
export function thisWeekend(now = new Date()): { from: string; to: string } {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  const dow = ist.getUTCDay(); // 0 Sun … 6 Sat
  const toSat = dow === 0 ? -1 : 6 - dow;
  const sat = new Date(ist.getTime() + toSat * 86_400_000);
  const sun = new Date(sat.getTime() + 86_400_000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return { from: d(sat < ist && dow !== 6 ? ist : sat), to: d(sun) };
}
