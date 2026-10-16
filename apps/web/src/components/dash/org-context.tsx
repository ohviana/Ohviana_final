'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import type { z } from 'zod';
import type { Membership, MeResponse } from '@ohviana/contracts';
import { roleHasPermission, statusAllowsPermission, type OrgPermission } from '@ohviana/shared';
import { authedFetch, type AuthedOptions } from '@/lib/authed';

interface OrgContextValue {
  me: MeResponse;
  org: Membership;
  /** Calls /v1/organizer/* for the active organizer. */
  call: <T extends z.ZodType>(
    path: string,
    schema: T,
    opts?: Omit<AuthedOptions, 'organizerId'>,
  ) => Promise<z.infer<T>>;
  /** Mirrors the API's permission rules so the UI can hide what would be refused anyway. */
  can: (permission: OrgPermission) => boolean;
  reloadMe: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  me,
  org,
  reloadMe,
  children,
}: {
  me: MeResponse;
  org: Membership;
  reloadMe: () => Promise<void>;
  children: ReactNode;
}) {
  const call = useCallback(
    <T extends z.ZodType>(path: string, schema: T, opts: Omit<AuthedOptions, 'organizerId'> = {}) =>
      authedFetch(`/v1/organizer${path}`, schema, { ...opts, organizerId: org.organizerId }),
    [org.organizerId],
  );
  const can = useCallback(
    (p: OrgPermission) => roleHasPermission(org.role, p) && statusAllowsPermission(org.status, p),
    [org.role, org.status],
  );
  return (
    <OrgContext.Provider value={{ me, org, call, can, reloadMe }}>{children}</OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used inside the organizer dashboard');
  return ctx;
}
