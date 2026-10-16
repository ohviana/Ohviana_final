'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { OrganizerProfile } from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Loading, Outcome } from '@/components/dash/ui';
import { bpsToPercent } from '@/lib/datetime';
import { toE164 } from '@/lib/phone';

const FIELDS = [
  'name',
  'tagline',
  'description',
  'city',
  'logoUrl',
  'contactEmail',
  'contactPhone',
  'gstin',
] as const;
type Field = (typeof FIELDS)[number];

export default function ProfilePage() {
  const { call, can, reloadMe } = useOrg();
  const profile = useLoad(() => call('/profile', OrganizerProfile), [call]);
  if (profile.loading && !profile.data) return <Loading />;
  if (!profile.data) return <Outcome error={profile.error} />;
  return (
    <ProfileForm
      profile={profile.data}
      editable={can('org:edit_profile')}
      onSaved={async (p) => {
        profile.setData(p);
        await reloadMe();
      }}
      save={(body) => call('/profile', OrganizerProfile, { method: 'PATCH', body })}
    />
  );
}

function ProfileForm({
  profile,
  editable,
  onSaved,
  save,
}: {
  profile: OrganizerProfile;
  editable: boolean;
  onSaved: (p: OrganizerProfile) => Promise<void>;
  save: (body: Record<string, unknown>) => Promise<OrganizerProfile>;
}) {
  const initial = Object.fromEntries(FIELDS.map((k) => [k, profile[k] ?? ''])) as Record<
    Field,
    string
  >;
  const [f, setF] = useState(initial);
  const action = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const k of FIELDS) {
      if (f[k] === initial[k]) continue;
      const v = f[k].trim();
      if (k === 'contactPhone') {
        const phone = toE164(v);
        if (!phone) return action.setError('Enter a valid contact mobile number.');
        body[k] = phone;
      } else {
        body[k] = v || (k === 'name' || k === 'contactEmail' ? v : null);
      }
    }
    if (Object.keys(body).length === 0) return action.setError('Nothing changed.');
    const updated = await action.run(() => save(body), 'Profile saved.');
    if (updated) await onSaved(updated);
  }

  const input = (k: Field, props: Record<string, unknown> = {}) => (
    <input
      id={`p-${k}`}
      disabled={!editable}
      value={f[k]}
      onChange={(e) => setF({ ...f, [k]: e.target.value })}
      {...props}
    />
  );

  return (
    <form onSubmit={submit} className="stack-lg">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Profile</h1>
        {profile.status === 'approved' && (
          <Link href={`/organizers/${profile.slug}`}>View public page</Link>
        )}
      </div>
      <fieldset className="stack">
        <legend>Public</legend>
        <div className="field">
          <label htmlFor="p-name">Name</label>
          {input('name', { required: true })}
        </div>
        <div className="field">
          <label htmlFor="p-tagline">Tagline</label>
          {input('tagline', { maxLength: 160 })}
        </div>
        <div className="field">
          <label htmlFor="p-description">About</label>
          <textarea
            id="p-description"
            disabled={!editable}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="p-city">City</label>
            {input('city')}
          </div>
          <div className="field">
            <label htmlFor="p-logoUrl">Logo URL (https)</label>
            {input('logoUrl', { type: 'url' })}
          </div>
        </div>
      </fieldset>
      <fieldset className="stack">
        <legend>Private (shared with Ohviana only)</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="p-contactEmail">Contact email</label>
            {input('contactEmail', { type: 'email', required: true })}
          </div>
          <div className="field">
            <label htmlFor="p-contactPhone">Contact mobile</label>
            {input('contactPhone', { type: 'tel' })}
          </div>
          <div className="field">
            <label htmlFor="p-gstin">GSTIN</label>
            {input('gstin')}
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Marketplace commission: <strong>{bpsToPercent(profile.commissionRateBps)}%</strong>{' '}
          (agreed with Ohviana). Direct-link bookings: 0%.
        </p>
      </fieldset>
      <Outcome error={action.error} message={action.message} />
      {editable && (
        <button type="submit" disabled={action.pending} style={{ alignSelf: 'flex-start' }}>
          Save profile
        </button>
      )}
    </form>
  );
}
