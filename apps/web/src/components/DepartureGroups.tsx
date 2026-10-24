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
  const popular = showTrek ? popularTreks(batches) : [];
  return (
    <div className="stack-lg">
      {[...days.values()].map((list) => (
        <DayGroup
          key={dayKey(list[0]!.departureAt)}
          list={list}
          showTrek={showTrek}
          via={via}
          popular={popular}
        />
      ))}
    </div>
  );
}

function DayGroup({
  list,
  showTrek,
  via,
  popular,
}: {
  list: PublicBatch[];
  showTrek: boolean;
  via?: string | undefined;
  popular: PopularTrek[];
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? list : list.slice(0, ROW);
  // A short day leaves blank space in its row: fill it with popular treks not already in this
  // day. Hidden on narrow screens, where rows hold fewer cards.
  const room = showTrek ? ROW - shown.length : 0;
  const here = new Set(list.map((b) => b.catalogTrek.slug));
  const picks = room > 0 ? popular.filter((p) => !here.has(p.slug)).slice(0, room) : [];
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
        {picks.map((p) => (
          <li key={p.slug} className="filler-cell">
            <PopularCard p={p} />
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
  const cover = coverOf(b);
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
          <span className="cover-badges">
            {b.trek.difficulty && (
              <span className={`cover-badge diff-${b.trek.difficulty}`}>
                {DIFFICULTY_LABEL[b.trek.difficulty]}
              </span>
            )}
            <span className="cover-badge">
              <Icon name="clock" size={12} /> {durationLabel(b.departureAt, b.returnAt)}
            </span>
          </span>
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
            {dateTime(b.departureAt)}
            {/* With a cover photo the duration is a badge on it. */}
            {!showTrek && ` · ${durationLabel(b.departureAt, b.returnAt)}`}
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

const DIFFICULTY_LABEL: Record<NonNullable<PublicBatch['trek']['difficulty']>, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  challenging: 'Challenging',
};

/** The trip's best "this is the place" shot: a destination photo, else its first photo. */
function coverOf(b: PublicBatch) {
  return b.trek.photos.find((p) => p.category === 'destination') ?? b.trek.photos[0];
}

interface PopularTrek {
  slug: string;
  name: string;
  count: number;
  cover: PublicBatch['trek']['photos'][number] | undefined;
  /** Gallery size behind `cover`: the fullest gallery is likeliest a real photo, not a banner. */
  photoCount: number;
  minPricePaise: number;
}

/** Treks with more than one bookable departure in the list, busiest first. */
function popularTreks(batches: PublicBatch[]): PopularTrek[] {
  const by = new Map<string, PopularTrek>();
  for (const b of batches) {
    if (b.availability !== 'available') continue;
    const p = by.get(b.catalogTrek.slug);
    if (p) {
      p.count += 1;
      p.minPricePaise = Math.min(p.minPricePaise, b.pricePaise);
      if (b.trek.photos.length > p.photoCount) {
        p.cover = coverOf(b);
        p.photoCount = b.trek.photos.length;
      }
    } else {
      by.set(b.catalogTrek.slug, {
        slug: b.catalogTrek.slug,
        name: b.catalogTrek.name,
        count: 1,
        cover: coverOf(b),
        photoCount: b.trek.photos.length,
        minPricePaise: b.pricePaise,
      });
    }
  }
  return [...by.values()].filter((p) => p.count > 1).sort((a, b) => b.count - a.count);
}

function PopularCard({ p }: { p: PopularTrek }) {
  return (
    <Link href={`/treks/${p.slug}`} className="card filler-card popular-card">
      {p.cover ? (
        <img src={mediaUrl(p.cover.thumbUrl)} alt="" loading="lazy" />
      ) : (
        <span className="departure-cover-blank" aria-hidden="true" />
      )}
      <span className="popular-shade" aria-hidden="true" />
      <span className="popular-text">
        <span className="filler-eyebrow">
          <Icon name="sparkle" size={13} /> Popular this month
        </span>
        <strong>{p.name}</strong>
        <span className="small">
          {p.count} departures · from {price(p.minPricePaise)}
        </span>
        <span className="small popular-cta">
          See all dates <Icon name="arrowRight" size={14} />
        </span>
      </span>
    </Link>
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
