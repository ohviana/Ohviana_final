'use client';

import { useState, type FormEvent } from 'react';
import { MemberList, TrekLeadList, type Member, type TrekLeadSummary } from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Avatar, Loading, Outcome } from '@/components/dash/ui';
import { dateTime } from '@/lib/format';
import { prettyPhone, toE164 } from '@/lib/phone';
import { ROLE_LABELS } from '@/lib/roles';

const LEAD_STATUS: Record<TrekLeadSummary['status'], { label: string; tone: string }> = {
  active: { label: 'Has access', tone: 'ok' },
  not_signed_in: { label: 'Not signed in yet', tone: '' },
  revoked: { label: 'Revoked', tone: 'danger' },
};

/**
 * Owners (the owner plus co-owners, who share the same access) and trek leads, who are named
 * by mobile on batches and see only the batches they lead.
 */
export default function TeamPage() {
  const { call, can, me, reloadMe } = useOrg();
  const team = useLoad(() => call('/members', MemberList), [call]);
  const leads = useLoad(() => call('/trek-leads', TrekLeadList), [call]);
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState('');
  const manage = can('org:manage_members');
  const owners = team.data?.items.filter((m) => m.role !== 'trek_lead') ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = who.trim();
    const phone = value.includes('@') ? null : toE164(value);
    if (!value.includes('@') && !phone) {
      return action.setError('Enter an email, or a mobile number like 98765 43210.');
    }
    const result = await action.run(
      () =>
        call('/members', MemberList, {
          method: 'POST',
          body: phone ? { phone } : { email: value },
        }),
      'Co-owner added.',
    );
    if (result) {
      team.setData(result);
      setWho('');
      setAdding(false);
    }
  }

  function remove(m: Member) {
    const self = m.userId === me.user.id;
    if (!confirm(self ? 'Leave this organization?' : `Remove ${m.fullName ?? 'this co-owner'}?`)) {
      return;
    }
    void action.run(
      async () => {
        team.setData(await call(`/members/${m.userId}`, MemberList, { method: 'DELETE' }));
        if (self) await reloadMe();
      },
      self ? 'You left the organization.' : 'Co-owner removed.',
    );
  }

  function setLeadAccess(l: TrekLeadSummary, revoke: boolean) {
    if (revoke && !confirm(`Revoke ${l.name}'s access? They'll no longer see your batches.`)) {
      return;
    }
    void action.run(
      async () => {
        leads.setData(
          await call(`/trek-leads/${revoke ? 'revoke' : 'restore'}`, TrekLeadList, {
            method: 'POST',
            body: { phone: l.phone },
          }),
        );
        await team.reload();
      },
      revoke ? `${l.name}'s access revoked.` : `${l.name}'s access restored.`,
    );
  }

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <h1 style={{ margin: 0 }}>Team</h1>
        <p className="muted" style={{ margin: 0 }}>
          Owners run your organization. Trek leads see only the batches they lead.
        </p>
      </div>
      <Outcome error={action.error ?? team.error ?? leads.error} message={action.message} />

      <section className="card stack">
        <div className="spread">
          <div className="stack" style={{ gap: 2 }}>
            <h2 style={{ margin: 0 }}>Owners</h2>
            <span className="small muted">
              Co-owners can do everything the owner can, except change the owner.
            </span>
          </div>
          {manage && !adding && (
            <button type="button" className="small" onClick={() => setAdding(true)}>
              + Add co-owner
            </button>
          )}
        </div>
        {adding && (
          <form onSubmit={add} className="add-dates stack" style={{ gap: 10 }}>
            <div className="field">
              <label htmlFor="t-who">Email or mobile</label>
              <input
                id="t-who"
                required
                autoComplete="off"
                placeholder="name@example.com or 98765 43210"
                value={who}
                onChange={(e) => setWho(e.target.value)}
              />
              <span className="hint">They must have signed in to Ohviana once.</span>
            </div>
            <div className="cluster">
              <button type="submit" disabled={action.pending}>
                Add co-owner
              </button>
              <button type="button" className="link" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        {team.loading && !team.data ? (
          <Loading />
        ) : (
          <ul className="people">
            {owners.map((m) => (
              <li key={m.userId}>
                <Avatar name={m.fullName ?? m.email ?? '?'} />
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <strong>
                    {m.fullName ?? m.email ?? (m.phone && prettyPhone(m.phone)) ?? 'Unnamed'}
                    {m.userId === me.user.id && <span className="muted"> (you)</span>}
                  </strong>
                  <span className="muted small">
                    {[m.email, m.phone && prettyPhone(m.phone)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`badge ${m.role === 'owner' ? 'ok' : ''}`}>
                  {ROLE_LABELS[m.role]}
                </span>
                {m.role === 'co_owner' && (manage || m.userId === me.user.id) ? (
                  <button type="button" className="link small" onClick={() => remove(m)}>
                    {m.userId === me.user.id ? 'Leave' : 'Remove'}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack">
        <div className="stack" style={{ gap: 2 }}>
          <h2 style={{ margin: 0 }}>Trek leads</h2>
          <span className="small muted">
            Name trek leads with their mobile when you add dates. Once they sign in to Ohviana with
            that number, they can see the batches they lead: details and attendee list, nothing
            else.
          </span>
        </div>
        {leads.loading && !leads.data ? (
          <Loading />
        ) : !leads.data?.items.length ? (
          <p className="muted small" style={{ margin: 0 }}>
            No trek leads yet.
          </p>
        ) : (
          <ul className="people">
            {leads.data.items.map((l) => (
              <li key={l.phone}>
                <Avatar name={l.name} />
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <strong>{l.name}</strong>
                  <span className="muted small">
                    {prettyPhone(l.phone)} · leads {l.batchCount}{' '}
                    {l.batchCount === 1 ? 'batch' : 'batches'}
                    {l.nextDepartureAt && ` · next ${dateTime(l.nextDepartureAt)}`}
                  </span>
                </span>
                <span className={`badge ${LEAD_STATUS[l.status].tone}`}>
                  {LEAD_STATUS[l.status].label}
                </span>
                {manage ? (
                  <button
                    type="button"
                    className="link small"
                    disabled={action.pending}
                    onClick={() => setLeadAccess(l, l.status !== 'revoked')}
                  >
                    {l.status === 'revoked' ? 'Restore' : 'Revoke'}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
