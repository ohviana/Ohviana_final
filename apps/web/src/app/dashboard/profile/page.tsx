'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { OrganizerProfile } from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Avatar, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { bpsToPercent } from '@/lib/datetime';
import { price } from '@/lib/format';
import { logoSrc } from '@/lib/media';
import { prettyPhone, toE164 } from '@/lib/phone';
import { LogoInput, logoChoice, uploadLogo, type LogoChoice } from '@/components/LogoInput';

const FIELDS = [
  'name',
  'tagline',
  'description',
  'city',
  'contactEmail',
  'contactPhone',
  'gstin',
] as const;
type Field = (typeof FIELDS)[number];

/** Read-only by default; "Edit profile" opens the form, and saving returns to the view. */
export default function ProfilePage() {
  const { call, can, reloadMe, org } = useOrg();
  const profile = useLoad(() => call('/profile', OrganizerProfile), [call]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  if (profile.loading && !profile.data) return <Loading />;
  if (!profile.data) return <Outcome error={profile.error} />;
  const p = profile.data;
  const editable = can('org:edit_profile');

  return (
    <>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Profile</h1>
        <span className="cluster">
          {p.status === 'approved' && (
            <Link href={`/organizers/${p.slug}`} className="small">
              View public page
            </Link>
          )}
          {editable && !editing && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <Icon name="pencil" size={16} /> Edit profile
            </button>
          )}
        </span>
      </div>
      {saved && !editing && <Outcome error={null} message="Profile saved." />}
      {editing ? (
        <ProfileForm
          profile={p}
          editable
          onSaved={async (next) => {
            profile.setData(next);
            setEditing(false);
            setSaved(true);
            await reloadMe();
          }}
          onCancel={() => setEditing(false)}
          save={(body) => call('/profile', OrganizerProfile, { method: 'PATCH', body })}
          upload={(file) => uploadLogo(org.organizerId, file)}
        />
      ) : (
        <ProfileView profile={p} />
      )}
    </>
  );
}

function ProfileView({ profile: p }: { profile: OrganizerProfile }) {
  const rate = bpsToPercent(p.commissionRateBps);
  const example = 200_000; // ₹2,000 in paise
  const missing = <span className="muted">Not added</span>;
  return (
    <>
      <section className="card stack">
        <div className="profile-head">
          {p.logoUrl ? (
            <img src={logoSrc(p.logoUrl)} alt="" className="profile-logo" />
          ) : (
            <Avatar name={p.name} />
          )}
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{p.name}</h2>
            <span className="muted">
              {[p.tagline, p.city].filter(Boolean).join(' · ') || 'Add a tagline and city'}
            </span>
          </div>
          <StatusBadge status={p.status} />
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <strong className="small">About</strong>
          <p style={{ margin: 0, whiteSpace: 'pre-line' }} className={p.description ? '' : 'muted'}>
            {p.description ??
              'Tell trekkers who you are, how long you’ve run treks and what makes your trips special.'}
          </p>
        </div>
        <span className="small muted">Shown on your public page and next to your departures.</span>
      </section>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Commission</h2>
        <div className="fee-tiles">
          <div className="fee-tile">
            <span className="small muted">Ohviana marketplace</span>
            <strong>{rate}%</strong>
            <span className="small muted">
              per booking from trekkers who find you on Ohviana. On a {price(example)} booking you
              pay {price(Math.round((example * p.commissionRateBps) / 10_000))}.
            </span>
          </div>
          <div className="fee-tile free">
            <span className="small">Direct links &amp; added by you</span>
            <strong>0%</strong>
            <span className="small">
              Bookings through your own booking links, and people you add by phone or WhatsApp.
            </span>
          </div>
        </div>
        <span className="small muted">
          Your marketplace rate is agreed with Ohviana. Contact us to discuss it.
        </span>
      </section>

      <section className="card stack">
        <div className="stack" style={{ gap: 2 }}>
          <h2 style={{ margin: 0 }}>Private details</h2>
          <span className="small muted">Shared with Ohviana only, never shown to trekkers.</span>
        </div>
        <dl className="kv">
          <dt>Contact email</dt>
          <dd>{p.contactEmail ?? missing}</dd>
          <dt>Contact mobile</dt>
          <dd>{p.contactPhone ? prettyPhone(p.contactPhone) : missing}</dd>
          <dt>GSTIN</dt>
          <dd>{p.gstin ?? missing}</dd>
        </dl>
      </section>
    </>
  );
}

function ProfileForm({
  profile,
  editable,
  onSaved,
  onCancel,
  save,
  upload,
}: {
  profile: OrganizerProfile;
  editable: boolean;
  onSaved: (p: OrganizerProfile) => Promise<void>;
  onCancel: () => void;
  save: (body: Record<string, unknown>) => Promise<OrganizerProfile>;
  upload: (file: File) => Promise<OrganizerProfile>;
}) {
  const [logo, setLogo] = useState<LogoChoice>(() => logoChoice(profile.logoUrl));
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
    if (logo.mode === 'link') {
      const link = logo.link.trim();
      if (link && !/^https:\/\/\S+$/.test(link)) {
        return action.setError('The logo link must start with https://');
      }
      if (link !== (profile.logoUrl?.startsWith('/') ? '' : (profile.logoUrl ?? ''))) {
        body.logoUrl = link || null;
      }
    }
    const file = logo.mode === 'upload' ? logo.file : null;
    if (file && file.size > 10 * 1024 * 1024)
      return action.setError('The logo is larger than 10 MB.');
    if (Object.keys(body).length === 0 && !file) return onCancel();
    const updated = await action.run(async () => {
      let next = Object.keys(body).length ? await save(body) : profile;
      if (file) next = await upload(file);
      return next;
    });
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
        <div className="field">
          <label htmlFor="p-city">City</label>
          {input('city')}
        </div>
        <LogoInput value={logo} current={profile.logoUrl} onChange={setLogo} />
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
      </fieldset>
      <Outcome error={action.error} message={action.message} />
      <div className="cluster">
        <button type="submit" disabled={action.pending}>
          Save profile
        </button>
        <button type="button" className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
