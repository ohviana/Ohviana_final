'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { MeResponse } from '@ohviana/contracts';
import { useLoad } from '@/components/dash/hooks';
import { Avatar, Loading, Shell, type NavItem } from '@/components/dash/ui';
import { authedFetch } from '@/lib/authed';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: 'grid' },
  { href: '/admin/organizers', label: 'Organizers', icon: 'building' },
  { href: '/admin/catalog', label: 'Catalog', icon: 'mountain' },
  { href: '/admin/requests', label: 'Catalog requests', icon: 'inbox' },
  { href: '/admin/audit', label: 'Audit log', icon: 'clipboard' },
];

/** UX gate only: every /v1/admin call is authorized by the API. */
export function AdminFrame({ children }: { children: ReactNode }) {
  const me = useLoad(() => authedFetch('/v1/me', MeResponse), []);
  if (me.loading && !me.data) {
    return (
      <div className="container">
        <Loading />
      </div>
    );
  }
  if (!me.data?.isAdmin) {
    return (
      <div className="container narrow stack">
        <h1>Admins only</h1>
        <p className="muted">
          {me.data ? (
            'Your account does not have admin access.'
          ) : (
            <>
              <Link href="/login">Sign in</Link> with an admin account.
            </>
          )}
        </p>
      </div>
    );
  }
  return (
    <Shell
      title="Ohviana admin"
      nav={NAV}
      aside={
        <div className="dash-org">
          <Avatar name={me.data.user.fullName ?? me.data.user.email ?? 'Admin'} />
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <strong>Ohviana admin</strong>
            <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {me.data.user.email}
            </span>
          </div>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
