'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { OrganizerTrek } from '@ohviana/contracts';
import { PHOTO_CATEGORIES, type PhotoCategory } from '@ohviana/shared';
import { useAction } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Outcome } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { istLocalToIso, linesToList, rupeesToPaise } from '@/lib/datetime';
import { PHOTO_CATEGORY_LABELS } from '@/lib/media';
import { DestinationInput } from '../DestinationInput';
import { MAX_BYTES, MAX_PHOTOS, uploadTrekPhoto } from '../PhotoManager';

interface PickupRow {
  key: number;
  name: string;
  landmark: string;
  time: string;
}

interface PhotoRow {
  key: number;
  file: File;
  preview: string;
  category: PhotoCategory;
}

let nextKey = 1;
const pickupRow = (): PickupRow => ({ key: nextKey++, name: '', landmark: '', time: '' });

/**
 * Everything about a new trek in one form: details, photos, pickup points and its first batch.
 * One request creates it all (nothing is saved if anything is wrong); photos upload right after.
 */
export default function NewTrekPage() {
  const { call, can, org } = useOrg();
  const router = useRouter();
  const action = useAction();
  const [destination, setDestination] = useState('');
  const [f, setF] = useState({
    title: '',
    summary: '',
    durationDays: '',
    itinerary: '',
    inclusions: '',
    exclusions: '',
    thingsToCarry: '',
    cancellationPolicy: '',
  });
  const [pickups, setPickups] = useState<PickupRow[]>([pickupRow()]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [withBatch, setWithBatch] = useState(true);
  const [b, setB] = useState({
    departure: '',
    returnAt: '',
    cutoffHours: '12',
    price: '',
    capacity: '20',
    maxPerBooking: '10',
  });
  const [progress, setProgress] = useState<string | null>(null);
  const canPublish = can('batches:publish');

  // Release preview URLs when photos are removed or the page closes.
  const previews = useMemo(() => photos.map((p) => p.preview), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const setBatch = (k: keyof typeof b) => (e: { target: { value: string } }) =>
    setB({ ...b, [k]: e.target.value });
  const setPickup = (key: number, k: 'name' | 'landmark' | 'time', v: string) =>
    setPickups(pickups.map((p) => (p.key === key ? { ...p, [k]: v } : p)));

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = [...list].filter((file) => file.type.startsWith('image/')).slice(0, room);
    const tooBig = picked.filter((file) => file.size > MAX_BYTES);
    if (tooBig.length) action.setError(`${tooBig.map((x) => x.name).join(', ')}: over 10 MB`);
    setPhotos([
      ...photos,
      ...picked
        .filter((file) => file.size <= MAX_BYTES)
        .map((file) => ({
          key: nextKey++,
          file,
          preview: URL.createObjectURL(file),
          category: 'destination' as PhotoCategory,
        })),
    ]);
  }

  async function save(publish: boolean, e?: FormEvent) {
    e?.preventDefault();
    if (f.title.trim().length < 2) return action.setError('Enter the trek name.');
    if (!destination.trim()) return action.setError('Enter the destination, e.g. Kudremukh.');

    const usedPickups = pickups.filter((p) => p.name.trim());
    let firstBatch: Record<string, unknown> | undefined;
    if (withBatch) {
      const departureAt = istLocalToIso(b.departure);
      const returnAt = istLocalToIso(b.returnAt);
      if (!departureAt || !returnAt)
        return action.setError('Enter the batch departure and return.');
      const pricePaise = rupeesToPaise(b.price);
      if (pricePaise === null) return action.setError('Enter the price in rupees, e.g. 2499');
      const cutoffMs = Math.max(0, Number(b.cutoffHours) || 0) * 3_600_000;
      firstBatch = {
        departureAt,
        returnAt,
        bookingCutoffAt: new Date(Date.parse(departureAt) - cutoffMs).toISOString(),
        pricePaise,
        capacity: Number(b.capacity),
        maxSeatsPerBooking: Number(b.maxPerBooking),
      };
    } else if (publish) {
      return action.setError('Add the first batch to publish, or save as draft.');
    }
    const badTime = usedPickups.find((p) => p.time && !istLocalToIso(p.time));
    if (badTime) return action.setError(`Check the pickup time for ${badTime.name}.`);

    const created = await action.run(async () => {
      const trek = await call('/treks', OrganizerTrek, {
        method: 'POST',
        body: {
          title: f.title.trim(),
          catalogTrekName: destination.trim(),
          summary: f.summary.trim() || null,
          durationDays: f.durationDays ? Number(f.durationDays) : null,
          itinerary: linesToList(f.itinerary).map((title, i) => ({ day: i + 1, title })),
          inclusions: linesToList(f.inclusions),
          exclusions: linesToList(f.exclusions),
          thingsToCarry: linesToList(f.thingsToCarry),
          cancellationPolicy: f.cancellationPolicy.trim() || null,
          pickupPoints: usedPickups.map((p) => ({
            name: p.name.trim(),
            ...(p.landmark.trim() ? { landmark: p.landmark.trim() } : {}),
            ...(withBatch && p.time ? { pickupAt: istLocalToIso(p.time)! } : {}),
          })),
          ...(firstBatch ? { firstBatch } : {}),
          publish,
        },
      });
      // The trek exists now; a failed photo shouldn't lose it, so collect problems instead.
      const failed: string[] = [];
      for (const [i, p] of photos.entries()) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        try {
          await uploadTrekPhoto(trek.id, org.organizerId, p.file, p.category);
        } catch {
          failed.push(p.file.name);
        }
      }
      setProgress(null);
      return { trek, failed };
    });
    if (!created) return;
    const params = new URLSearchParams({ created: publish ? 'published' : 'draft' });
    if (created.failed.length) params.set('photosFailed', String(created.failed.length));
    router.push(`/dashboard/treks/${created.trek.id}?${params}`);
  }

  if (!can('treks:write')) {
    return <Outcome error="Your role can't create treks." />;
  }

  const area = (k: keyof typeof f, label: string, hint?: string, placeholder?: string) => (
    <div className="field">
      <label htmlFor={`nt-${k}`}>
        {label} {hint && <span className="hint">{hint}</span>}
      </label>
      <textarea id={`nt-${k}`} value={f[k]} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <form onSubmit={(e) => save(false, e)} className="stack" style={{ gap: 20 }}>
      <div className="stack">
        <span className="small">
          <Link href="/dashboard/treks">← Treks</Link>
        </span>
        <span className="eyebrow">New trek</span>
        <h1 style={{ margin: 0 }}>Add a trek</h1>
        <p className="muted" style={{ margin: 0 }}>
          Fill everything in one go. Only the name, destination and first batch dates are needed —
          you can add the rest later.
        </p>
      </div>

      <section className="card stack">
        <h2 className="form-step">
          <span className="step-num">1</span> The trek
        </h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="nt-title">Trek name</label>
            <input
              id="nt-title"
              required
              minLength={2}
              placeholder="Kudremukh Weekend Trek"
              value={f.title}
              onChange={set('title')}
            />
          </div>
          <DestinationInput value={destination} onChange={setDestination} />
          <div className="field">
            <label htmlFor="nt-days">Duration (days)</label>
            <input
              id="nt-days"
              type="number"
              min={1}
              max={60}
              placeholder="2"
              value={f.durationDays}
              onChange={set('durationDays')}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="nt-summary">Short description</label>
          <input
            id="nt-summary"
            maxLength={500}
            placeholder="Sunrise summit, shola forests and a night under the stars"
            value={f.summary}
            onChange={set('summary')}
          />
        </div>
      </section>

      <section className="card stack">
        <div className="spread">
          <h2 className="form-step">
            <span className="step-num">2</span> Photos <span className="hint">(optional)</span>
          </h2>
          <span className="small muted">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        <label className="dropzone" htmlFor="nt-photos" style={{ cursor: 'pointer' }}>
          <span className="icon-circle">
            <Icon name="download" size={22} style={{ transform: 'rotate(180deg)' }} />
          </span>
          <strong>Choose photos</strong>
          <span className="small muted">
            Destination views, the trail, your bus, stays, food, groups. JPEG / PNG / WebP up to 10
            MB each.
          </span>
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
        {photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((p) => (
              <div key={p.key} className="photo-tile">
                <img src={p.preview} alt={p.file.name} />
                <div className="tile-body">
                  <select
                    aria-label={`What ${p.file.name} shows`}
                    value={p.category}
                    onChange={(e) =>
                      setPhotos(
                        photos.map((x) =>
                          x.key === p.key ? { ...x, category: e.target.value as PhotoCategory } : x,
                        ),
                      )
                    }
                  >
                    {PHOTO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {PHOTO_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="small danger"
                    onClick={() => setPhotos(photos.filter((x) => x.key !== p.key))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2 className="form-step">
          <span className="step-num">3</span> Itinerary &amp; inclusions{' '}
          <span className="hint">(optional)</span>
        </h2>
        {area(
          'itinerary',
          'Itinerary',
          '(one line per day)',
          'Day 1: Drive to base, trek to camp\nDay 2: Summit at sunrise, descend',
        )}
        <div className="form-grid">
          {area('inclusions', 'Included', '(one per line)', 'Transport\nBreakfast\nGuide')}
          {area('exclusions', 'Not included', '(one per line)', 'Personal expenses')}
          {area('thingsToCarry', 'Things to carry', '(one per line)', 'Water bottle\nRain jacket')}
        </div>
        {area('cancellationPolicy', 'Cancellation policy', '(shown to customers)')}
      </section>

      <section className="card stack">
        <h2 className="form-step">
          <span className="step-num">4</span> Pickup points <span className="hint">(optional)</span>
        </h2>
        {pickups.map((p, i) => (
          <div key={p.key} className="pickup-row">
            <div className="field">
              <label htmlFor={`pk-name-${p.key}`}>Pickup {i + 1}</label>
              <input
                id={`pk-name-${p.key}`}
                placeholder="Majestic Bus Stand"
                value={p.name}
                onChange={(e) => setPickup(p.key, 'name', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`pk-lm-${p.key}`}>Landmark</label>
              <input
                id={`pk-lm-${p.key}`}
                placeholder="Platform 1 entrance"
                value={p.landmark}
                onChange={(e) => setPickup(p.key, 'landmark', e.target.value)}
              />
            </div>
            {withBatch && (
              <div className="field">
                <label htmlFor={`pk-time-${p.key}`}>Pickup time (IST)</label>
                <input
                  id={`pk-time-${p.key}`}
                  type="datetime-local"
                  value={p.time}
                  onChange={(e) => setPickup(p.key, 'time', e.target.value)}
                />
              </div>
            )}
            {pickups.length > 1 && (
              <button
                type="button"
                className="small secondary"
                aria-label={`Remove pickup ${i + 1}`}
                onClick={() => setPickups(pickups.filter((x) => x.key !== p.key))}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {pickups.length < 20 && (
          <button
            type="button"
            className="small secondary"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setPickups([...pickups, pickupRow()])}
          >
            + Add another pickup
          </button>
        )}
      </section>

      <section className="card stack">
        <div className="spread">
          <h2 className="form-step">
            <span className="step-num">5</span> First batch
          </h2>
          <label className="cluster small" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={withBatch}
              onChange={(e) => setWithBatch(e.target.checked)}
              style={{ width: 'auto', minHeight: 0 }}
            />
            Add dates now
          </label>
        </div>
        {withBatch ? (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              We name it for you, e.g. <code>RCB_Kudremukh_25th_Sept_Batch_1</code>. Later, open the
              batch and use <strong>Run this batch again</strong> for new dates.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="nb-dep">Departure (IST)</label>
                <input
                  id="nb-dep"
                  type="datetime-local"
                  required
                  value={b.departure}
                  onChange={setBatch('departure')}
                />
              </div>
              <div className="field">
                <label htmlFor="nb-ret">Return (IST)</label>
                <input
                  id="nb-ret"
                  type="datetime-local"
                  required
                  value={b.returnAt}
                  onChange={setBatch('returnAt')}
                />
              </div>
              <div className="field">
                <label htmlFor="nb-price">Price per person (₹)</label>
                <input
                  id="nb-price"
                  required
                  inputMode="decimal"
                  placeholder="2499"
                  value={b.price}
                  onChange={setBatch('price')}
                />
              </div>
              <div className="field">
                <label htmlFor="nb-cap">Seats</label>
                <input
                  id="nb-cap"
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={b.capacity}
                  onChange={setBatch('capacity')}
                />
              </div>
              <div className="field">
                <label htmlFor="nb-cut">Close bookings (hours before)</label>
                <input
                  id="nb-cut"
                  type="number"
                  min={0}
                  max={720}
                  value={b.cutoffHours}
                  onChange={setBatch('cutoffHours')}
                />
              </div>
              <div className="field">
                <label htmlFor="nb-max">Max seats per booking</label>
                <input
                  id="nb-max"
                  type="number"
                  min={1}
                  max={50}
                  value={b.maxPerBooking}
                  onChange={setBatch('maxPerBooking')}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            You can add batches from the trek page later.
          </p>
        )}
      </section>

      <div className="card stack sticky-actions">
        <Outcome error={action.error} />
        {progress && <span className="small muted">{progress}</span>}
        {!canPublish && org.status === 'pending' && (
          <span className="small muted">
            Your organization is awaiting approval: save as draft now and publish once approved.
          </span>
        )}
        <div className="cluster">
          <button type="submit" className="secondary" disabled={action.pending}>
            Save as draft
          </button>
          {canPublish && (
            <button type="button" disabled={action.pending} onClick={() => void save(true)}>
              Publish <Icon name="arrowRight" size={16} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
