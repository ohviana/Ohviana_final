import { and, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { batches, bookings } from '@ohviana/db';
import {
  BOOKING_TOKEN_HEADER,
  BookingReferenceParams,
  CancelBookingRequest,
  CreateBookingRequest,
  CreateBookingResponse,
  CustomerBooking,
  ErrorResponse,
  IDEMPOTENCY_HEADER,
  IdParams,
  MyBookingList,
  MyBookingsQuery,
  OrganizerBooking,
  OrganizerBookingList,
  OrganizerCancelBookingRequest,
} from '@ohviana/contracts';
import { AppError, notFound } from '../../lib/errors';
import { decodeCursor, toPage } from '../../lib/pagination';
import { requireAuth, requireOrganizer } from '../../plugins/auth';
import { LIMITS } from '../../plugins/rate-limit';
import { attendeesCsv } from './csv';
import { cancelBooking, createBooking, tokenMatches } from './engine';
import { loadCustomerBookings, loadOrganizerBookings } from './read';

const errors = {
  400: ErrorResponse,
  401: ErrorResponse,
  403: ErrorResponse,
  404: ErrorResponse,
  409: ErrorResponse,
  422: ErrorResponse,
};

/**
 * A booking is visible to the signed-in user who made it, or to whoever holds its access
 * token. Everyone else gets 404, so references can't be probed.
 */
async function authorizedBooking(
  app: { db: Parameters<typeof loadCustomerBookings>[0] },
  request: FastifyRequest,
  reference: string,
) {
  const token = request.headers[BOOKING_TOKEN_HEADER];
  if (!request.auth && typeof token !== 'string') {
    throw new AppError('UNAUTHENTICATED', 'Sign in, or provide the booking access token');
  }
  const [found] = await loadCustomerBookings(app.db, eq(bookings.bookingReference, reference));
  const allowed =
    found &&
    ((request.auth && found.row.userId === request.auth.userId) ||
      (typeof token === 'string' && tokenMatches(token, found.row.accessTokenHash)));
  if (!allowed) throw notFound('Booking');
  return found;
}

/** Customer-facing booking API (guest checkout supported). */
export const bookingRoutes: FastifyPluginAsyncZod = async (app) => {
  // Bookings carry personal data: never cache.
  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'private, no-store');
  });

  app.post(
    '/bookings',
    {
      config: { rateLimit: LIMITS.booking },
      schema: {
        tags: ['bookings'],
        summary: 'Book seats (guest or signed in). Requires an Idempotency-Key header.',
        headers: z.object({ [IDEMPOTENCY_HEADER]: z.string().min(16).max(128) }),
        body: CreateBookingRequest,
        response: { 201: CreateBookingResponse, ...errors },
      },
    },
    async (request, reply) => {
      let result: Awaited<ReturnType<typeof createBooking>>;
      try {
        result = await createBooking(app.db, {
          userId: request.auth?.userId ?? null,
          idempotencyKey: request.headers[IDEMPOTENCY_HEADER],
          body: request.body,
        });
      } catch (err) {
        if (err instanceof AppError)
          app.metrics.bookingsRejected.inc({ reason: err.code.toLowerCase() });
        throw err;
      }
      if (!result.replayed) app.metrics.bookingsCreated.inc({ source: result.body.source });
      return reply
        .status(result.status)
        .header('idempotent-replayed', String(result.replayed))
        .send(result.body);
    },
  );

  app.get(
    '/bookings/:reference',
    {
      schema: {
        tags: ['bookings'],
        summary: `Booking detail (signed-in owner, or ${BOOKING_TOKEN_HEADER} header)`,
        params: BookingReferenceParams,
        response: { 200: CustomerBooking, ...errors },
      },
    },
    async (request) => (await authorizedBooking(app, request, request.params.reference)).dto,
  );

  app.post(
    '/bookings/:reference/cancel',
    {
      schema: {
        tags: ['bookings'],
        summary: 'Cancel before departure; releases the seats',
        params: BookingReferenceParams,
        body: CancelBookingRequest,
        response: { 200: CustomerBooking, ...errors },
      },
    },
    async (request) => {
      const found = await authorizedBooking(app, request, request.params.reference);
      await cancelBooking(app.db, {
        bookingId: found.row.id,
        actorId: request.auth?.userId ?? null,
        by: 'customer',
        reason: request.body.reason ?? null,
      });
      return (await authorizedBooking(app, request, request.params.reference)).dto;
    },
  );

  app.get(
    '/me/bookings',
    {
      onRequest: app.guards.user,
      schema: {
        tags: ['bookings'],
        summary: 'My bookings, newest first',
        security: [{ bearerAuth: [] }],
        querystring: MyBookingsQuery,
        response: { 200: MyBookingList, ...errors },
      },
    },
    async (request) => {
      const { userId } = requireAuth(request);
      const { cursor, limit } = request.query;
      const where = cursor
        ? (() => {
            const [createdAt, id] = decodeCursor(cursor, 2);
            return and(
              eq(bookings.userId, userId),
              sql`(${bookings.createdAt}, ${bookings.id}) < (${createdAt}::timestamptz, ${id}::uuid)`,
            )!;
          })()
        : eq(bookings.userId, userId);
      const rows = await loadCustomerBookings(app.db, where, limit + 1);
      const page = toPage(rows, limit, (r) => [r.row.createdAt.toISOString(), r.row.id]);
      return { items: page.items.map((r) => r.dto), nextCursor: page.nextCursor };
    },
  );
};

/** Organizer-side bookings: attendee lists, CSV export, cancellation. Under /v1/organizer. */
export const organizerBookingRoutes: FastifyPluginAsyncZod = async (app) => {
  const g = app.guards.organizer;
  const tags = ['organizer'];
  const security = [{ bearerAuth: [] }];

  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'private, no-store');
  });

  async function ownBatch(organizerId: string, batchId: string) {
    const [batch] = await app.db
      .select({ id: batches.id, departureAt: batches.departureAt })
      .from(batches)
      .where(and(eq(batches.id, batchId), eq(batches.organizerId, organizerId)));
    if (!batch) throw notFound('Batch');
    return batch;
  }

  app.get(
    '/batches/:id/bookings',
    {
      onRequest: g('bookings:read'),
      schema: {
        tags,
        summary: 'Bookings and attendees of a batch, with source and commission',
        security,
        params: IdParams,
        response: { 200: OrganizerBookingList, ...errors },
      },
    },
    async (request) => {
      const { organizerId } = requireOrganizer(request);
      await ownBatch(organizerId, request.params.id);
      const items = await loadOrganizerBookings(app.db, eq(bookings.batchId, request.params.id));
      const confirmed = items.filter((b) => b.status === 'confirmed');
      return {
        items,
        totals: {
          confirmedBookings: confirmed.length,
          confirmedSeats: confirmed.reduce((n, b) => n + b.quantity, 0),
          cancelledBookings: items.length - confirmed.length,
        },
      };
    },
  );

  app.get(
    '/batches/:id/attendees.csv',
    {
      onRequest: g('bookings:read'),
      schema: {
        tags,
        summary: 'Attendee list as CSV (one row per traveller, confirmed bookings)',
        security,
        params: IdParams,
        // Returns text/csv, so no JSON response schema here.
      },
    },
    async (request, reply) => {
      const { organizerId } = requireOrganizer(request);
      const batch = await ownBatch(organizerId, request.params.id);
      const items = await loadOrganizerBookings(app.db, eq(bookings.batchId, batch.id));
      const day = batch.departureAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header(
          'content-disposition',
          `attachment; filename="attendees-${day}-${batch.id.slice(0, 8)}.csv"`,
        )
        .send(attendeesCsv(items));
    },
  );

  app.get(
    '/bookings/:reference',
    {
      onRequest: g('bookings:read'),
      schema: {
        tags,
        summary: 'One booking',
        security,
        params: BookingReferenceParams,
        response: { 200: OrganizerBooking, ...errors },
      },
    },
    async (request) => {
      const { organizerId } = requireOrganizer(request);
      const [booking] = await loadOrganizerBookings(
        app.db,
        and(
          eq(bookings.bookingReference, request.params.reference),
          eq(bookings.organizerId, organizerId),
        )!,
      );
      if (!booking) throw notFound('Booking');
      return booking;
    },
  );

  app.post(
    '/bookings/:reference/cancel',
    {
      onRequest: g('bookings:manage'),
      schema: {
        tags,
        summary: 'Cancel a booking (releases seats; the customer is notified)',
        security,
        params: BookingReferenceParams,
        body: OrganizerCancelBookingRequest,
        response: { 200: OrganizerBooking, ...errors },
      },
    },
    async (request) => {
      const { organizerId } = requireOrganizer(request);
      const where = and(
        eq(bookings.bookingReference, request.params.reference),
        eq(bookings.organizerId, organizerId),
      )!;
      const [row] = await app.db.select({ id: bookings.id }).from(bookings).where(where);
      if (!row) throw notFound('Booking');
      await cancelBooking(app.db, {
        bookingId: row.id,
        actorId: requireAuth(request).userId,
        by: 'organizer',
        reason: request.body.reason,
      });
      return (await loadOrganizerBookings(app.db, where))[0]!;
    },
  );
};
