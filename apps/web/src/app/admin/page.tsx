'use client';

import Link from 'next/link';
import { AdminOrganizerList, CatalogRequestList } from '@ohviana/contracts';
import { useLoad } from '@/components/dash/hooks';
import { Outcome } from '@/components/dash/ui';
import { authedFetch } from '@/lib/authed';

export default function AdminOverview() {
  const counts = useLoad(async () => {
    const [pending, requests, approved] = await Promise.all([
      authedFetch('/v1/admin/organizers?status=pending&limit=100', AdminOrganizerList),
      authedFetch('/v1/admin/catalog-requests?status=pending&limit=100', CatalogRequestList),
      authedFetch('/v1/admin/organizers?status=approved&limit=100', AdminOrganizerList),
    ]);
    return {
      pending: pending.items.length,
      requests: requests.items.length,
      approved: approved.items.length,
    };
  }, []);

  return (
    <>
      <h1 style={{ margin: 0 }}>Admin</h1>
      <Outcome error={counts.error} />
      <div className="stat-grid">
        <Link href="/admin/organizers?status=pending" className="card stat">
          <strong>{counts.data?.pending ?? '…'}</strong>
          <span className="muted small">Organizers awaiting review</span>
        </Link>
        <Link href="/admin/requests" className="card stat">
          <strong>{counts.data?.requests ?? '…'}</strong>
          <span className="muted small">Catalog requests</span>
        </Link>
        <Link href="/admin/organizers?status=approved" className="card stat">
          <strong>{counts.data?.approved ?? '…'}</strong>
          <span className="muted small">Approved organizers</span>
        </Link>
      </div>
    </>
  );
}
