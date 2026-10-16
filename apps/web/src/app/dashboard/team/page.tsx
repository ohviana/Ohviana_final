'use client';

import { useState, type FormEvent } from 'react';
import { MemberList } from '@ohviana/contracts';
import { ORGANIZER_ROLES, type OrganizerRole } from '@ohviana/shared';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Loading, Outcome } from '@/components/dash/ui';

const ROLE_HELP: Record<OrganizerRole, string> = {
  owner: 'Everything, including the team',
  manager: 'Treks, batches, links and bookings',
  staff: 'View batches and attendee lists',
};

export default function TeamPage() {
  const { call, can, me, reloadMe } = useOrg();
  const team = useLoad(() => call('/members', MemberList), [call]);
  const action = useAction();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizerRole>('staff');
  const manage = can('org:manage_members');

  async function add(e: FormEvent) {
    e.preventDefault();
    const result = await action.run(
      () => call('/members', MemberList, { method: 'POST', body: { email: email.trim(), role } }),
      'Added to the team.',
    );
    if (result) {
      team.setData(result);
      setEmail('');
    }
  }

  const change = (userId: string, next: OrganizerRole | 'remove') => {
    const self = userId === me.user.id;
    if (next === 'remove' && !confirm(self ? 'Leave this organization?' : 'Remove this member?'))
      return;
    void action.run(
      async () => {
        const result = await call(
          `/members/${userId}`,
          MemberList,
          next === 'remove' ? { method: 'DELETE' } : { method: 'PATCH', body: { role: next } },
        );
        team.setData(result);
        if (self) await reloadMe();
      },
      next === 'remove' ? 'Member removed.' : 'Role updated.',
    );
  };

  return (
    <>
      <h1 style={{ margin: 0 }}>Team</h1>
      <dl className="kv small">
        {ORGANIZER_ROLES.map((r) => (
          <div key={r} style={{ display: 'contents' }}>
            <dt style={{ textTransform: 'capitalize' }}>{r}</dt>
            <dd>{ROLE_HELP[r]}</dd>
          </div>
        ))}
      </dl>

      {manage && (
        <form onSubmit={add} className="card form-grid">
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="t-email">Email</label>
            <input
              id="t-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="hint">They must have signed in to Ohviana once.</span>
          </div>
          <div className="field">
            <label htmlFor="t-role">Role</label>
            <select
              id="t-role"
              value={role}
              onChange={(e) => setRole(e.target.value as OrganizerRole)}
            >
              {ORGANIZER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={action.pending}>
            Add member
          </button>
        </form>
      )}

      <Outcome error={action.error ?? team.error} message={action.message} />
      {team.loading && !team.data && <Loading />}
      {team.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {team.data.items.map((m) => (
                <tr key={m.userId}>
                  <td>
                    {m.fullName ?? '—'}
                    {m.userId === me.user.id && <span className="muted"> (you)</span>}
                  </td>
                  <td>{m.email ?? '—'}</td>
                  <td>
                    {manage ? (
                      <select
                        aria-label="Role"
                        value={m.role}
                        onChange={(e) => change(m.userId, e.target.value as OrganizerRole)}
                        style={{ minWidth: 120 }}
                      >
                        {ORGANIZER_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ textTransform: 'capitalize' }}>{m.role}</span>
                    )}
                  </td>
                  <td>
                    {manage && (
                      <button
                        type="button"
                        className="small secondary"
                        onClick={() => change(m.userId, 'remove')}
                      >
                        Remove
                      </button>
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
