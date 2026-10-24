'use client';

import { useState, type FormEvent } from 'react';
import { OrganizerProfile } from '@ohviana/contracts';
import { useAction } from '@/components/dash/hooks';
import { Outcome } from '@/components/dash/ui';
import { authedFetch } from '@/lib/authed';
import { toE164 } from '@/lib/phone';
import { LogoInput, logoChoice, uploadLogo, type LogoChoice } from '@/components/LogoInput';

/** Shown to signed-in users who don't belong to any organizer yet. */
export function RegisterOrganizer({
  onRegistered,
}: {
  onRegistered: (organizerId: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: '',
    city: '',
    tagline: '',
    contactEmail: '',
    contactPhone: '',
    gstin: '',
  });
  const [logo, setLogo] = useState<LogoChoice>(() => logoChoice(null));
  const action = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const phone = toE164(form.contactPhone);
    if (!phone) return action.setError('Enter a valid contact mobile number.');
    const link = logo.mode === 'link' ? logo.link.trim() : '';
    if (link && !/^https:\/\/\S+$/.test(link)) {
      return action.setError('The logo link must start with https://');
    }
    const file = logo.mode === 'upload' ? logo.file : null;
    if (file && file.size > 10 * 1024 * 1024)
      return action.setError('The logo is larger than 10 MB.');
    const created = await action.run(async () => {
      const org = await authedFetch('/v1/organizers', OrganizerProfile, {
        method: 'POST',
        body: {
          name: form.name.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: phone,
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...(form.tagline.trim() ? { tagline: form.tagline.trim() } : {}),
          ...(form.gstin.trim() ? { gstin: form.gstin.trim() } : {}),
          ...(link ? { logoUrl: link } : {}),
        },
      });
      // An uploaded logo needs the organizer to exist first. A failed upload doesn't undo the
      // registration; the logo can be added from Profile.
      if (file) await uploadLogo(org.id, file).catch(() => undefined);
      return org;
    });
    if (created) await onRegistered(created.id);
  }

  return (
    <form onSubmit={submit} className="stack-lg">
      <div className="stack">
        <h1 style={{ margin: 0 }}>List your treks on Ohviana</h1>
        <p className="muted" style={{ margin: 0 }}>
          Register your organization. You can set up treks and draft batches right away; they go
          live once Ohviana approves your account.
        </p>
      </div>
      <fieldset className="stack">
        <legend>Organization</legend>
        <div className="field">
          <label htmlFor="r-name">Organization name</label>
          <input id="r-name" required minLength={2} value={form.name} onChange={set('name')} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="r-city">City</label>
            <input id="r-city" value={form.city} onChange={set('city')} />
          </div>
          <div className="field">
            <label htmlFor="r-gstin">
              GSTIN <span className="hint">(optional)</span>
            </label>
            <input id="r-gstin" value={form.gstin} onChange={set('gstin')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="r-tagline">
            Tagline <span className="hint">(optional)</span>
          </label>
          <input id="r-tagline" maxLength={160} value={form.tagline} onChange={set('tagline')} />
        </div>
        <LogoInput value={logo} current={null} onChange={setLogo} />
      </fieldset>
      <fieldset className="stack">
        <legend>Contact (private — for Ohviana)</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="r-email">Email</label>
            <input
              id="r-email"
              type="email"
              required
              value={form.contactEmail}
              onChange={set('contactEmail')}
            />
          </div>
          <div className="field">
            <label htmlFor="r-phone">Mobile</label>
            <input
              id="r-phone"
              type="tel"
              required
              value={form.contactPhone}
              onChange={set('contactPhone')}
            />
          </div>
        </div>
      </fieldset>
      <Outcome error={action.error} />
      <button type="submit" disabled={action.pending} style={{ alignSelf: 'flex-start' }}>
        {action.pending ? 'Registering…' : 'Register organization'}
      </button>
    </form>
  );
}
