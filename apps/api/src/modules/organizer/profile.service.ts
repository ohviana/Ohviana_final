import { and, asc, count, eq, sql } from 'drizzle-orm';
import { organizerMembers, organizers, pgConstraintName, users, type Database } from '@ohviana/db';
import type {
  AddMemberRequest,
  Member,
  OrganizerProfile,
  RegisterOrganizerRequest,
  UpdateOrganizerProfileRequest,
} from '@ohviana/contracts';
import { slugify, type OrganizerRole } from '@ohviana/shared';
import { enqueueEvent } from '../../lib/audit';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors';

/** Guards against one account spawning organizers in bulk. */
export const MAX_OWNED_ORGANIZERS = 5;

type OrganizerRow = typeof organizers.$inferSelect;

export function toProfileDto(r: OrganizerRow): OrganizerProfile {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    tagline: r.tagline,
    description: r.description,
    logoUrl: r.logoUrl,
    city: r.city,
    contactEmail: r.contactEmail,
    contactPhone: r.contactPhone,
    gstin: r.gstin,
    commissionRateBps: r.commissionRateBps,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function rethrowSlugConflict(err: unknown, slug: string): never {
  if (pgConstraintName(err) === 'organizers_slug_uq') {
    throw conflict(`The name "${slug}" is already taken; choose a different slug`);
  }
  throw err;
}

/** Creates a pending organizer with the caller as owner, and notifies admins. */
export async function registerOrganizer(
  db: Database,
  userId: string,
  input: RegisterOrganizerRequest,
): Promise<OrganizerProfile> {
  const slug = input.slug ?? slugify(input.name);
  if (slug.length < 2) throw badRequest('Could not derive a slug from the name; provide one');

  return db.transaction(async (tx) => {
    // Serialize registrations per user so the ownership cap can't be raced.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`register:${userId}`}))`);
    const [owned] = await tx
      .select({ n: count() })
      .from(organizerMembers)
      .where(and(eq(organizerMembers.userId, userId), eq(organizerMembers.role, 'owner')));
    if ((owned?.n ?? 0) >= MAX_OWNED_ORGANIZERS) {
      throw conflict(`You already own ${MAX_OWNED_ORGANIZERS} organizers`);
    }

    let row: OrganizerRow;
    try {
      [row] = (await tx
        .insert(organizers)
        .values({ ...input, slug, status: 'pending' })
        .returning()) as [OrganizerRow];
    } catch (err) {
      rethrowSlugConflict(err, slug);
    }
    await tx.insert(organizerMembers).values({ organizerId: row.id, userId, role: 'owner' });
    await enqueueEvent(tx, 'organizer.registered', {
      organizerId: row.id,
      name: row.name,
      registeredBy: userId,
    });
    return toProfileDto(row);
  });
}

export async function getProfile(db: Database, organizerId: string): Promise<OrganizerProfile> {
  const [row] = await db.select().from(organizers).where(eq(organizers.id, organizerId));
  if (!row) throw notFound('Organizer');
  return toProfileDto(row);
}

export async function updateProfile(
  db: Database,
  organizerId: string,
  input: UpdateOrganizerProfileRequest,
): Promise<OrganizerProfile> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: organizers.status, slug: organizers.slug })
      .from(organizers)
      .where(eq(organizers.id, organizerId))
      .for('update');
    if (!current) throw notFound('Organizer');
    if (input.slug !== undefined && input.slug !== current.slug && current.status !== 'pending') {
      throw conflict('The slug can only be changed before approval');
    }
    try {
      const [row] = await tx
        .update(organizers)
        .set(input)
        .where(eq(organizers.id, organizerId))
        .returning();
      return toProfileDto(row!);
    } catch (err) {
      rethrowSlugConflict(err, input.slug ?? current.slug);
    }
  });
}

// ---------- Members ----------

export async function listMembers(db: Database, organizerId: string): Promise<Member[]> {
  const rows = await db
    .select({
      userId: organizerMembers.userId,
      email: users.email,
      fullName: users.fullName,
      role: organizerMembers.role,
      createdAt: organizerMembers.createdAt,
    })
    .from(organizerMembers)
    .innerJoin(users, eq(users.id, organizerMembers.userId))
    .where(eq(organizerMembers.organizerId, organizerId))
    .orderBy(asc(organizerMembers.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Adds an existing Ohviana account (they must have signed in once) to the organizer. */
export async function addMember(
  db: Database,
  organizerId: string,
  input: AddMemberRequest,
): Promise<Member[]> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`);
  if (!user) {
    throw new AppError(
      'NOT_FOUND',
      'No Ohviana account uses that email. Ask them to sign in once, then retry.',
    );
  }
  const inserted = await db
    .insert(organizerMembers)
    .values({ organizerId, userId: user.id, role: input.role })
    .onConflictDoNothing()
    .returning({ userId: organizerMembers.userId });
  if (inserted.length === 0) throw conflict('That person is already a member');
  return listMembers(db, organizerId);
}

/**
 * Changes a member's role or removes them, never leaving the organizer without an owner.
 * Owner rows are locked so two concurrent demotions can't both pass the check.
 */
export async function changeMember(
  db: Database,
  organizerId: string,
  targetUserId: string,
  change: { role: OrganizerRole } | 'remove',
): Promise<Member[]> {
  await db.transaction(async (tx) => {
    const owners = await tx
      .select({ userId: organizerMembers.userId })
      .from(organizerMembers)
      .where(and(eq(organizerMembers.organizerId, organizerId), eq(organizerMembers.role, 'owner')))
      .for('update');

    const [target] = await tx
      .select({ role: organizerMembers.role })
      .from(organizerMembers)
      .where(
        and(
          eq(organizerMembers.organizerId, organizerId),
          eq(organizerMembers.userId, targetUserId),
        ),
      );
    if (!target) throw notFound('Member');

    const losesOwner = target.role === 'owner' && (change === 'remove' || change.role !== 'owner');
    if (losesOwner && owners.length <= 1) {
      throw conflict('An organizer must keep at least one owner');
    }

    const where = and(
      eq(organizerMembers.organizerId, organizerId),
      eq(organizerMembers.userId, targetUserId),
    );
    if (change === 'remove') await tx.delete(organizerMembers).where(where);
    else await tx.update(organizerMembers).set({ role: change.role }).where(where);
  });
  return listMembers(db, organizerId);
}
