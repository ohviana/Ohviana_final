'use client';

import { useState } from 'react';
import {
  ApproveCatalogRequestResponse,
  CatalogRequest,
  CatalogRequestList,
  CatalogTrekList,
} from '@ohviana/contracts';
import { CATALOG_REQUEST_STATUSES, type CatalogRequestStatus } from '@ohviana/shared';
import { useAction, useLoad } from '@/components/dash/hooks';
import { askReason, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { qs } from '@/lib/api';
import { authedFetch } from '@/lib/authed';
import { longDate } from '@/lib/format';
import { CatalogForm } from '../catalog/CatalogForm';

export default function AdminRequestsPage() {
  const [status, setStatus] = useState<CatalogRequestStatus>('pending');
  const list = useLoad(
    () =>
      authedFetch(`/v1/admin/catalog-requests${qs({ status, limit: 100 })}`, CatalogRequestList),
    [status],
  );
  const action = useAction();
  const [open, setOpen] = useState<{ id: string; mode: 'link' | 'create' } | null>(null);

  const done = async (msg: string) => {
    setOpen(null);
    await list.reload();
    return msg;
  };

  const reject = (r: CatalogRequest) => {
    const note = askReason(`Why reject “${r.name}”? (shown to the organizer)`);
    if (!note) return;
    void action.run(async () => {
      await authedFetch(`/v1/admin/catalog-requests/${r.id}/reject`, CatalogRequest, {
        method: 'POST',
        body: { note },
      });
      await done('');
    }, `Rejected “${r.name}”.`);
  };

  return (
    <>
      <h1 style={{ margin: 0 }}>Catalog requests</h1>
      <p className="muted" style={{ margin: 0 }}>
        Organizers ask for treks missing from the catalog. Approving links any of their waiting
        draft treks automatically.
      </p>
      <div className="tabs" role="group" aria-label="Filter by status">
        {CATALOG_REQUEST_STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={s === status} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      <Outcome error={action.error ?? list.error} message={action.message} />
      {list.loading && !list.data && <Loading />}
      {list.data?.items.length === 0 && <p className="muted">Nothing here.</p>}
      {list.data?.items.map((r) => (
        <div key={r.id} className="card stack">
          <div className="spread">
            <div className="stack" style={{ gap: 2 }}>
              <strong>{r.name}</strong>
              <span className="muted small">
                {[r.district, r.region, r.state].filter(Boolean).join(', ') || 'No location given'}{' '}
                · from {r.organizerName} · {longDate(r.createdAt)}
              </span>
              {r.notes && <span className="small">“{r.notes}”</span>}
              {r.reviewNote && <span className="small muted">Review: {r.reviewNote}</span>}
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.status === 'pending' && (
            <div className="cluster">
              <button
                type="button"
                className="small"
                onClick={() => setOpen({ id: r.id, mode: 'create' })}
              >
                Approve as new trek
              </button>
              <button
                type="button"
                className="small secondary"
                onClick={() => setOpen({ id: r.id, mode: 'link' })}
              >
                Link to existing
              </button>
              <button type="button" className="small danger" onClick={() => reject(r)}>
                Reject
              </button>
            </div>
          )}
          {open?.id === r.id && open.mode === 'create' && (
            <CatalogForm
              initialName={r.name}
              submitLabel="Create catalog trek & approve"
              onSubmit={async (create) => {
                const res = await authedFetch(
                  `/v1/admin/catalog-requests/${r.id}/approve`,
                  ApproveCatalogRequestResponse,
                  {
                    method: 'POST',
                    body: {
                      create: {
                        ...create,
                        ...(r.district && !create.district ? { district: r.district } : {}),
                      },
                    },
                  },
                );
                await action.run(
                  () => done(''),
                  `Approved “${r.name}”; ${res.linkedOrganizerTreks} waiting trek(s) linked.`,
                );
              }}
            />
          )}
          {open?.id === r.id && open.mode === 'link' && (
            <LinkExisting
              name={r.name}
              onPick={(catalogTrekId) =>
                action.run(async () => {
                  const res = await authedFetch(
                    `/v1/admin/catalog-requests/${r.id}/approve`,
                    ApproveCatalogRequestResponse,
                    {
                      method: 'POST',
                      body: { catalogTrekId },
                    },
                  );
                  await done('');
                  return res;
                }, `Approved “${r.name}” by linking an existing trek.`)
              }
            />
          )}
        </div>
      ))}
    </>
  );
}

function LinkExisting({ name, onPick }: { name: string; onPick: (catalogTrekId: string) => void }) {
  const [query, setQuery] = useState(name);
  const [submitted, setSubmitted] = useState(name);
  const results = useLoad(
    () =>
      authedFetch(
        `/v1/admin/catalog-treks${qs({ query: submitted || undefined, status: 'published', limit: 10 })}`,
        CatalogTrekList,
      ),
    [submitted],
  );
  return (
    <div className="stack">
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <input
          aria-label="Search published catalog"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: '1 1 220px', width: 'auto' }}
        />
        <button type="submit" className="secondary small">
          Search
        </button>
      </form>
      <div className="cluster">
        {results.data?.items.length === 0 && (
          <span className="muted small">No published matches.</span>
        )}
        {results.data?.items.map((t) => (
          <button key={t.id} type="button" className="small secondary" onClick={() => onPick(t.id)}>
            Link to {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
