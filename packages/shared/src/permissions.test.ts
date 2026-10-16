import { describe, expect, it } from 'vitest';
import { ORG_PERMISSIONS, roleHasPermission, statusAllowsPermission } from './permissions';

describe('role permissions', () => {
  it('gives owners everything', () => {
    for (const p of ORG_PERMISSIONS) expect(roleHasPermission('owner', p)).toBe(true);
  });

  it('keeps member management with owners only', () => {
    expect(roleHasPermission('manager', 'org:manage_members')).toBe(false);
    expect(roleHasPermission('staff', 'org:manage_members')).toBe(false);
  });

  it('limits staff to reading', () => {
    expect(roleHasPermission('staff', 'bookings:read')).toBe(true);
    expect(roleHasPermission('staff', 'batches:write')).toBe(false);
  });
});

describe('status permissions', () => {
  it('lets pending organizers prepare drafts but not share links or manage bookings', () => {
    expect(statusAllowsPermission('pending', 'treks:write')).toBe(true);
    expect(statusAllowsPermission('pending', 'links:write')).toBe(false);
    expect(statusAllowsPermission('pending', 'batches:publish')).toBe(false);
    expect(statusAllowsPermission('pending', 'bookings:manage')).toBe(false);
  });

  it('makes suspended organizers read-only', () => {
    expect(statusAllowsPermission('suspended', 'bookings:read')).toBe(true);
    expect(statusAllowsPermission('suspended', 'batches:write')).toBe(false);
  });
});
