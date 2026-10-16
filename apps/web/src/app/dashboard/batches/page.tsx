'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { z } from 'zod';
import { OrganizerBatch, OrganizerBatchList } from '@ohviana/contracts';
import { BATCH_VIEWS, type BatchView } from '@ohviana/shared';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { EmptyState, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { qs } from '@/lib/api';
import { dateRange, dateTime, price } from '@/lib/format';

const TAB_ORDER: (BatchView | 'all')[] = [
  'all',
  'upcoming',
  'draft',
  'sold_out',
  'booking_closed',
  'ongoing',
  'completed',
  'cancelled',
];

function BatchesInner() {
  const { call, can } = useOrg();
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('view');
  const view = (BATCH_VIEWS as readonly string[]).includes(initial ?? '')
    ? (initial as BatchView)
    : 'all';

  const [extra, setExtra] = useState<OrganizerBatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useLoad(async () => {
    const page = await call(
      `/batches${qs({ view: view === 'all' ? undefined : view, limit: 50 })}`,
      OrganizerBatchList,
    );
    setExtra([]);
    setCursor(page.nextCursor);
    return page.items;
  }, [call, view]);
  const action = useAction();

  async function more() {
    if (!cursor) return;
    const page = await call(
      `/batches${qs({ view: view === 'all' ? undefined : view, limit: 50, cursor })}`,
      OrganizerBatchList,
    );
    setExtra((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
  }

  const publish = (id: string) =>
    action.run(async () => {
      await call(`/batches/${id}/publish`, OrganizerBatch, { method: 'POST' });
      await list.reload();
    }, 'Batch published — it is now bookable.');

  const remove = (id: string) => {
    if (!confirm('Delete this draft batch?')) return;
    void action.run(async () => {
      await call(`/batches/${id}`, z.null().or(z.unknown()), { method: 'DELETE' });
      await list.reload();
    }, 'Draft deleted.');
  };

  const rows = [...(list.data ?? []), ...extra];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Dated departures</span>
          <h1 style={{ margin: 0 }}>Departures</h1>
        </div>
        {can('batches:write') && (
          <Link href="/dashboard/treks" className="btn secondary">
            <Icon name="calendar" size={16} /> Add departures from a trek
          </Link>
        )}
      </div>

      <div className="tabs" role="group" aria-label="Filter batches">
        {TAB_ORDER.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === view}
            onClick={() =>
              router.replace(v === 'all' ? '/dashboard/batches' : `/dashboard/batches?view=${v}`)
            }
          >
            {v === 'all' ? 'All' : v.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <Outcome error={action.error ?? list.error} message={action.message} />
      {list.loading && !list.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon="calendar" title="No departures here">
          <span className="muted small">
            Open a trek and use <strong>Add batches</strong> to create one or a weekly series.
          </span>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dates</th>
                <th>Trek</th>
                <th>Price</th>
                <th>Seats</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/dashboard/batches/${b.id}`}>
                      {dateRange(b.departureAt, b.returnAt)}
                    </Link>
                    <div className="muted small">{dateTime(b.departureAt)}</div>
                  </td>
                  <td>{b.trekTitle}</td>
                  <td>{price(b.pricePaise)}</td>
                  <td>
                    {b.confirmedSeats}/{b.capacity}
                  </td>
                  <td>
                    <StatusBadge status={b.view} />
                  </td>
                  <td>
                    <div className="cluster">
                      {b.status === 'draft' && can('batches:publish') && (
                        <button
                          type="button"
                          className="small"
                          disabled={action.pending}
                          onClick={() => publish(b.id)}
                        >
                          Publish
                        </button>
                      )}
                      {b.status === 'draft' && can('batches:write') && (
                        <button
                          type="button"
                          className="small secondary"
                          disabled={action.pending}
                          onClick={() => remove(b.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <button
          type="button"
          className="secondary"
          onClick={more}
          style={{ alignSelf: 'flex-start' }}
        >
          Load more
        </button>
      )}
    </>
  );
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BatchesInner />
    </Suspense>
  );
}
