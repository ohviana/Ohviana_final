'use client';

import { useState } from 'react';
import { AuditList, type AuditEntry } from '@ohviana/contracts';
import { useLoad } from '@/components/dash/hooks';
import { Loading, Outcome } from '@/components/dash/ui';
import { qs } from '@/lib/api';
import { authedFetch } from '@/lib/authed';
import { dateTime } from '@/lib/format';

const ENTITY_TYPES = ['organizer', 'catalog_trek', 'catalog_request', 'user'] as const;

export default function AuditPage() {
  const [entityType, setEntityType] = useState<string>('');
  const [extra, setExtra] = useState<AuditEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useLoad(async () => {
    const page = await authedFetch(
      `/v1/admin/audit-log${qs({ entityType: entityType || undefined, limit: 50 })}`,
      AuditList,
    );
    setExtra([]);
    setCursor(page.nextCursor);
    return page.items;
  }, [entityType]);

  async function more() {
    if (!cursor) return;
    const page = await authedFetch(
      `/v1/admin/audit-log${qs({ entityType: entityType || undefined, limit: 50, cursor })}`,
      AuditList,
    );
    setExtra((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
  }

  const rows = [...(list.data ?? []), ...extra];
  return (
    <>
      <h1 style={{ margin: 0 }}>Audit log</h1>
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="a-type">Entity</label>
        <select id="a-type" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">All</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <Outcome error={list.error} />
      {list.loading && !list.data && <Loading />}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When (IST)</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dateTime(a.createdAt)}</td>
                  <td>{a.actorEmail ?? a.actorId}</td>
                  <td>
                    <code>{a.action}</code>
                  </td>
                  <td className="small muted" style={{ wordBreak: 'break-word' }}>
                    {JSON.stringify(a.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && rows.length === 0 && <p className="muted">No entries.</p>}
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
