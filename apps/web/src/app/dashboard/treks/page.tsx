'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { OrganizerTrek, OrganizerTrekList } from '@ohviana/contracts';
import { Icon } from '@/components/Icon';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { EmptyState, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { DestinationInput } from './DestinationInput';

export default function TreksPage() {
  const { call, can } = useOrg();
  const router = useRouter();
  const treks = useLoad(() => call('/treks', OrganizerTrekList), [call]);
  const action = useAction();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');

  async function create(e: FormEvent) {
    e.preventDefault();
    const created = await action.run(() =>
      call('/treks', OrganizerTrek, {
        method: 'POST',
        body: { title: title.trim(), catalogTrekName: destination.trim() },
      }),
    );
    if (created) router.push(`/dashboard/treks/${created.id}`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Your offerings</span>
          <h1>Treks</h1>
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        A trek holds what stays the same — itinerary, inclusions, pickups and policy. Add dated
        departures to it, and publish them to start taking bookings.
      </p>

      {can('treks:write') && (
        <form onSubmit={create} className="card stack">
          <h2 className="cluster" style={{ gap: 8, margin: 0 }}>
            <Icon name="sparkle" /> New trek
          </h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="nt-title">Trek name</label>
              <input
                id="nt-title"
                required
                minLength={2}
                placeholder="Kudremukh Weekend Trek"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <DestinationInput value={destination} onChange={setDestination} />
          </div>
          <Outcome error={action.error} />
          <button type="submit" disabled={action.pending} style={{ alignSelf: 'flex-start' }}>
            Create trek <Icon name="arrowRight" size={16} />
          </button>
        </form>
      )}

      <Outcome error={treks.error} />
      {treks.loading && !treks.data && <Loading />}
      {treks.data && treks.data.items.length === 0 && (
        <EmptyState icon="mountain" title="No treks yet">
          <span className="muted small">Create your first trek above — it takes a minute.</span>
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
                <StatusBadge status={t.status} />
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
