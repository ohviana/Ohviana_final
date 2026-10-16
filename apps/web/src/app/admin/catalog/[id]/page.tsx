'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuditList, CatalogTrek } from '@ohviana/contracts';
import { useLoad } from '@/components/dash/hooks';
import { Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { authedFetch } from '@/lib/authed';
import { dateTime } from '@/lib/format';
import { CatalogForm } from '../CatalogForm';

export default function AdminCatalogTrekPage() {
  const { id } = useParams<{ id: string }>();
  const trek = useLoad(() => authedFetch(`/v1/admin/catalog-treks/${id}`, CatalogTrek), [id]);
  const history = useLoad(
    () =>
      authedFetch(`/v1/admin/audit-log?entityType=catalog_trek&entityId=${id}&limit=20`, AuditList),
    [id],
  );

  if (trek.loading && !trek.data) return <Loading />;
  if (!trek.data) return <Outcome error={trek.error} />;
  const t = trek.data;

  return (
    <>
      <span className="small">
        <Link href="/admin/catalog">← Catalog</Link>
      </span>
      <div className="spread">
        <h1 style={{ margin: 0 }}>{t.name}</h1>
        <div className="cluster">
          <StatusBadge status={t.status} />
          {t.status === 'published' && <Link href={`/treks/${t.slug}`}>Public page</Link>}
        </div>
      </div>
      <CatalogForm
        trek={t}
        submitLabel="Save"
        onSubmit={async (body) => {
          trek.setData(
            await authedFetch(`/v1/admin/catalog-treks/${t.id}`, CatalogTrek, {
              method: 'PATCH',
              body,
            }),
          );
          await history.reload();
        }}
      />
      <section className="stack">
        <h2>History</h2>
        {history.data?.items.length === 0 && <p className="muted small">No changes recorded.</p>}
        {history.data?.items.map((a) => (
          <div key={a.id} className="small">
            <strong>{dateTime(a.createdAt)}</strong> · {a.actorEmail ?? a.actorId} · {a.action}{' '}
            <span className="muted">{JSON.stringify(a.payload.changes ?? a.payload)}</span>
          </div>
        ))}
      </section>
    </>
  );
}
