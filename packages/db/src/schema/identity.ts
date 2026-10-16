import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './_helpers';

/**
 * Application profile for an authenticated person. `id` mirrors Supabase `auth.users.id`
 * (the auth.users FK and sync trigger arrive with Phase 3).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email'),
    fullName: text('full_name'),
    phone: text('phone'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`)],
).enableRLS();

/** Platform administrators. Admin access is a separate, explicit grant (TDD §5). */
export const platformAdmins = pgTable('platform_admins', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  grantedBy: uuid('granted_by').references(() => users.id),
  createdAt: createdAt(),
}).enableRLS();

/** Append-only log of every admin action (TDD §7 "audit admin actions"). */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: id(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('admin_audit_entity_idx').on(t.entityType, t.entityId, t.createdAt)],
).enableRLS();

/**
 * Email + password sign-in handled by the Ohviana API (no third-party auth, no emails).
 * Stores only a salted scrypt hash. One row per user that has a password.
 */
export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();
