import { createHash } from 'node:crypto';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required for e2e tests (see .env.example)');
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);

/**
 * One shared connection for all spec files in a worker. Never `end()` it from a spec (another
 * spec's cleanup may still need it); the short idle timeout lets the worker exit on its own.
 */
export const sql = postgres(url, {
  max: 1,
  idle_timeout: 5,
  ssl: local ? false : 'require',
  onnotice: () => {},
});

export interface BookingRow {
  status: string;
  source: string;
  commission_paise: number;
  quantity: number;
  contact_phone: string;
}

export async function bookingByReference(reference: string): Promise<BookingRow | undefined> {
  const rows = await sql<BookingRow[]>`
    select status, source, commission_paise::int, quantity, contact_phone
    from bookings where booking_reference = ${reference}`;
  return rows[0];
}

/**
 * Removes bookings made by a test and gives their seats back, so e2e runs leave the
 * (possibly shared dev) database exactly as they found it.
 */
export async function removeBookings(references: string[]): Promise<void> {
  if (references.length === 0) return;
  await sql.begin(async (tx) => {
    await tx`
      update batches b set confirmed_seats = b.confirmed_seats - k.quantity
      from bookings k
      where k.batch_id = b.id and k.status = 'confirmed' and k.booking_reference = any(${references})`;
    await tx`delete from outbox_events where payload->>'bookingReference' = any(${references})`;
    await tx`delete from idempotency_keys where response_body->>'bookingReference' = any(${references})`;
    await tx`delete from bookings where booking_reference = any(${references})`;
  });
}

/** Token of a seed organizer's Instagram link (same derivation as packages/db/src/seed.ts). */
export function seedDirectLinkToken(organizerSlug: string): string {
  return createHash('sha256')
    .update(`ohviana-seed-token:org:${organizerSlug}`)
    .digest('base64url')
    .slice(0, 32);
}

/** Everything the console walkthrough can create, matched by its fixed name/email prefixes. */
export async function removeWalkthroughData(): Promise<void> {
  const orgs = (
    await sql<{ id: string }[]>`select id from organizers where name like 'E2E Trails %'`
  ).map((o) => o.id);
  if (orgs.length) {
    await sql`delete from outbox_events where payload->>'organizerId' = any(${orgs})`;
    await sql`delete from admin_audit_log where entity_id = any(${orgs}::uuid[])`;
    await sql`delete from idempotency_keys where response_body->'batch'->'organizer'->>'id' = any(${orgs})`;
    await sql`delete from bookings where organizer_id = any(${orgs}::uuid[])`;
    await sql`delete from batches where organizer_id = any(${orgs}::uuid[])`;
    await sql`delete from organizers where id = any(${orgs}::uuid[])`;
  }
  // Test admins/organizers (and their audit trail, which references them).
  await sql`delete from admin_audit_log where actor_id in (select id from users where email like 'e2e-%@test.ohviana.dev')`;
  await sql`delete from users where email like 'e2e-%@test.ohviana.dev'`;
}

/** Removes the sign-in codes and phone-only accounts that checkout created for these numbers. */
export async function removePhoneSignIns(phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  await sql`delete from phone_otps where phone = any(${phones})`;
  await sql`
    delete from users u where u.phone = any(${phones}) and u.email is null
      and not exists (select 1 from bookings k where k.user_id = u.id)`;
}
