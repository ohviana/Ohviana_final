import { z } from 'zod';
import { DIFFICULTIES } from '@ohviana/shared';
import { PaginationQuery, Uuid, paginated } from './common';
import { TrekPhoto } from './organizer';

const Timestamp = z.iso.datetime();

/**
 * Calendar day in India time (Asia/Kolkata), e.g. 2026-11-07. `from` starts at 00:00 IST on
 * that day; `to` includes the whole day.
 */
export const IstDate = z.iso.date();

const DateWindow = {
  from: IstDate.optional(),
  to: IstDate.optional(),
};

export const PUBLIC_BATCH_SORTS = ['departure_asc', 'price_asc'] as const;

// ---------- Treks ----------

export const TrekSearchQuery = PaginationQuery.extend({
  query: z.string().trim().min(2).max(100).optional(),
  district: z.string().trim().min(1).max(80).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  ...DateWindow,
});
export type TrekSearchQuery = z.infer<typeof TrekSearchQuery>;

/** Bookable departures within the requested window (or from now, without one). */
export const Availability = z.object({
  batchCount: z.number().int(),
  organizerCount: z.number().int(),
  minPricePaise: z.number().int().nullable(),
  nextDepartureAt: Timestamp.nullable(),
});

export const PublicTrekSummary = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  state: z.string().nullable(),
  region: z.string().nullable(),
  district: z.string().nullable(),
  difficulty: z.enum(DIFFICULTIES).nullable(),
  summary: z.string().nullable(),
  maxAltitudeM: z.number().int().nullable(),
  heroImageUrl: z.string().nullable(),
  /** A destination photo from an organizer offering this trek (API path), when available. */
  coverPhoto: z.object({ url: z.string(), thumbUrl: z.string() }).nullable(),
  availability: Availability,
});
export type PublicTrekSummary = z.infer<typeof PublicTrekSummary>;

export const PublicTrekList = paginated(PublicTrekSummary);

export const PublicTrekDetail = PublicTrekSummary.extend({ description: z.string().nullable() });
export type PublicTrekDetail = z.infer<typeof PublicTrekDetail>;

export const SlugParams = z.object({ slug: z.string().min(1).max(120) });

// ---------- Batches ----------

export const PublicOrganizerRef = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  logoUrl: z.string().nullable(),
});

export const PublicBatch = z.object({
  id: Uuid,
  departureAt: Timestamp,
  returnAt: Timestamp,
  bookingCutoffAt: Timestamp,
  pricePaise: z.number().int(),
  capacity: z.number().int(),
  seatsLeft: z.number().int(),
  maxSeatsPerBooking: z.number().int(),
  /** available: can be booked now; sold_out / booking_closed: shown for comparison only. */
  availability: z.enum(['available', 'sold_out', 'booking_closed']),
  organizer: PublicOrganizerRef,
  trek: z.object({
    id: Uuid,
    title: z.string(),
    slug: z.string(),
    summary: z.string().nullable(),
    durationDays: z.number().int().nullable(),
    itinerary: z.array(
      z.object({ day: z.number(), title: z.string(), details: z.string().optional() }),
    ),
    inclusions: z.array(z.string()),
    exclusions: z.array(z.string()),
    thingsToCarry: z.array(z.string()),
    cancellationPolicy: z.string().nullable(),
    photos: z.array(TrekPhoto),
  }),
  catalogTrek: z.object({ id: Uuid, name: z.string(), slug: z.string() }),
  pickups: z.array(
    z.object({
      pickupPointId: Uuid,
      name: z.string(),
      address: z.string().nullable(),
      landmark: z.string().nullable(),
      mapsUrl: z.string().nullable(),
      pickupAt: Timestamp,
    }),
  ),
});
export type PublicBatch = z.infer<typeof PublicBatch>;

export const PublicBatchQuery = PaginationQuery.extend({
  ...DateWindow,
  sort: z.enum(PUBLIC_BATCH_SORTS).default('departure_asc'),
  /** Include sold-out and closed departures (default: bookable only). */
  includeUnavailable: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type PublicBatchQuery = z.infer<typeof PublicBatchQuery>;

export const PublicBatchList = paginated(PublicBatch);

/**
 * One departure day (IST) of a trek, summarised across organizers: what the date picker on the
 * trek page shows before anyone chooses a date. Sold-out and closed days are included.
 */
export const TrekDate = z.object({
  date: IstDate,
  departureCount: z.number().int(),
  organizerCount: z.number().int(),
  /** At least one departure that day can still be booked. */
  bookable: z.boolean(),
  /** Cheapest bookable departure that day (null when none is bookable). */
  minPricePaise: z.number().int().nullable(),
  /** Free seats across that day's bookable departures. */
  seatsLeft: z.number().int(),
});
export type TrekDate = z.infer<typeof TrekDate>;

export const TrekDateList = z.object({ items: z.array(TrekDate) });
export type TrekDateList = z.infer<typeof TrekDateList>;

// ---------- Organizers ----------

export const OrganizerSearchQuery = PaginationQuery.extend({
  query: z.string().trim().min(2).max(100).optional(),
});
export type OrganizerSearchQuery = z.infer<typeof OrganizerSearchQuery>;

export const PublicOrganizer = PublicOrganizerRef.extend({
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  upcomingBatchCount: z.number().int(),
});
export type PublicOrganizer = z.infer<typeof PublicOrganizer>;

export const PublicOrganizerList = paginated(PublicOrganizer);

// ---------- Direct links ----------

export const DirectLinkLanding = z.object({
  organizer: PublicOrganizer,
  /** Set for a single-batch link. */
  batch: PublicBatch.nullable(),
  /** For an organizer-wide link: that organizer's bookable departures (first page). */
  batches: z.array(PublicBatch),
});
export type DirectLinkLanding = z.infer<typeof DirectLinkLanding>;

export const TokenParams = z.object({ token: z.string().min(16).max(64) });
