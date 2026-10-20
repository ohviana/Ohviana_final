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
import { BatchName, CopyLinkButton } from './[id]/BatchTools';

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
  const trekId = params.get('trekId') ?? undefined;

  const [extra, setExtra] = useState<OrganizerBatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useLoad(async () => {
    const page = await call(
      `/batches${qs({ view: view === 'all' ? undefined : view, trekId, limit: 50 })}`,
      OrganizerBatchList,
    );
    setExtra([]);
    setCursor(page.nextCursor);
    return page.items;
  }, [call, view, trekId]);
  const action = useAction();

  async function more() {
    if (!cursor) return;
    const page = await call(
      `/batches${qs({ view: view === 'all' ? undefined : view, trekId, limit: 50, cursor })}`,
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
          <span className="eyebrow">Your trips</span>
          <h1 style={{ margin: 0 }}>Batches</h1>
        </div>
        {can('batches:write') && (
          <Link href="/dashboard/treks" className="btn secondary">
            <Icon name="calendar" size={16} /> New batch from a trek
          </Link>
        )}
      </div>

      <div className="tabs" role="group" aria-label="Filter batches">
        {TAB_ORDER.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === view}
            onClick={() => {
              const next = new URLSearchParams({
                ...(v === 'all' ? {} : { view: v }),
                ...(trekId ? { trekId } : {}),
              }).toString();
              router.replace(next ? `/dashboard/batches?${next}` : '/dashboard/batches');
            }}
          >
            {v === 'all' ? 'All' : v.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {trekId && (
        <p className="small" style={{ margin: 0 }}>
          Showing one trek&apos;s batches · <Link href="/dashboard/batches">Show all</Link>
        </p>
      )}
      <Outcome error={action.error ?? list.error} message={action.message} />
      {list.loading && !list.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon="calendar" title="No batches here">
          <span className="muted small">
            Open a trek and use <strong>Add batches</strong>, or open a past batch and use{' '}
            <strong>Run this batch again</strong>.
          </span>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Batch</th>
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
                    <Link href={`/dashboard/batches/${b.id}`} className="batch-name">
                      <BatchName name={b.name} />
                    </Link>
                    <div className="muted small">
                      {dateRange(b.departureAt, b.returnAt)} · departs {dateTime(b.departureAt)}
                    </div>
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
                    <div
                      className="cluster"
                      style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}
                    >
                      {b.status === 'published' && b.bookingLinkToken && (
                        <CopyLinkButton token={b.bookingLinkToken} />
                      )}
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
