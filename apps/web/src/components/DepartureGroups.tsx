'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PublicBatch } from '@ohviana/contracts';
import { IST, dateTime, durationLabel, price, seatsLabel } from '@/lib/format';
import { logoSrc, mediaUrl } from '@/lib/media';
import { Icon } from './Icon';

/** Cards shown per day before "+ N more" (one row on a laptop). */
const ROW = 4;

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: IST });
const dayTitle = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/**
 * Departures grouped by their IST day: a heading per day, then one card per organizer's
 * departure. Days with many departures show a few and expand on demand.
 */
export function DepartureGroups({
  batches,
  showTrek = true,
  via,
}: {
  batches: PublicBatch[];
  /** Off on a trek's own page, where every card is the same trek. */
  showTrek?: boolean;
  via?: string | undefined;
}) {
  const days = new Map<string, PublicBatch[]>();
  for (const b of batches) {
    const k = dayKey(b.departureAt);
    days.set(k, [...(days.get(k) ?? []), b]);
  }
  return (
    <div className="stack-lg">
      {[...days.values()].map((list) => (
        <DayGroup key={dayKey(list[0]!.departureAt)} list={list} showTrek={showTrek} via={via} />
      ))}
    </div>
  );
}

function DayGroup({
  list,
  showTrek,
  via,
}: {
  list: PublicBatch[];
  showTrek: boolean;
  via?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? list : list.slice(0, ROW);
  return (
    <section className="stack day-group">
      <div className="spread">
        <h3 className="day-title">{dayTitle(list[0]!.departureAt)}</h3>
        <span className="muted small">
          {list.length} departure{list.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="departure-cards">
        {shown.map((b) => (
          <li key={b.id}>
            <DepartureCard b={b} showTrek={showTrek} via={via} />
          </li>
        ))}
      </ul>
      {list.length > ROW && (
        <button
          type="button"
          className="secondary small"
          style={{ alignSelf: 'flex-start' }}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Show fewer' : `+ ${list.length - ROW} more on this day`}
        </button>
      )}
    </section>
  );
}

function DepartureCard({
  b,
  showTrek,
  via,
}: {
  b: PublicBatch;
  showTrek: boolean;
  via?: string | undefined;
}) {
  const viaQs = via ? `?via=${encodeURIComponent(via)}` : '';
  const cover = b.trek.photos[0];
  const bookable = b.availability === 'available';
  return (
    <article className={`card departure-card${bookable ? '' : ' unavailable'}`}>
      {showTrek && (
        <div className="departure-cover">
          {cover ? (
            <img src={mediaUrl(cover.thumbUrl)} alt="" loading="lazy" />
          ) : (
            <span className="departure-cover-blank" aria-hidden="true">
              <Icon name="mountain" size={28} />
            </span>
          )}
        </div>
      )}
      <div className="stack departure-body">
        {showTrek && (
          <Link href={`/treks/${b.catalogTrek.slug}`} className="departure-trek">
            {b.catalogTrek.name}
          </Link>
        )}
        {showTrek ? (
          <Link href={`/organizers/${b.organizer.slug}`} className="departure-org">
            <OrgMark name={b.organizer.name} logoUrl={b.organizer.logoUrl} />
            {b.organizer.name}
            <span className="verified" title="Verified by Ohviana">
              <Icon name="shield" size={14} />
            </span>
          </Link>
        ) : (
          // On a trek's page the organizer is what people compare: lead with them.
          <Link href={`/organizers/${b.organizer.slug}`} className="departure-org-head">
            <OrgMark name={b.organizer.name} logoUrl={b.organizer.logoUrl} size={44} />
            <span className="stack" style={{ gap: 0, minWidth: 0 }}>
              <strong>{b.organizer.name}</strong>
              <span className="small departure-verified">
                <Icon name="shield" size={13} /> Verified organizer
              </span>
            </span>
          </Link>
        )}
        <span className="meta-line small">
          <Icon name="clock" size={14} />
          <span>
            {dateTime(b.departureAt)} · {durationLabel(b.departureAt, b.returnAt)}
            {b.trek.startPoint && ` · from ${b.trek.startPoint}`}
          </span>
        </span>
        <div className="departure-foot">
          <span>
            <span className="price">{price(b.pricePaise)}</span>
            <span className="muted small"> /person</span>
          </span>
          {bookable ? (
            <span className={`badge ${b.seatsLeft <= 5 ? 'warn' : 'ok'}`}>
              {seatsLabel(b.seatsLeft)}
            </span>
          ) : (
            <span className="badge danger">
              {b.availability === 'sold_out' ? 'Sold out' : 'Closed'}
            </span>
          )}
        </div>
        <div className="cluster" style={{ gap: 8 }}>
          <Link href={`/batches/${b.id}${viaQs}`} className="btn secondary small">
            Details
          </Link>
          {bookable && (
            <Link href={`/book/${b.id}${viaQs}`} className="btn small">
              Book
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** The organizer's logo, or their initial on a green tile when they haven't added one. */
export function OrgMark({
  name,
  logoUrl,
  size = 22,
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
}) {
  return logoUrl ? (
    <img
      src={logoSrc(logoUrl)}
      alt=""
      className="org-mark"
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span
      className="org-mark initial"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}
