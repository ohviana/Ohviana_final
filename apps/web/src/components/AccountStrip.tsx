'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { MeResponse } from '@ohviana/contracts';
import { ApiError } from '@/lib/api';
import { authedFetch } from '@/lib/authed';
import { prettyPhone } from '@/lib/phone';
import { signOut } from '@/lib/session';

/**
 * Who is signed in, at the top of My bookings: name (editable), mobile, sign out, and the
 * consoles for organizers and admins. Customers have no separate account page.
 */
export function AccountStrip() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authedFetch('/v1/me', MeResponse)
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!name?.trim()) return;
    setSaving(true);
    try {
      setMe(
        await authedFetch('/v1/me', MeResponse, {
          method: 'PATCH',
          body: { fullName: name.trim() },
        }),
      );
      setName(null);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!me) return null;
  const { user } = me;

  if (name !== null) {
    return (
      <form onSubmit={saveName} className="cluster" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="account-name">Your name</label>
          <input
            id="account-name"
            autoComplete="name"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="secondary" onClick={() => setName(null)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="cluster small" style={{ rowGap: 8 }}>
      <span>
        <strong>{user.fullName ?? 'Add your name'}</strong>{' '}
        <button type="button" className="link" onClick={() => setName(user.fullName ?? '')}>
          {user.fullName ? 'Edit' : 'Add'}
        </button>
      </span>
      {(user.phone ?? user.email) && (
        <span className="muted">{user.phone ? prettyPhone(user.phone) : user.email}</span>
      )}
      {me.memberships.length > 0 && <Link href="/dashboard">Organizer dashboard</Link>}
      {me.isAdmin && <Link href="/admin">Admin console</Link>}
      <button type="button" className="link" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
