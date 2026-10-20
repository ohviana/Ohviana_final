'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { OrganizerBatchArray, OrganizerTrek } from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { istLocalToIso, linesToList, rupeesToPaise } from '@/lib/datetime';
import { DestinationInput } from '../DestinationInput';
import { PhotoManager } from '../PhotoManager';

export default function TrekDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TrekDetail />
    </Suspense>
  );
}

function TrekDetail() {
  const { id } = useParams<{ id: string }>();
  const { call, can } = useOrg();
  const trek = useLoad(() => call(`/treks/${id}`, OrganizerTrek), [call, id]);
  const params = useSearchParams();
  const created = params.get('created');
  const photosFailed = Number(params.get('photosFailed') ?? 0);

  if (trek.loading && !trek.data) return <Loading />;
  if (!trek.data) return <Outcome error={trek.error} />;
  const t = trek.data;
  const writable = can('treks:write') && t.status !== 'archived';

  return (
    <>
      <div className="stack">
        <span className="small">
          <Link href="/dashboard/treks">← Treks</Link>
        </span>
        <div className="spread">
          <h1 style={{ margin: 0 }}>{t.title}</h1>
          <StatusBadge status={t.status} />
        </div>
      </div>
      {created && (
        <p className="notice ok small" style={{ margin: 0 }}>
          {created === 'published'
            ? 'Trek created and its first batch is live — customers can book it now.'
            : 'Trek saved as draft. Publish its batch from Batches when you are ready.'}{' '}
          <Link href={`/dashboard/batches?trekId=${t.id}`}>View batches →</Link>
        </p>
      )}
      {photosFailed > 0 && (
        <p className="notice warn small" style={{ margin: 0 }}>
          {photosFailed} photo(s) could not be uploaded. Add them again under Photos.
        </p>
      )}
      <TrekForm trek={t} writable={writable} onSaved={(x) => trek.setData(x)} />
      <PhotoManager trek={t} writable={writable} onChange={(x) => trek.setData(x)} />
      <Pickups trek={t} writable={writable} onChange={(x) => trek.setData(x)} />
      {can('batches:write') && t.status !== 'archived' && <AddBatches trek={t} />}
    </>
  );
}

function TrekForm({
  trek,
  writable,
  onSaved,
}: {
  trek: OrganizerTrek;
  writable: boolean;
  onSaved: (t: OrganizerTrek) => void;
}) {
  const { call } = useOrg();
  const action = useAction();
  const [destination, setDestination] = useState(trek.catalogTrekName ?? '');
  const [f, setF] = useState({
    title: trek.title,
    summary: trek.summary ?? '',
    durationDays: trek.durationDays ? String(trek.durationDays) : '',
    itinerary: trek.itinerary.map((d) => d.title).join('\n'),
    inclusions: trek.inclusions.join('\n'),
    exclusions: trek.exclusions.join('\n'),
    thingsToCarry: trek.thingsToCarry.join('\n'),
    cancellationPolicy: trek.cancellationPolicy ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  const body = (status?: 'draft' | 'published' | 'archived') => ({
    title: f.title.trim(),
    summary: f.summary.trim() || null,
    durationDays: f.durationDays ? Number(f.durationDays) : null,
    itinerary: linesToList(f.itinerary).map((title, i) => ({ day: i + 1, title })),
    inclusions: linesToList(f.inclusions),
    exclusions: linesToList(f.exclusions),
    thingsToCarry: linesToList(f.thingsToCarry),
    cancellationPolicy: f.cancellationPolicy.trim() || null,
    // Only send the destination when it changed (the server reuses or adds it).
    ...(destination.trim() && destination.trim() !== (trek.catalogTrekName ?? '')
      ? { catalogTrekName: destination.trim() }
      : {}),
    ...(status ? { status } : {}),
  });

  const save = (status?: 'draft' | 'published' | 'archived') =>
    action.run(
      async () => {
        const updated = await call(`/treks/${trek.id}`, OrganizerTrek, {
          method: 'PATCH',
          body: body(status),
        });
        onSaved(updated);
      },
      status === 'published' ? 'Published.' : status === 'archived' ? 'Archived.' : 'Saved.',
    );

  function submit(e: FormEvent) {
    e.preventDefault();
    void save();
  }

  const area = (k: keyof typeof f, label: string, hint?: string) => (
    <div className="field">
      <label htmlFor={`tf-${k}`}>
        {label} {hint && <span className="hint">{hint}</span>}
      </label>
      <textarea id={`tf-${k}`} disabled={!writable} value={f[k]} onChange={set(k)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="card stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Details</h2>
        <span className="small muted">
          {trek.status === 'published'
            ? 'Live on Ohviana'
            : 'Goes live automatically when you publish a batch'}
        </span>
      </div>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="tf-title">Title</label>
          <input
            id="tf-title"
            required
            disabled={!writable}
            value={f.title}
            onChange={set('title')}
          />
        </div>
        <div className="field">
          <label htmlFor="tf-days">Duration (days)</label>
          <input
            id="tf-days"
            type="number"
            min={1}
            max={60}
            disabled={!writable}
            value={f.durationDays}
            onChange={set('durationDays')}
          />
        </div>
      </div>
      <DestinationInput value={destination} onChange={setDestination} disabled={!writable} />
      <div className="field">
        <label htmlFor="tf-summary">Summary</label>
        <input
          id="tf-summary"
          maxLength={500}
          disabled={!writable}
          value={f.summary}
          onChange={set('summary')}
        />
      </div>
      {area('itinerary', 'Itinerary', '(one line per day)')}
      <div className="form-grid">
        {area('inclusions', 'Included', '(one per line)')}
        {area('exclusions', 'Not included', '(one per line)')}
        {area('thingsToCarry', 'Things to carry', '(one per line)')}
      </div>
      {area(
        'cancellationPolicy',
        'Cancellation policy',
        '(shown to customers and saved with each booking)',
      )}
      <Outcome error={action.error} message={action.message} />
      {writable && (
        <div className="cluster">
          <button type="submit" disabled={action.pending}>
            Save changes
          </button>
          {trek.status === 'published' && (
            <button
              type="button"
              className="secondary"
              disabled={action.pending}
              onClick={() =>
                confirm('Archive this trek? It will no longer appear on Ohviana.') &&
                save('archived')
              }
            >
              Archive
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function Pickups({
  trek,
  writable,
  onChange,
}: {
  trek: OrganizerTrek;
  writable: boolean;
  onChange: (t: OrganizerTrek) => void;
}) {
  const { call } = useOrg();
  const action = useAction();
  const [p, setP] = useState({ name: '', landmark: '', mapsUrl: '' });

  async function add(e: FormEvent) {
    e.preventDefault();
    const updated = await action.run(() =>
      call(`/treks/${trek.id}/pickups`, OrganizerTrek, {
        method: 'POST',
        body: {
          name: p.name.trim(),
          ...(p.landmark.trim() ? { landmark: p.landmark.trim() } : {}),
          ...(p.mapsUrl.trim() ? { mapsUrl: p.mapsUrl.trim() } : {}),
          sortOrder: trek.pickupPoints.length,
        },
      }),
    );
    if (updated) {
      onChange(updated);
      setP({ name: '', landmark: '', mapsUrl: '' });
    }
  }

  const remove = (pickupId: string) =>
    action.run(async () =>
      onChange(
        await call(`/treks/${trek.id}/pickups/${pickupId}`, OrganizerTrek, { method: 'DELETE' }),
      ),
    );

  return (
    <section className="card stack">
      <h2>Pickup points</h2>
      {trek.pickupPoints.length === 0 && (
        <p className="muted small" style={{ margin: 0 }}>
          No pickup points yet.
        </p>
      )}
      {trek.pickupPoints.map((pp) => (
        <div key={pp.id} className="spread small">
          <span>
            <strong>{pp.name}</strong>
            {pp.landmark && <span className="muted"> · {pp.landmark}</span>}
          </span>
          {writable && (
            <button type="button" className="small secondary" onClick={() => remove(pp.id)}>
              Remove
            </button>
          )}
        </div>
      ))}
      {writable && (
        <form onSubmit={add} className="form-grid">
          <div className="field">
            <label htmlFor="pp-name">Name</label>
            <input
              id="pp-name"
              required
              placeholder="Majestic Bus Stand"
              value={p.name}
              onChange={(e) => setP({ ...p, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="pp-landmark">Landmark</label>
            <input
              id="pp-landmark"
              value={p.landmark}
              onChange={(e) => setP({ ...p, landmark: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="pp-map">Map link (https)</label>
            <input
              id="pp-map"
              type="url"
              value={p.mapsUrl}
              onChange={(e) => setP({ ...p, mapsUrl: e.target.value })}
            />
          </div>
          <button type="submit" className="secondary" disabled={action.pending}>
            Add pickup
          </button>
        </form>
      )}
      <Outcome error={action.error} />
    </section>
  );
}

/** Creates one batch or a weekly series in a single all-or-nothing request (drafts). */
function AddBatches({ trek }: { trek: OrganizerTrek }) {
  const { call } = useOrg();
  const action = useAction();
  const [f, setF] = useState({
    departure: '',
    returnAt: '',
    cutoffHours: '12',
    weeks: '1',
    price: '',
    capacity: '20',
    maxPerBooking: '10',
  });
  const [pickupOffsets, setPickupOffsets] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dep = istLocalToIso(f.departure);
    const ret = istLocalToIso(f.returnAt);
    if (!dep || !ret) return action.setError('Enter departure and return date & time.');
    const paise = rupeesToPaise(f.price);
    if (paise === null) return action.setError('Enter the price in rupees, e.g. 2499');
    const weeks = Math.min(52, Math.max(1, Number(f.weeks) || 1));
    const WEEK = 7 * 86_400_000;
    const cutoffMs = Math.max(0, Number(f.cutoffHours) || 0) * 3_600_000;
    const departures = Array.from({ length: weeks }, (_, i) => {
      const d = Date.parse(dep) + i * WEEK;
      return {
        departureAt: new Date(d).toISOString(),
        returnAt: new Date(Date.parse(ret) + i * WEEK).toISOString(),
        bookingCutoffAt: new Date(d - cutoffMs).toISOString(),
      };
    });
    const pickups = Object.entries(pickupOffsets)
      .filter(([, v]) => v !== '')
      .map(([pickupPointId, v]) => ({
        pickupPointId,
        minutesFromDeparture: -Math.abs(Number(v) || 0),
      }));

    await action.run(
      async () => {
        const created = await call(`/treks/${trek.id}/batches/bulk`, OrganizerBatchArray, {
          method: 'POST',
          body: {
            pricePaise: paise,
            capacity: Number(f.capacity),
            maxSeatsPerBooking: Number(f.maxPerBooking),
            departures,
            pickups,
          },
        });
        return created;
      },
      `${weeks === 1 ? 'Draft batch' : `${weeks} draft batches`} created — publish them from Batches.`,
    );
  }

  return (
    <form onSubmit={submit} className="card stack">
      <h2>Add batches</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Times are in IST. Set “Repeat weekly” to create the same trip for several weeks; each batch
        gets its own name, seats and attendee list.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ab-dep">First departure</label>
          <input
            id="ab-dep"
            type="datetime-local"
            required
            value={f.departure}
            onChange={set('departure')}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-ret">Return</label>
          <input
            id="ab-ret"
            type="datetime-local"
            required
            value={f.returnAt}
            onChange={set('returnAt')}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-cut">Close bookings (hours before)</label>
          <input
            id="ab-cut"
            type="number"
            min={0}
            max={720}
            value={f.cutoffHours}
            onChange={set('cutoffHours')}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-weeks">Repeat weekly (weeks)</label>
          <input
            id="ab-weeks"
            type="number"
            min={1}
            max={52}
            value={f.weeks}
            onChange={set('weeks')}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-price">Price per person (₹)</label>
          <input
            id="ab-price"
            required
            inputMode="decimal"
            placeholder="2499"
            value={f.price}
            onChange={set('price')}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-cap">Seats</label>
          <input
            id="ab-cap"
            type="number"
            min={1}
            max={500}
            required
            value={f.capacity}
            onChange={set('capacity')}
          />
        </div>
        <div className="field">
          <label htmlFor="ab-max">Max seats per booking</label>
          <input
            id="ab-max"
            type="number"
            min={1}
            max={50}
            value={f.maxPerBooking}
            onChange={set('maxPerBooking')}
          />
        </div>
      </div>
      {trek.pickupPoints.length > 0 && (
        <div className="stack">
          <span className="small">
            <strong>Pickups</strong> — minutes before departure (leave empty to skip)
          </span>
          {trek.pickupPoints.map((p) => (
            <div key={p.id} className="form-grid">
              <span style={{ alignSelf: 'center' }}>{p.name}</span>
              <input
                type="number"
                min={0}
                max={1440}
                aria-label={`${p.name} minutes before departure`}
                value={pickupOffsets[p.id] ?? ''}
                onChange={(e) => setPickupOffsets({ ...pickupOffsets, [p.id]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
      <Outcome error={action.error} message={action.message} />
      <div className="cluster">
        <button type="submit" disabled={action.pending}>
          Create draft batches
        </button>
        {action.message && <Link href="/dashboard/batches?view=draft">Go to drafts →</Link>}
      </div>
    </form>
  );
}
