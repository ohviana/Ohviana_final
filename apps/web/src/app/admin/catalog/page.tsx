'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CatalogTrek, CatalogTrekList } from '@ohviana/contracts';
import { CONTENT_STATUSES, type ContentStatus } from '@ohviana/shared';
import { useLoad } from '@/components/dash/hooks';
import { Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { qs } from '@/lib/api';
import { authedFetch } from '@/lib/authed';
import { CatalogForm } from './CatalogForm';

export default function AdminCatalogPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ContentStatus | undefined>();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useLoad(
    () =>
      authedFetch(
        `/v1/admin/catalog-treks${qs({ status, query: submitted || undefined, limit: 100 })}`,
        CatalogTrekList,
      ),
    [status, submitted],
  );

  return (
    <>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Catalog</h1>
        <button type="button" className="secondary" onClick={() => setCreating(!creating)}>
          {creating ? 'Close' : 'New catalog trek'}
        </button>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Canonical treks power search and the indexed trek pages.
      </p>

      {creating && (
        <CatalogForm
          submitLabel="Create"
          onSubmit={async (body) => {
            const created = await authedFetch('/v1/admin/catalog-treks', CatalogTrek, {
              method: 'POST',
              body,
            });
            router.push(`/admin/catalog/${created.id}`);
          }}
        />
      )}

      <div className="cluster">
        <div className="tabs" role="group" aria-label="Filter by status">
          {([undefined, ...CONTENT_STATUSES] as const).map((s) => (
            <button
              key={s ?? 'all'}
              type="button"
              aria-pressed={s === status}
              onClick={() => setStatus(s)}
            >
              {s ?? 'all'}
            </button>
          ))}
        </div>
        <form
          className="cluster"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <input
            aria-label="Search catalog"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <button type="submit" className="secondary">
            Search
          </button>
        </form>
      </div>

      <Outcome error={list.error} />
      {list.loading && !list.data && <Loading />}
      {list.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>District</th>
                <th>Difficulty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/catalog/${t.id}`}>{t.name}</Link>
                    <div className="muted small">/{t.slug}</div>
                  </td>
                  <td>{t.district ?? '—'}</td>
                  <td>{t.difficulty ?? '—'}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
