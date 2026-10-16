import type { OrganizerRole, OrganizerStatus } from './domain';

/** Everything a member of an organizer can do. Routes declare one; roles grant a set. */
export const ORG_PERMISSIONS = [
  'org:read',
  'org:edit_profile',
  'org:manage_members',
  'treks:write',
  'batches:write',
  /** Making a batch bookable. Requires an approved organizer. */
  'batches:publish',
  'links:write',
  'bookings:read',
  'bookings:manage',
] as const;
export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<OrganizerRole, readonly OrgPermission[]> = {
  owner: ORG_PERMISSIONS,
  manager: [
    'org:read',
    'org:edit_profile',
    'treks:write',
    'batches:write',
    'batches:publish',
    'links:write',
    'bookings:read',
    'bookings:manage',
  ],
  staff: ['org:read', 'bookings:read'],
};

/** Permissions still allowed while an organizer is not approved. */
const LIMITED_STATUS_PERMISSIONS: Record<
  Exclude<OrganizerStatus, 'approved'>,
  readonly OrgPermission[]
> = {
  // Pending organizers can prepare their profile and drafts before approval.
  pending: ['org:read', 'org:edit_profile', 'org:manage_members', 'treks:write', 'batches:write'],
  // Rejected/suspended organizers keep read access to their own records only.
  rejected: ['org:read', 'bookings:read'],
  suspended: ['org:read', 'bookings:read'],
};

export function roleHasPermission(role: OrganizerRole, permission: OrgPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function statusAllowsPermission(
  status: OrganizerStatus,
  permission: OrgPermission,
): boolean {
  return status === 'approved' || LIMITED_STATUS_PERMISSIONS[status].includes(permission);
}
