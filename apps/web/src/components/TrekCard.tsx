import Link from 'next/link';
import type { PublicTrekSummary } from '@ohviana/contracts';
import { longDate, price } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { Icon } from './Icon';
import { Mountains } from './Mountains';

/** A gentle per-trek hue so the grid doesn't look uniform (stable for each slug). */
function hue(slug: string): number {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) % 360;
  return 120 + (h % 60); // greens → teals
}

export function TrekCard({
  trek,
  dateQuery = '',
}: {
  trek: PublicTrekSummary;
  dateQuery?: string;
}) {
  const a = trek.availability;
  const place = [trek.district, trek.state].filter(Boolean).join(', ');
  const h = hue(trek.slug);
  return (
    <Link href={`/treks/${trek.slug}${dateQuery}`} className="card trek-card">
      <div
        className="trek-card-top"
        style={{
          background: trek.coverPhoto
            ? `linear-gradient(180deg, transparent 45%, rgb(0 0 0 / 0.35)), url(${mediaUrl(trek.coverPhoto.thumbUrl)}) center / cover`
            : `linear-gradient(140deg, hsl(${h} 70% 20%), hsl(${h + 10} 60% 34%) 55%, hsl(${h + 20} 55% 45%))`,
        }}
      >
        {trek.difficulty && <span className="badge glass tag">{trek.difficulty}</span>}
        {!trek.coverPhoto && <Mountains className="peaks" compact />}
      </div>
      <div className="trek-card-body">
        <h3>{trek.name}</h3>
        <div className="trek-meta">
          {place && (
            <span>
              <Icon name="pin" size={14} /> {place}
            </span>
          )}
          {trek.maxAltitudeM && (
            <span>
              <Icon name="mountain" size={14} /> {trek.maxAltitudeM.toLocaleString('en-IN')} m
            </span>
          )}
        </div>
        {trek.summary && (
          <p className="small muted" style={{ margin: 0 }}>
            {trek.summary}
          </p>
        )}
        <div className="trek-card-foot">
          {a.batchCount > 0 ? (
            <>
              <span className="small">
                <strong>{a.batchCount}</strong> departure{a.batchCount === 1 ? '' : 's'}
                <span className="muted">
                  {' '}
                  · {a.organizerCount} organizer{a.organizerCount === 1 ? '' : 's'}
                </span>
                {a.nextDepartureAt && (
                  <span className="muted" style={{ display: 'block' }}>
                    Next: {longDate(a.nextDepartureAt)}
                  </span>
                )}
              </span>
              {a.minPricePaise !== null && (
                <span className="price">
                  <small>from </small>
                  {price(a.minPricePaise)}
                </span>
              )}
            </>
          ) : (
            <span className="badge">Coming soon</span>
          )}
        </div>
      </div>
    </Link>
  );
}
