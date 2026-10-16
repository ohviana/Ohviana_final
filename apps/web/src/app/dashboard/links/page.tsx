'use client';

import { useState, type FormEvent } from 'react';
import { DirectLink, DirectLinkList, OrganizerBatchList } from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { dateRange, longDate } from '@/lib/format';
import { shareUrl } from './share';

export default function LinksPage() {
  const { call, can, org } = useOrg();
  const links = useLoad(() => call('/direct-links', DirectLinkList), [call]);
  const batches = useLoad(
    () => call('/batches?view=upcoming&limit=100', OrganizerBatchList),
    [call],
  );
  const action = useAction();
  const [label, setLabel] = useState('');
  const [batchId, setBatchId] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const batchName = (id: string | null) => {
    if (!id) return 'All your departures';
    const b = batches.data?.items.find((x) => x.id === id);
    return b ? `${b.trekTitle} · ${dateRange(b.departureAt, b.returnAt)}` : 'One departure';
  };

  async function create(e: FormEvent) {
    e.preventDefault();
    await action.run(async () => {
      await call('/direct-links', DirectLink, {
        method: 'POST',
        body: { ...(label.trim() ? { label: label.trim() } : {}), ...(batchId ? { batchId } : {}) },
      });
      setLabel('');
      await links.reload();
    }, 'Link created.');
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this link:', shareUrl(token));
    }
  }

  const deactivate = (id: string) => {
    if (
      !confirm(
        'Deactivate this link? People who open it will no longer be able to book through it.',
      )
    )
      return;
    void action.run(async () => {
      await call(`/direct-links/${id}/deactivate`, DirectLink, { method: 'POST' });
      await links.reload();
    }, 'Link deactivated.');
  };

  return (
    <>
      <div className="stack">
        <h1 style={{ margin: 0 }}>Direct booking links</h1>
        <p className="muted" style={{ margin: 0 }}>
          Share these with your own customers (WhatsApp, Instagram bio). Bookings made through them
          carry <strong>0% marketplace commission</strong>.
        </p>
      </div>

      {can('links:write') ? (
        <form onSubmit={create} className="card form-grid">
          <div className="field">
            <label htmlFor="l-label">
              Label <span className="hint">(for you)</span>
            </label>
            <input
              id="l-label"
              placeholder="Instagram bio"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="l-batch">Link to</label>
            <select id="l-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">All your departures</option>
              {batches.data?.items.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.trekTitle} · {dateRange(b.departureAt, b.returnAt)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={action.pending}>
            Create link
          </button>
        </form>
      ) : (
        org.status === 'pending' && (
          <p className="notice warn small">
            You can create links once your organization is approved.
          </p>
        )
      )}

      <Outcome error={action.error ?? links.error} message={action.message} />
      {links.loading && !links.data && <Loading />}
      {links.data && links.data.items.length === 0 && <p className="muted">No links yet.</p>}
      {links.data && links.data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Opens</th>
                <th>Created</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {links.data.items.map((l) => (
                <tr key={l.id}>
                  <td>{l.label ?? '—'}</td>
                  <td>{batchName(l.batchId)}</td>
                  <td>{longDate(l.createdAt)}</td>
                  <td>
                    <StatusBadge status={l.active ? 'active' : 'inactive'} />
                  </td>
                  <td>
                    {l.active && (
                      <div className="cluster">
                        <button type="button" className="small" onClick={() => copy(l.token)}>
                          {copied === l.token ? 'Copied!' : 'Copy link'}
                        </button>
                        {can('links:write') && (
                          <button
                            type="button"
                            className="small secondary"
                            onClick={() => deactivate(l.id)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    )}
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
