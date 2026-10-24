'use client';

import Link from 'next/link';
import { OrganizerTrekList } from '@ohviana/contracts';
import { Icon } from '@/components/Icon';
import { useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { EmptyState, Loading, Outcome, StatusBadge } from '@/components/dash/ui';

export default function TreksPage() {
  const { call, can } = useOrg();
  const treks = useLoad(() => call('/treks', OrganizerTrekList), [call]);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Your offerings</span>
          <h1>Treks</h1>
        </div>
        {can('treks:write') && (
          <Link href="/dashboard/treks/new" className="btn">
            <Icon name="sparkle" size={16} /> New trek
          </Link>
        )}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        A trek holds what stays the same — itinerary, inclusions, pickups and policy. Each trip on
        it is a batch with its own dates, seats and attendee list.
      </p>

      <Outcome error={treks.error} />
      {treks.loading && !treks.data && <Loading />}
      {treks.data && treks.data.items.length === 0 && (
        <EmptyState icon="mountain" title="No treks yet">
          <span className="muted small">
            {can('treks:write') ? (
              <>
                <Link href="/dashboard/treks/new">Add your first trek</Link> — one form, takes a
                couple of minutes.
              </>
            ) : (
              'Your team has not added any treks yet.'
            )}
          </span>
        </EmptyState>
      )}
      {treks.data && treks.data.items.length > 0 && (
        <div className="grid-cards">
          {treks.data.items.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/treks/${t.id}`}
              className="card stack"
              style={{ gap: 8 }}
            >
              <div className="spread">
                <span className="icon-circle" style={{ width: 40, height: 40 }}>
                  <Icon name="mountain" />
                </span>
                {t.status === 'archived' && <StatusBadge status={t.status} />}
              </div>
              <h3 style={{ margin: 0 }}>{t.title}</h3>
              <span className="meta-line">
                <Icon name="pin" size={14} /> {t.catalogTrekName ?? 'Destination not set'}
              </span>
              <span className="meta-line">
                <Icon name="users" size={14} /> {t.pickupPoints.length} pickup point
                {t.pickupPoints.length === 1 ? '' : 's'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
