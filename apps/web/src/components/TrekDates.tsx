import Link from 'next/link';
import type { TrekDate } from '@ohviana/contracts';
import { IST, price } from '@/lib/format';
import { ScrollToCurrent } from './ScrollToCurrent';

/** Parts of an IST calendar day ("2026-10-24"), read at noon IST so no zone can shift the day. */
function dayParts(date: string) {
  const d = new Date(`${date}T12:00:00+05:30`);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-IN', { timeZone: IST, ...opts });
  return {
    dow: part({ weekday: 'short' }),
    day: part({ day: 'numeric' }),
    mon: part({ month: 'short' }),
    month: part({ month: 'long', year: 'numeric' }),
  };
}

/** "Sat, 24 Oct" for an IST calendar day. */
export function dayLabel(date: string): string {
  const p = dayParts(date);
  return `${p.dow}, ${p.day} ${p.mon}`;
}

const dateHref = (slug: string, date: string) => `/treks/${slug}?date=${date}#departures`;

function note(d: TrekDate): string {
  if (!d.bookable) return 'Sold out';
  return d.organizerCount === 1 ? '1 organizer' : `${d.organizerCount} organizers`;
}

/** Before a date is chosen: every upcoming departure day, grouped by month. */
export function DateGrid({ slug, dates }: { slug: string; dates: TrekDate[] }) {
  const months = new Map<string, TrekDate[]>();
  for (const d of dates) {
    const m = dayParts(d.date).month;
    months.set(m, [...(months.get(m) ?? []), d]);
  }
  return (
    <div className="stack-lg">
      {[...months].map(([month, days]) => (
        <section key={month} className="stack" style={{ gap: 10 }}>
          <h3 className="date-month">{month}</h3>
          <ul className="date-grid">
            {days.map((d) => {
              const p = dayParts(d.date);
              return (
                <li key={d.date}>
                  <Link
                    href={dateHref(slug, d.date)}
                    className={`date-card${d.bookable ? '' : ' unavailable'}`}
                    aria-label={`${dayLabel(d.date)}: ${
                      d.minPricePaise !== null ? `from ${price(d.minPricePaise)}, ` : ''
                    }${note(d)}`}
                  >
                    <span className="dow">{p.dow}</span>
                    <span className="day">
                      {p.day} <span className="mon">{p.mon}</span>
                    </span>
                    <span className="from">
                      {d.minPricePaise !== null ? `from ${price(d.minPricePaise)}` : '—'}
                    </span>
                    <span className="note">{note(d)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** After a date is chosen: a compact, scrollable strip to switch dates. */
export function DateStrip({
  slug,
  dates,
  selected,
}: {
  slug: string;
  dates: TrekDate[];
  selected: string;
}) {
  return (
    <nav aria-label="Departure dates" className="date-strip">
      {dates.map((d) => {
        const p = dayParts(d.date);
        const current = d.date === selected;
        return (
          <Link
            key={d.date}
            href={dateHref(slug, d.date)}
            scroll={false}
            className={`date-chip${d.bookable ? '' : ' unavailable'}`}
            aria-current={current ? 'date' : undefined}
          >
            <span className="dow">{p.dow}</span>
            <span className="day">
              {p.day} {p.mon}
            </span>
            <span className="from">
              {d.minPricePaise !== null ? price(d.minPricePaise) : 'Sold out'}
            </span>
          </Link>
        );
      })}
      <ScrollToCurrent watch={selected} />
    </nav>
  );
}
