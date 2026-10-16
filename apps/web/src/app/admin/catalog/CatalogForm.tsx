'use client';

import { useState, type FormEvent } from 'react';
import type { CatalogTrek } from '@ohviana/contracts';
import { CONTENT_STATUSES, DIFFICULTIES } from '@ohviana/shared';
import { useAction } from '@/components/dash/hooks';
import { Outcome } from '@/components/dash/ui';

const EMPTY = {
  name: '',
  slug: '',
  state: 'Karnataka',
  region: 'Western Ghats',
  district: '',
  difficulty: '',
  maxAltitudeM: '',
  summary: '',
  description: '',
  heroImageUrl: '',
  status: 'draft',
};

type Values = typeof EMPTY;

function fromTrek(t: CatalogTrek): Values {
  return {
    name: t.name,
    slug: t.slug,
    state: t.state ?? '',
    region: t.region ?? '',
    district: t.district ?? '',
    difficulty: t.difficulty ?? '',
    maxAltitudeM: t.maxAltitudeM ? String(t.maxAltitudeM) : '',
    summary: t.summary ?? '',
    description: t.description ?? '',
    heroImageUrl: t.heroImageUrl ?? '',
    status: t.status,
  };
}

/** Create (no `trek`) or edit a canonical catalog trek. Sends only changed fields on edit. */
export function CatalogForm({
  trek,
  initialName,
  submitLabel,
  onSubmit,
}: {
  trek?: CatalogTrek;
  initialName?: string;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const initial = trek ? fromTrek(trek) : { ...EMPTY, name: initialName ?? '' };
  const [v, setV] = useState<Values>(initial);
  const action = useAction();
  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const k of Object.keys(v) as (keyof Values)[]) {
      if (trek && v[k] === initial[k]) continue;
      const raw = v[k].trim();
      if (k === 'maxAltitudeM') body[k] = raw ? Number(raw) : null;
      else if (k === 'name' || k === 'status') body[k] = raw;
      else if (k === 'slug') {
        if (raw) body[k] = raw;
      } else body[k] = raw || null;
    }
    if (!trek) {
      for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
    }
    if (Object.keys(body).length === 0) return action.setError('Nothing changed.');
    await action.run(() => onSubmit(body), trek ? 'Saved.' : undefined);
  }

  return (
    <form onSubmit={submit} className="card stack">
      <div className="form-grid">
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="cf-name">Name</label>
          <input id="cf-name" required minLength={2} value={v.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="cf-slug">
            URL slug <span className="hint">(auto if empty)</span>
          </label>
          <input
            id="cf-slug"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={v.slug}
            onChange={set('slug')}
          />
        </div>
        <div className="field">
          <label htmlFor="cf-district">District</label>
          <input id="cf-district" value={v.district} onChange={set('district')} />
        </div>
        <div className="field">
          <label htmlFor="cf-state">State</label>
          <input id="cf-state" value={v.state} onChange={set('state')} />
        </div>
        <div className="field">
          <label htmlFor="cf-region">Region</label>
          <input id="cf-region" value={v.region} onChange={set('region')} />
        </div>
        <div className="field">
          <label htmlFor="cf-diff">Difficulty</label>
          <select id="cf-diff" value={v.difficulty} onChange={set('difficulty')}>
            <option value="">—</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cf-alt">Highest point (m)</label>
          <input
            id="cf-alt"
            type="number"
            min={1}
            max={9000}
            value={v.maxAltitudeM}
            onChange={set('maxAltitudeM')}
          />
        </div>
        <div className="field">
          <label htmlFor="cf-status">Status</label>
          <select id="cf-status" value={v.status} onChange={set('status')}>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="cf-summary">
          Summary <span className="hint">(search results & SEO description)</span>
        </label>
        <input id="cf-summary" maxLength={300} value={v.summary} onChange={set('summary')} />
      </div>
      <div className="field">
        <label htmlFor="cf-desc">Description</label>
        <textarea id="cf-desc" value={v.description} onChange={set('description')} />
      </div>
      <div className="field">
        <label htmlFor="cf-hero">Hero image URL (https)</label>
        <input id="cf-hero" type="url" value={v.heroImageUrl} onChange={set('heroImageUrl')} />
      </div>
      <Outcome error={action.error} message={action.message} />
      <button type="submit" disabled={action.pending} style={{ alignSelf: 'flex-start' }}>
        {submitLabel}
      </button>
    </form>
  );
}
