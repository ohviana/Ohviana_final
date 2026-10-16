import { and, asc, eq, gte, inArray, lte, notInArray, sql, type SQL } from 'drizzle-orm';
import {
  batchPickups,
  batches,
  bookingEvents,
  bookings,
  catalogTreks,
  organizerTreks,
  pgErrorCode,
  PG_FOREIGN_KEY_VIOLATION,
  pickupPoints,
  type Database,
  type Tx,
} from '@ohviana/db';
import type {
  BulkCreateBatchesRequest,
  CreateBatchRequest,
  DashboardSummary,
  OrganizerBatch,
  OrganizerBatchListQuery,
  UpdateBatchRequest,
} from '@ohviana/contracts';
import { BATCH_VIEWS, deriveBatchView, type BatchView } from '@ohviana/shared';
import { enqueueEvent } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { decodeCursor, toPage } from '../../lib/pagination';
import { getTrekRow } from './treks.service';

type Executor = Database | Tx;
type BatchRow = typeof batches.$inferSelect;

/**
 * SQL twin of `deriveBatchView` (shared/domain.ts). Keep the two in step: the dashboard filters
 * with this expression and displays the JS one.
 */
export function batchViewSql(now: Date): SQL<BatchView> {
  const t = sql`${now.toISOString()}::timestamptz`;
  return sql<BatchView>`case
    when ${batches.status} in ('draft', 'cancelled', 'completed') then ${batches.status}
    when ${t} >= ${batches.returnAt} then 'completed'
    when ${t} >= ${batches.departureAt} then 'ongoing'
    when ${batches.confirmedSeats} >= ${batches.capacity} then 'sold_out'
    when ${t} >= ${batches.bookingCutoffAt} then 'booking_closed'
    else 'upcoming' end`;
}

async function toBatchDtos(
  db: Executor,
  rows: BatchRow[],
  now = new Date(),
): Promise<OrganizerBatch[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [titles, pickups] = await Promise.all([
    db
      .select({ id: organizerTreks.id, title: organizerTreks.title })
      .from(organizerTreks)
      .where(inArray(organizerTreks.id, [...new Set(rows.map((r) => r.organizerTrekId))])),
    db
      .select({
        batchId: batchPickups.batchId,
        pickupPointId: batchPickups.pickupPointId,
        name: pickupPoints.name,
        pickupAt: batchPickups.pickupAt,
      })
      .from(batchPickups)
      .innerJoin(pickupPoints, eq(pickupPoints.id, batchPickups.pickupPointId))
      .where(inArray(batchPickups.batchId, ids))
      .orderBy(asc(batchPickups.pickupAt)),
  ]);
  const titleOf = new Map(titles.map((t) => [t.id, t.title]));

  return rows.map((r) => ({
    id: r.id,
    organizerTrekId: r.organizerTrekId,
    trekTitle: titleOf.get(r.organizerTrekId) ?? '',
    departureAt: r.departureAt.toISOString(),
    returnAt: r.returnAt.toISOString(),
    bookingCutoffAt: r.bookingCutoffAt.toISOString(),
    pricePaise: r.pricePaise,
    capacity: r.capacity,
    confirmedSeats: r.confirmedSeats,
    seatsLeft: Math.max(0, r.capacity - r.confirmedSeats),
    maxSeatsPerBooking: r.maxSeatsPerBooking,
    status: r.status,
    view: deriveBatchView(r, now),
    notes: r.notes,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    cancelReason: r.cancelReason,
    pickups: pickups
      .filter((p) => p.batchId === r.id)
      .map((p) => ({
        pickupPointId: p.pickupPointId,
        name: p.name,
        pickupAt: p.pickupAt.toISOString(),
      })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

async function getBatchRow(db: Executor, organizerId: string, batchId: string, lock = false) {
  const query = db
    .select()
    .from(batches)
    .where(and(eq(batches.id, batchId), eq(batches.organizerId, organizerId)));
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw notFound('Batch');
  return row;
}

export async function getBatch(db: Database, organizerId: string, batchId: string) {
  return (await toBatchDtos(db, [await getBatchRow(db, organizerId, batchId)]))[0]!;
}

/** Ordered by departure (soonest first), keyset-paginated on (departure_at, id). */
export async function listBatches(db: Database, organizerId: string, q: OrganizerBatchListQuery) {
  const now = new Date();
  const filters: SQL[] = [eq(batches.organizerId, organizerId)];
  if (q.view) filters.push(sql`${batchViewSql(now)} = ${q.view}`);
  if (q.trekId) filters.push(eq(batches.organizerTrekId, q.trekId));
  if (q.from) filters.push(gte(batches.departureAt, new Date(q.from)));
  if (q.to) filters.push(lte(batches.departureAt, new Date(q.to)));
  if (q.cursor) {
    const [departureAt, id] = decodeCursor(q.cursor, 2);
    filters.push(
      sql`(${batches.departureAt}, ${batches.id}) > (${departureAt}::timestamptz, ${id}::uuid)`,
    );
  }
  const rows = await db
    .select()
    .from(batches)
    .where(and(...filters))
    .orderBy(asc(batches.departureAt), asc(batches.id))
    .limit(q.limit + 1);
  const page = toPage(rows, q.limit, (r) => [r.departureAt.toISOString(), r.id]);
  return { items: await toBatchDtos(db, page.items, now), nextCursor: page.nextCursor };
}

// ---------- Create ----------

interface NewBatch {
  departureAt: Date;
  returnAt: Date;
  bookingCutoffAt: Date;
  pickups: { pickupPointId: string; pickupAt: Date }[];
}

function validateTimes(
  b: { departureAt: Date; returnAt: Date; bookingCutoffAt: Date },
  now: Date,
  label = '',
) {
  const where = label ? ` (${label})` : '';
  if (b.departureAt <= now) throw badRequest(`Departure must be in the future${where}`);
  if (b.returnAt <= b.departureAt) throw badRequest(`Return must be after departure${where}`);
  if (b.bookingCutoffAt > b.departureAt)
    throw badRequest(`Booking cutoff must be on or before departure${where}`);
  if (b.bookingCutoffAt <= now) throw badRequest(`Booking cutoff must be in the future${where}`);
}

function rethrowPickupError(err: unknown): never {
  if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) {
    throw badRequest("Every pickup must be one of this trek's pickup points");
  }
  throw err;
}

async function insertBatches(
  tx: Tx,
  organizerId: string,
  trekId: string,
  common: {
    pricePaise: number;
    capacity: number;
    maxSeatsPerBooking?: number | undefined;
    notes?: string | undefined;
  },
  items: NewBatch[],
): Promise<BatchRow[]> {
  const trek = await getTrekRow(tx, organizerId, trekId);
  if (trek.status === 'archived') throw conflict('Cannot add batches to an archived trek');

  const rows = await tx
    .insert(batches)
    .values(
      items.map((b) => ({
        organizerTrekId: trekId,
        organizerId,
        departureAt: b.departureAt,
        returnAt: b.returnAt,
        bookingCutoffAt: b.bookingCutoffAt,
        pricePaise: common.pricePaise,
        capacity: common.capacity,
        maxSeatsPerBooking: Math.min(common.maxSeatsPerBooking ?? 10, common.capacity),
        notes: common.notes ?? null,
        status: 'draft' as const,
      })),
    )
    .returning();

  const pickupRows = rows.flatMap((row, i) =>
    items[i]!.pickups.map((p) => ({ batchId: row.id, organizerTrekId: trekId, ...p })),
  );
  if (pickupRows.length) {
    try {
      await tx.insert(batchPickups).values(pickupRows);
    } catch (err) {
      rethrowPickupError(err);
    }
  }
  return rows;
}

export async function createBatch(
  db: Database,
  organizerId: string,
  trekId: string,
  input: CreateBatchRequest,
) {
  const now = new Date();
  const item: NewBatch = {
    departureAt: new Date(input.departureAt),
    returnAt: new Date(input.returnAt),
    bookingCutoffAt: new Date(input.bookingCutoffAt ?? input.departureAt),
    pickups: (input.pickups ?? []).map((p) => ({
      pickupPointId: p.pickupPointId,
      pickupAt: new Date(p.pickupAt),
    })),
  };
  validateTimes(item, now);
  const [row] = await db.transaction((tx) => insertBatches(tx, organizerId, trekId, input, [item]));
  return (await toBatchDtos(db, [row!]))[0]!;
}

/** All-or-nothing: one invalid departure rejects the whole request. */
export async function bulkCreateBatches(
  db: Database,
  organizerId: string,
  trekId: string,
  input: BulkCreateBatchesRequest,
) {
  const now = new Date();
  const items: NewBatch[] = input.departures.map((d, i) => {
    const departureAt = new Date(d.departureAt);
    const item = {
      departureAt,
      returnAt: new Date(d.returnAt),
      bookingCutoffAt: new Date(d.bookingCutoffAt ?? d.departureAt),
      pickups: (input.pickups ?? []).map((p) => ({
        pickupPointId: p.pickupPointId,
        pickupAt: new Date(departureAt.getTime() + p.minutesFromDeparture * 60_000),
      })),
    };
    validateTimes(item, now, `departure #${i + 1}`);
    return item;
  });
  const starts = items.map((i) => i.departureAt.getTime());
  if (new Set(starts).size !== starts.length) throw badRequest('Departures must not repeat');

  const rows = await db.transaction((tx) => insertBatches(tx, organizerId, trekId, input, items));
  return toBatchDtos(db, rows);
}

// ---------- Update ----------

/**
 * Edit rules: ended/cancelled batches are frozen; dates are frozen once seats are sold;
 * capacity can't drop below sold seats. Price changes apply to new bookings only.
 */
export async function updateBatch(
  db: Database,
  organizerId: string,
  batchId: string,
  input: UpdateBatchRequest,
) {
  const now = new Date();
  await db.transaction(async (tx) => {
    const current = await getBatchRow(tx, organizerId, batchId, true);
    const view = deriveBatchView(current, now);
    if (view === 'cancelled' || view === 'completed' || view === 'ongoing') {
      throw conflict(`A batch that is ${view} can't be edited`);
    }

    const changesDates =
      input.departureAt !== undefined ||
      input.returnAt !== undefined ||
      input.bookingCutoffAt !== undefined;
    const moves = input.departureAt !== undefined || input.returnAt !== undefined;
    if (moves && current.confirmedSeats > 0) {
      throw conflict('Dates cannot change after seats are booked; cancel the batch instead');
    }
    if (changesDates) {
      const next = {
        departureAt: input.departureAt ? new Date(input.departureAt) : current.departureAt,
        returnAt: input.returnAt ? new Date(input.returnAt) : current.returnAt,
        bookingCutoffAt: input.bookingCutoffAt
          ? new Date(input.bookingCutoffAt)
          : current.bookingCutoffAt,
      };
      validateTimes(next, now);
    }
    const capacity = input.capacity ?? current.capacity;
    if (capacity < current.confirmedSeats) {
      throw conflict(`Capacity can't go below the ${current.confirmedSeats} seats already booked`);
    }

    await tx
      .update(batches)
      .set({
        ...(input.pricePaise !== undefined ? { pricePaise: input.pricePaise } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.departureAt ? { departureAt: new Date(input.departureAt) } : {}),
        ...(input.returnAt ? { returnAt: new Date(input.returnAt) } : {}),
        ...(input.bookingCutoffAt ? { bookingCutoffAt: new Date(input.bookingCutoffAt) } : {}),
        maxSeatsPerBooking: Math.min(
          input.maxSeatsPerBooking ?? current.maxSeatsPerBooking,
          capacity,
        ),
      })
      .where(eq(batches.id, batchId));
  });
  return getBatch(db, organizerId, batchId);
}

/** Replaces the batch's pickup set. Pickups already chosen by a booking can't be removed. */
export async function setBatchPickups(
  db: Database,
  organizerId: string,
  batchId: string,
  pickups: { pickupPointId: string; pickupAt: string }[],
) {
  const ids = pickups.map((p) => p.pickupPointId);
  if (new Set(ids).size !== ids.length) throw badRequest('Each pickup point can appear once');

  await db.transaction(async (tx) => {
    const batch = await getBatchRow(tx, organizerId, batchId, true);
    if (batch.status === 'cancelled' || batch.status === 'completed') {
      throw conflict(`A ${batch.status} batch can't be edited`);
    }
    try {
      await tx
        .delete(batchPickups)
        .where(
          and(
            eq(batchPickups.batchId, batchId),
            ids.length ? notInArray(batchPickups.pickupPointId, ids) : undefined,
          ),
        );
    } catch (err) {
      if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) {
        throw conflict('A pickup point that customers already chose cannot be removed');
      }
      throw err;
    }
    if (pickups.length === 0) return;
    try {
      await tx
        .insert(batchPickups)
        .values(
          pickups.map((p) => ({
            batchId,
            organizerTrekId: batch.organizerTrekId,
            pickupPointId: p.pickupPointId,
            pickupAt: new Date(p.pickupAt),
          })),
        )
        .onConflictDoUpdate({
          target: [batchPickups.batchId, batchPickups.pickupPointId],
          set: { pickupAt: sql`excluded.pickup_at` },
        });
    } catch (err) {
      rethrowPickupError(err);
    }
  });
  return getBatch(db, organizerId, batchId);
}

// ---------- Lifecycle ----------

export async function publishBatch(db: Database, organizerId: string, batchId: string) {
  await db.transaction(async (tx) => {
    const batch = await getBatchRow(tx, organizerId, batchId, true);
    if (batch.status !== 'draft') throw conflict(`Batch is already ${batch.status}`);
    if (batch.bookingCutoffAt <= new Date()) {
      throw conflict('Booking cutoff has passed; update the dates before publishing');
    }
    // One click for organizers: publishing a departure also publishes its trek.
    const trek = await getTrekRow(tx, organizerId, batch.organizerTrekId);
    if (trek.status === 'archived') throw conflict('This trek is archived; restore it first');
    if (!trek.catalogTrekId) {
      throw conflict("Add the trek's destination (e.g. Kudremukh) before publishing");
    }
    const [destination] = await tx
      .select({ status: catalogTreks.status })
      .from(catalogTreks)
      .where(eq(catalogTreks.id, trek.catalogTrekId));
    if (destination?.status === 'archived') {
      throw conflict('This destination is no longer listed on Ohviana; choose another one');
    }
    // Otherwise customers couldn't see the departure (public pages need a published destination).
    if (destination?.status === 'draft') {
      await tx
        .update(catalogTreks)
        .set({ status: 'published' })
        .where(eq(catalogTreks.id, trek.catalogTrekId));
    }
    if (trek.status === 'draft') {
      await tx
        .update(organizerTreks)
        .set({ status: 'published' })
        .where(eq(organizerTreks.id, trek.id));
    }

    await tx
      .update(batches)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(batches.id, batchId));
  });
  return getBatch(db, organizerId, batchId);
}

/**
 * Cancels a published batch and every confirmed booking on it, atomically. Customers are
 * notified through the outbox (refunds are outside the payment-less MVP).
 */
export async function cancelBatch(
  db: Database,
  organizerId: string,
  userId: string,
  batchId: string,
  reason: string,
) {
  await db.transaction(async (tx) => {
    const batch = await getBatchRow(tx, organizerId, batchId, true);
    if (batch.status === 'draft') throw conflict('Delete a draft batch instead of cancelling it');
    if (batch.status !== 'published') throw conflict(`Batch is already ${batch.status}`);
    if (batch.returnAt <= new Date()) throw conflict('This batch has already ended');

    const now = new Date();
    const cancelled = await tx
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: userId,
        cancelReason: `Batch cancelled: ${reason}`,
      })
      .where(and(eq(bookings.batchId, batchId), eq(bookings.status, 'confirmed')))
      .returning({ id: bookings.id, bookingReference: bookings.bookingReference });

    await tx
      .update(batches)
      .set({ status: 'cancelled', cancelledAt: now, cancelReason: reason, confirmedSeats: 0 })
      .where(eq(batches.id, batchId));

    if (cancelled.length) {
      await tx.insert(bookingEvents).values(
        cancelled.map((b) => ({
          bookingId: b.id,
          eventType: 'cancelled_by_organizer',
          actorId: userId,
          payload: { reason, batchId },
        })),
      );
    }
    await enqueueEvent(tx, 'batch.cancelled', {
      organizerId,
      batchId,
      reason,
      bookingIds: cancelled.map((b) => b.id),
    });
  });
  return getBatch(db, organizerId, batchId);
}

export async function deleteDraftBatch(db: Database, organizerId: string, batchId: string) {
  const deleted = await db
    .delete(batches)
    .where(
      and(
        eq(batches.id, batchId),
        eq(batches.organizerId, organizerId),
        eq(batches.status, 'draft'),
      ),
    )
    .returning({ id: batches.id });
  if (deleted.length === 0) {
    await getBatchRow(db, organizerId, batchId); // 404 if it doesn't exist
    throw conflict('Only draft batches can be deleted; cancel published batches instead');
  }
}

// ---------- Dashboard ----------

export async function dashboardSummary(
  db: Database,
  organizerId: string,
): Promise<DashboardSummary> {
  const view = batchViewSql(new Date());
  const [counts, [money]] = await Promise.all([
    db
      .select({ view, n: sql<number>`count(*)::int` })
      .from(batches)
      .where(eq(batches.organizerId, organizerId))
      // Positional: a parameterized CASE in SELECT and GROUP BY wouldn't match textually.
      .groupBy(sql`1`),
    db
      .select({
        confirmed: sql<number>`count(*)::int`,
        seatsSold: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int`,
        grossPaise: sql<number>`coalesce(sum(${bookings.totalPaise}), 0)::bigint`,
        marketplaceGrossPaise: sql<number>`coalesce(sum(${bookings.totalPaise}) filter (where ${bookings.source} = 'MARKETPLACE'), 0)::bigint`,
        directGrossPaise: sql<number>`coalesce(sum(${bookings.totalPaise}) filter (where ${bookings.source} = 'ORGANIZER_DIRECT'), 0)::bigint`,
        commissionPaise: sql<number>`coalesce(sum(${bookings.commissionPaise}), 0)::bigint`,
      })
      .from(bookings)
      .where(and(eq(bookings.organizerId, organizerId), eq(bookings.status, 'confirmed'))),
  ]);

  const batchCounts = Object.fromEntries(BATCH_VIEWS.map((v) => [v, 0])) as Record<
    BatchView,
    number
  >;
  for (const c of counts) batchCounts[c.view] = c.n;
  return {
    batches: batchCounts,
    bookings: {
      confirmed: money!.confirmed,
      seatsSold: money!.seatsSold,
      grossPaise: Number(money!.grossPaise),
      marketplaceGrossPaise: Number(money!.marketplaceGrossPaise),
      directGrossPaise: Number(money!.directGrossPaise),
      commissionPaise: Number(money!.commissionPaise),
    },
  };
}
