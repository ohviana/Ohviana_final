'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { OrganizerTrek } from '@ohviana/contracts';
import { useAction } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Outcome } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { linesToList } from '@/lib/datetime';
import { DestinationInput } from '../DestinationInput';
import { MAX_BYTES, MAX_PHOTOS, uploadTrekPhoto } from '../PhotoManager';
import {
  DIFFICULTY_CHOICES,
  ItineraryEditor,
  MAX_DURATION_DAYS,
  StartPointInput,
  itineraryBody,
  type ItineraryDrafts,
} from '../TrekFields';

interface PhotoRow {
  key: number;
  file: File;
  preview: string;
}

let nextKey = 1;

/**
 * Add a trek: what it is, day by day, what's included and photos. Dates (batches) and pickup
 * points are added on the trek page afterwards. Photos upload right after the trek is created.
 */
export default function NewTrekPage() {
  const { call, can, org } = useOrg();
  const router = useRouter();
  const action = useAction();
  const [name, setName] = useState('');
  const [f, setF] = useState({
    durationDays: '',
    difficulty: '',
    altitude: '',
    summary: '',
    inclusions: '',
    exclusions: '',
    thingsToCarry: '',
    cancellationPolicy: '',
  });
  const [startPoint, setStartPoint] = useState('');
  const [days, setDays] = useState<ItineraryDrafts>({});
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  // Pending organizers can prepare treks; trekkers see them once Ohviana approves the organizer.
  const approved = org.status === 'approved';

  // Release preview URLs when photos are removed or the page closes.
  const previews = useMemo(() => photos.map((p) => p.preview), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const durationDays = f.durationDays ? Number(f.durationDays) : null;

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const picked = [...list]
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, MAX_PHOTOS - photos.length);
    const tooBig = picked.filter((file) => file.size > MAX_BYTES);
    if (tooBig.length) action.setError(`${tooBig.map((x) => x.name).join(', ')}: over 10 MB`);
    setPhotos([
      ...photos,
      ...picked
        .filter((file) => file.size <= MAX_BYTES)
        .map((file) => ({ key: nextKey++, file, preview: URL.createObjectURL(file) })),
    ]);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const trekName = name.trim().replace(/\s+/g, ' ');
    if (trekName.length < 2) return action.setError('Enter the trek name, e.g. Kodachadri.');
    const altitude = f.altitude.trim() ? Number(f.altitude) : null;
    if (altitude !== null && !(Number.isInteger(altitude) && altitude > 0 && altitude <= 9000)) {
      return action.setError('Enter the altitude in metres, e.g. 1343.');
    }

    const created = await action.run(async () => {
      const trek = await call('/treks', OrganizerTrek, {
        method: 'POST',
        body: {
          title: trekName,
          catalogTrekName: trekName,
          durationDays,
          difficulty: f.difficulty || null,
          maxAltitudeM: altitude,
          startPoint: startPoint.trim() || null,
          summary: f.summary.trim() || null,
          itinerary: itineraryBody(days, durationDays),
          inclusions: linesToList(f.inclusions),
          exclusions: linesToList(f.exclusions),
          thingsToCarry: linesToList(f.thingsToCarry),
          cancellationPolicy: f.cancellationPolicy.trim() || null,
        },
      });
      // The trek exists now; a failed photo shouldn't lose it, so collect problems instead.
      const failed: string[] = [];
      for (const [i, p] of photos.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        try {
          await uploadTrekPhoto(trek.id, org.organizerId, p.file, 'destination');
        } catch {
          failed.push(p.file.name);
        }
      }
      setProgress(null);
      return { trek, failed };
    });
    if (!created) return;
    const params = new URLSearchParams({ created: '1' });
    if (created.failed.length) params.set('photosFailed', String(created.failed.length));
    router.push(`/dashboard/treks/${created.trek.id}?${params}`);
  }

  if (!can('treks:write')) {
    return <Outcome error="Your role can't create treks." />;
  }

  const list = (k: 'inclusions' | 'exclusions', label: string, placeholder: string) => (
    <div className="field">
      <label htmlFor={`nt-${k}`}>
        {label} <span className="hint">(one per line)</span>
      </label>
      <textarea id={`nt-${k}`} rows={5} value={f[k]} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <form onSubmit={save} className="stack trek-form" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small">
          <Link href="/dashboard/treks">← Treks</Link>
        </span>
        <h1 style={{ margin: 0 }}>Add a trek</h1>
        <p className="muted" style={{ margin: 0 }}>
          Only the name is required. You&apos;ll add dates and pickup points on the next screen.
        </p>
      </div>

      <section className="card stack">
        <DestinationInput
          big
          label="Trek name"
          placeholder="e.g. Kodachadri, Kudremukh"
          value={name}
          onChange={setName}
        />
        <div className="form-grid">
          <div className="field">
            <label htmlFor="nt-days">Duration</label>
            <select id="nt-days" value={f.durationDays} onChange={set('durationDays')}>
              <option value="">Select</option>
              {Array.from({ length: MAX_DURATION_DAYS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-difficulty">Difficulty</label>
            <select id="nt-difficulty" value={f.difficulty} onChange={set('difficulty')}>
              <option value="">Select</option>
              {DIFFICULTY_CHOICES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nt-alt">
              Altitude <span className="hint">(metres)</span>
            </label>
            <input
              id="nt-alt"
              inputMode="numeric"
              placeholder="e.g. 1343"
              value={f.altitude}
              onChange={(e) => setF({ ...f, altitude: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <StartPointInput value={startPoint} onChange={setStartPoint} />
        </div>
      </section>

      <section className="card stack">
        <h2 className="form-section">Overview</h2>
        <div className="field">
          <label htmlFor="nt-summary" className="sr-only">
            Overview
          </label>
          <textarea
            id="nt-summary"
            rows={3}
            maxLength={500}
            placeholder="A short, high-level description: what makes this trek special, the terrain and the views."
            value={f.summary}
            onChange={set('summary')}
          />
          <span className="hint" style={{ textAlign: 'right' }}>
            {f.summary.length}/500
          </span>
        </div>
      </section>

      <section className="card stack">
        <h2 className="form-section">Itinerary</h2>
        <ItineraryEditor durationDays={durationDays} drafts={days} onChange={setDays} />
      </section>

      <section className="card stack">
        <h2 className="form-section">What&apos;s included</h2>
        <div className="two-up">
          {list('inclusions', 'Included', 'Transport\nBreakfast and lunch\nTrek guide')}
          {list('exclusions', 'Not included', 'Personal expenses\nAnything not listed')}
        </div>
      </section>

      <section className="card stack">
        <h2 className="form-section">Things to carry</h2>
        <div className="field">
          <label htmlFor="nt-carry" className="sr-only">
            Things to carry
          </label>
          <textarea
            id="nt-carry"
            rows={4}
            value={f.thingsToCarry}
            onChange={set('thingsToCarry')}
            placeholder={'2 litres of water\nRain jacket\nTrekking shoes'}
          />
          <span className="hint">One per line.</span>
        </div>
      </section>

      <section className="card stack">
        <h2 className="form-section">Cancellation policy</h2>
        <div className="field">
          <label htmlFor="nt-policy" className="sr-only">
            Cancellation policy
          </label>
          <textarea
            id="nt-policy"
            rows={4}
            maxLength={5000}
            value={f.cancellationPolicy}
            onChange={set('cancellationPolicy')}
            placeholder="e.g. Full refund up to 7 days before departure, 50% up to 3 days before, no refund after that."
          />
          <span className="hint">Shown to trekkers and saved with every booking.</span>
        </div>
      </section>

      <section className="card stack">
        <div className="spread">
          <h2 className="form-section">Photos</h2>
          <span className="small muted">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        <div className="photo-slots">
          {photos.map((p, i) => (
            <figure key={p.key} className="photo-slot">
              <img src={p.preview} alt={p.file.name} />
              {i === 0 && <span className="badge glass">Cover</span>}
              <button
                type="button"
                className="photo-remove"
                aria-label={`Remove ${p.file.name}`}
                onClick={() => setPhotos(photos.filter((x) => x.key !== p.key))}
              >
                <Icon name="x" size={16} />
              </button>
            </figure>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="photo-slot empty" htmlFor="nt-photos">
              <Icon name="download" size={22} style={{ transform: 'rotate(180deg)' }} />
              <span>Add photo</span>
              <input
                id="nt-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
        <span className="hint">
          Up to {MAX_PHOTOS} photos (JPEG, PNG or WebP, 10 MB each). The first is the cover.
        </span>
      </section>

      <div className="card stack sticky-actions">
        <Outcome error={action.error} />
        {progress && <span className="small muted">{progress}</span>}
        {!approved && (
          <span className="small muted">
            Your organization is awaiting approval. Your trek is saved; trekkers can book it once
            you&apos;re approved.
          </span>
        )}
        <div className="cluster">
          <button type="submit" disabled={action.pending}>
            Save trek <Icon name="arrowRight" size={16} />
          </button>
          <Link href="/dashboard/treks" className="btn secondary">
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
