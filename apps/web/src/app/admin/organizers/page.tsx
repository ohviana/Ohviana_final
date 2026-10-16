'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useState } from 'react';
import { AdminOrganizer, AdminOrganizerList } from '@ohviana/contracts';
import { ORGANIZER_STATUSES, type OrganizerStatus } from '@ohviana/shared';
import { useAction, useLoad } from '@/components/dash/hooks';
import { askReason, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { qs } from '@/lib/api';
import { authedFetch } from '@/lib/authed';
import { bpsToPercent, percentToBps } from '@/lib/datetime';
import { longDate } from '@/lib/format';

function askCommission(current?: number): number | null {
  const input = window.prompt(
    'Marketplace commission (%) agreed with this organizer',
    current !== undefined ? bpsToPercent(current) : '7.5',
  );
  if (input === null) return null;
  const bps = percentToBps(input);
  if (bps === null) {
    window.alert('Enter a percentage between 0 and 100, e.g. 7.5');
    return null;
  }
  return bps;
}

function OrganizersInner() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('status');
  const status = (ORGANIZER_STATUSES as readonly string[]).includes(raw ?? '')
    ? (raw as OrganizerStatus)
    : undefined;
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const list = useLoad(
    () =>
      authedFetch(
        `/v1/admin/organizers${qs({ status, query: submittedQuery || undefined, limit: 100 })}`,
        AdminOrganizerList,
      ),
    [status, submittedQuery],
  );
  const action = useAction();

  const act = (
    o: AdminOrganizer,
    kind: 'approve' | 'reject' | 'suspend' | 'reinstate' | 'commission',
  ) => {
    let body: Record<string, unknown> = {};
    if (kind === 'approve' || kind === 'commission') {
      const bps = askCommission(o.commissionRateBps || undefined);
      if (bps === null) return;
      body = { commissionRateBps: bps };
      if (kind === 'commission') {
        const note = askReason('Reason for the commission change (kept in the audit log)');
        if (!note) return;
        body.note = note;
      }
    }
    if (kind === 'reject' || kind === 'suspend') {
      const note = askReason(
        kind === 'reject'
          ? 'Why are you rejecting? (shown to the organizer)'
          : 'Why are you suspending? (shown to the organizer)',
      );
      if (!note) return;
      body = { note };
    }
    const path =
      kind === 'commission'
        ? `/v1/admin/organizers/${o.id}/commission`
        : `/v1/admin/organizers/${o.id}/${kind}`;
    void action.run(
      async () => {
        await authedFetch(path, AdminOrganizer, {
          method: kind === 'commission' ? 'PUT' : 'POST',
          body,
        });
        await list.reload();
      },
      `${o.name}: ${kind === 'commission' ? 'commission updated' : `${kind} done`}.`,
    );
  };

  return (
    <>
      <h1 style={{ margin: 0 }}>Organizers</h1>
      <div className="tabs" role="group" aria-label="Filter by status">
        {(['all', ...ORGANIZER_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={(s === 'all' && !status) || s === status}
            onClick={() =>
              router.replace(s === 'all' ? '/admin/organizers' : `/admin/organizers?status=${s}`)
            }
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQuery(query.trim());
        }}
      >
        <input
          aria-label="Search organizers"
          placeholder="Search by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: '1 1 240px', width: 'auto' }}
        />
        <button type="submit" className="secondary">
          Search
        </button>
      </form>

      <Outcome error={action.error ?? list.error} message={action.message} />
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.items.length === 0 && <p className="muted">No organizers.</p>}
      {list.data && list.data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organizer</th>
                <th>Status</th>
                <th>Commission</th>
                <th>Members</th>
                <th>Registered</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((o) => (
                <Fragment key={o.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        className="small secondary"
                        onClick={() => setOpen(open === o.id ? null : o.id)}
                        aria-expanded={open === o.id}
                      >
                        {o.name}
                      </button>
                      {o.city && <div className="muted small">{o.city}</div>}
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{bpsToPercent(o.commissionRateBps)}%</td>
                    <td>{o.memberCount}</td>
                    <td>{longDate(o.createdAt)}</td>
                    <td>
                      <div className="cluster">
                        {(o.status === 'pending' || o.status === 'rejected') && (
                          <button
                            type="button"
                            className="small"
                            disabled={action.pending}
                            onClick={() => act(o, 'approve')}
                          >
                            Approve
                          </button>
                        )}
                        {o.status === 'pending' && (
                          <button
                            type="button"
                            className="small danger"
                            disabled={action.pending}
                            onClick={() => act(o, 'reject')}
                          >
                            Reject
                          </button>
                        )}
                        {o.status === 'approved' && (
                          <>
                            <button
                              type="button"
                              className="small secondary"
                              disabled={action.pending}
                              onClick={() => act(o, 'commission')}
                            >
                              Commission
                            </button>
                            <button
                              type="button"
                              className="small danger"
                              disabled={action.pending}
                              onClick={() => act(o, 'suspend')}
                            >
                              Suspend
                            </button>
                          </>
                        )}
                        {o.status === 'suspended' && (
                          <button
                            type="button"
                            className="small"
                            disabled={action.pending}
                            onClick={() => act(o, 'reinstate')}
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === o.id && (
                    <tr>
                      <td colSpan={6}>
                        <dl className="kv small">
                          <dt>Slug</dt>
                          <dd>{o.slug}</dd>
                          <dt>Contact</dt>
                          <dd>
                            {[o.contactEmail, o.contactPhone].filter(Boolean).join(' · ') || '—'}
                          </dd>
                          <dt>GSTIN</dt>
                          <dd>{o.gstin ?? '—'}</dd>
                          <dt>Tagline</dt>
                          <dd>{o.tagline ?? '—'}</dd>
                          <dt>Last review</dt>
                          <dd>
                            {o.reviewedAt
                              ? `${longDate(o.reviewedAt)}${o.reviewNote ? ` — “${o.reviewNote}”` : ''}`
                              : '—'}
                          </dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AdminOrganizersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrganizersInner />
    </Suspense>
  );
}
