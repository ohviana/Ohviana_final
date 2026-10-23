'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { OrganizerBatchArray, OrganizerBatchList, OrganizerTrek } from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { Icon, type IconName } from '@/components/Icon';
import { dateRange, dateTime, price } from '@/lib/format';
import { istLocalToIso, linesToList, rupeesToPaise } from '@/lib/datetime';
import { DestinationInput } from '../DestinationInput';
import { PhotoManager } from '../PhotoManager';
import {
  DIFFICULTY_CHOICES,
  ItineraryEditor,
  MAX_DURATION_DAYS,
  StartPointInput,
  draftsFrom,
  itineraryBody,
  type ItineraryDrafts,
} from '../TrekFields';

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
  const [editing, setEditing] = useState(false);

  if (trek.loading && !trek.data) return <Loading />;
  if (!trek.data) return <Outcome error={trek.error} />;
  const t = trek.data;
  const writable = can('treks:write') && t.status !== 'archived';

  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small">
          <Link href="/dashboard/treks">← Treks</Link>
        </span>
        <div className="spread">
          <span className="cluster" style={{ gap: 10 }}>
            <h1 style={{ margin: 0 }}>{t.title}</h1>
            <StatusBadge status={t.status} />
          </span>
          {writable &&
            (editing ? (
              <button type="button" className="secondary" onClick={() => setEditing(false)}>
                Done editing
              </button>
            ) : (
              <button type="button" className="secondary" onClick={() => setEditing(true)}>
                <Icon name="pencil" size={16} /> Edit trek
              </button>
            ))}
        </div>
      </div>
      {created && !editing && (
        <p className="notice ok small" style={{ margin: 0 }}>
          {created === 'published'
            ? 'Trek published. Add its dates below so trekkers can book.'
            : 'Trek saved. It goes live once your organization is approved; add its dates below.'}
        </p>
      )}
      {photosFailed > 0 && (
        <p className="notice warn small" style={{ margin: 0 }}>
          {photosFailed} photo(s) could not be uploaded. Add them again with Edit trek.
        </p>
      )}
      {editing ? (
        <>
          <TrekForm
            trek={t}
            onSaved={(x) => {
              trek.setData(x);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
          <PhotoManager trek={t} writable onChange={(x) => trek.setData(x)} />
          <Pickups trek={t} writable onChange={(x) => trek.setData(x)} />
        </>
      ) : (
        <>
          <TrekSummary trek={t} />
          <TrekDates trek={t} canAdd={can('batches:write') && t.status !== 'archived'} />
        </>
      )}
    </>
  );
}

/** Read-only view: photos, key facts and overview up front; the rest folds away. */
function TrekSummary({ trek: t }: { trek: OrganizerTrek }) {
  const facts: { icon: IconName; text: string }[] = [];
  if (t.catalogTrekName) facts.push({ icon: 'pin', text: t.catalogTrekName });
  if (t.durationDays) {
    facts.push({
      icon: 'calendar',
      text: `${t.durationDays} day${t.durationDays === 1 ? '' : 's'}`,
    });
  }
  if (t.difficulty) {
    facts.push({ icon: 'mountain', text: t.difficulty[0]!.toUpperCase() + t.difficulty.slice(1) });
  }
  if (t.maxAltitudeM) {
    facts.push({ icon: 'trendingUp', text: `${t.maxAltitudeM.toLocaleString('en-IN')} m` });
  }
  if (t.startPoint) facts.push({ icon: 'zap', text: `From ${t.startPoint}` });
  const list = (title: string, items: string[]) => (
    <div className="stack" style={{ gap: 6 }}>
      <strong>{title}</strong>
      {items.length ? (
        <ul className="plain" style={{ margin: 0 }}>
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <span className="muted small">Not added</span>
      )}
    </div>
  );

  return (
    <section className="card stack">
      <PhotoManager trek={t} writable={false} onChange={() => {}} />
      {facts.length > 0 && (
        <div className="fact-row">
          {facts.map((f) => (
            <span key={f.text}>
              <Icon name={f.icon} size={15} /> {f.text}
            </span>
          ))}
        </div>
      )}
      <p style={{ margin: 0 }} className={t.summary ? undefined : 'muted'}>
        {t.summary ?? 'No overview yet. Add one with Edit trek.'}
      </p>
      <details className="trek-more">
        <summary>Full details: itinerary, inclusions, policy and pickups</summary>
        <div className="stack-lg" style={{ paddingTop: 14 }}>
          <div className="stack" style={{ gap: 8 }}>
            <strong>Itinerary</strong>
            {t.itinerary.length ? (
              <ol className="timeline">
                {t.itinerary.map((d) => (
                  <li key={d.day}>
                    <span className="timeline-day">Day {d.day}</span>
                    <strong>{d.title}</strong>
                    {d.details && <div className="muted small">{d.details}</div>}
                  </li>
                ))}
              </ol>
            ) : (
              <span className="muted small">Not added</span>
            )}
          </div>
          <div className="two-up">
            {list('Included', t.inclusions)}
            {list('Not included', t.exclusions)}
          </div>
          {list('Things to carry', t.thingsToCarry)}
          <div className="stack" style={{ gap: 6 }}>
            <strong>Cancellation policy</strong>
            <span
              style={{ whiteSpace: 'pre-line' }}
              className={t.cancellationPolicy ? '' : 'muted small'}
            >
              {t.cancellationPolicy ?? 'Not added'}
            </span>
          </div>
          {list(
            'Pickup points',
            t.pickupPoints.map((p) => (p.landmark ? `${p.name} · ${p.landmark}` : p.name)),
          )}
        </div>
      </details>
    </section>
  );
}

/** This trek's dates, with the add form tucked behind a button. */
function TrekDates({ trek, canAdd }: { trek: OrganizerTrek; canAdd: boolean }) {
  const { call } = useOrg();
  const batches = useLoad(
    () => call(`/batches?trekId=${trek.id}&limit=20`, OrganizerBatchList),
    [call, trek.id],
  );
  const [adding, setAdding] = useState(false);
  const upcoming = (batches.data?.items ?? []).filter(
    (b) => b.view !== 'completed' && b.view !== 'cancelled',
  );

  return (
    <section className="card stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Dates</h2>
        {canAdd && !adding && (
          <button type="button" className="small" onClick={() => setAdding(true)}>
            + Add dates
          </button>
        )}
      </div>
      {adding && (
        <AddBatches
          trek={trek}
          onClose={() => setAdding(false)}
          onCreated={() => void batches.reload()}
        />
      )}
      {batches.loading && !batches.data ? (
        <Loading />
      ) : upcoming.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          No upcoming dates.{canAdd && !adding && ' Add dates so trekkers can book.'}
        </p>
      ) : (
        <ul className="date-rows">
          {upcoming.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/batches/${b.id}`} className="date-row">
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{dateRange(b.departureAt, b.returnAt)}</strong>
                  <span className="muted small">Departs {dateTime(b.departureAt)}</span>
                </span>
                <span className="small">{price(b.pricePaise)}</span>
                <span className="small muted">
                  {b.confirmedSeats}/{b.capacity} booked
                </span>
                <StatusBadge status={b.view} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <Link href={`/dashboard/batches?trekId=${trek.id}`} className="small">
          Manage in Batches →
        </Link>
      )}
    </section>
  );
}

/** Edit mode: every text field of the trek. Saving returns to the read-only view. */
function TrekForm({
  trek,
  onSaved,
  onCancel,
}: {
  trek: OrganizerTrek;
  onSaved: (t: OrganizerTrek) => void;
  onCancel: () => void;
}) {
  const { call } = useOrg();
  const action = useAction();
  const [destination, setDestination] = useState(trek.catalogTrekName ?? '');
  const [f, setF] = useState({
    title: trek.title,
    summary: trek.summary ?? '',
    durationDays: trek.durationDays ? String(trek.durationDays) : '',
    difficulty: trek.difficulty ?? '',
    altitude: trek.maxAltitudeM ? String(trek.maxAltitudeM) : '',
    inclusions: trek.inclusions.join('\n'),
    exclusions: trek.exclusions.join('\n'),
    thingsToCarry: trek.thingsToCarry.join('\n'),
    cancellationPolicy: trek.cancellationPolicy ?? '',
  });
  const [startPoint, setStartPoint] = useState(trek.startPoint ?? '');
  const [days, setDays] = useState<ItineraryDrafts>(draftsFrom(trek.itinerary));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const durationDays = f.durationDays ? Number(f.durationDays) : null;

  const body = (status?: 'draft' | 'published' | 'archived') => ({
    title: f.title.trim(),
    summary: f.summary.trim() || null,
    durationDays,
    difficulty: (f.difficulty || null) as OrganizerTrek['difficulty'],
    maxAltitudeM: f.altitude ? Number(f.altitude) : null,
    startPoint: startPoint.trim() || null,
    itinerary: itineraryBody(days, durationDays),
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
      status === 'archived' ? 'Archived.' : 'Saved.',
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
      <textarea id={`tf-${k}`} value={f[k]} onChange={set(k)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="card stack">
      <h2 style={{ margin: 0 }}>Edit details</h2>
      <div className="form-grid">
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="tf-title">Title</label>
          <input id="tf-title" required value={f.title} onChange={set('title')} />
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="tf-days">Duration</label>
          <select id="tf-days" value={f.durationDays} onChange={set('durationDays')}>
            <option value="">Select</option>
            {Array.from(
              { length: Math.max(MAX_DURATION_DAYS, trek.durationDays ?? 0) },
              (_, i) => i + 1,
            ).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'day' : 'days'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tf-difficulty">Difficulty</label>
          <select id="tf-difficulty" value={f.difficulty} onChange={set('difficulty')}>
            <option value="">Select</option>
            {DIFFICULTY_CHOICES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
            {/* Older treks may use a level the form no longer offers. */}
            {f.difficulty && !DIFFICULTY_CHOICES.some((d) => d.value === f.difficulty) && (
              <option value={f.difficulty}>{f.difficulty}</option>
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tf-alt">
            Altitude <span className="hint">(metres)</span>
          </label>
          <input
            id="tf-alt"
            inputMode="numeric"
            value={f.altitude}
            onChange={(e) =>
              setF({ ...f, altitude: e.target.value.replace(/\D/g, '').slice(0, 4) })
            }
          />
        </div>
        <StartPointInput value={startPoint} onChange={setStartPoint} />
      </div>
      <DestinationInput value={destination} onChange={setDestination} />
      <div className="field">
        <label htmlFor="tf-summary">Overview</label>
        <textarea
          id="tf-summary"
          rows={3}
          maxLength={500}
          value={f.summary}
          onChange={set('summary')}
        />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <strong>Itinerary</strong>
        <ItineraryEditor durationDays={durationDays} drafts={days} onChange={setDays} />
      </div>
      <div className="two-up">
        {area('inclusions', 'Included', '(one per line)')}
        {area('exclusions', 'Not included', '(one per line)')}
      </div>
      {area('thingsToCarry', 'Things to carry', '(one per line)')}
      {area(
        'cancellationPolicy',
        'Cancellation policy',
        '(shown to customers and saved with each booking)',
      )}
      <Outcome error={action.error} message={action.message} />
      <div className="cluster">
        <button type="submit" disabled={action.pending}>
          Save changes
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        {trek.status === 'published' && (
          <button
            type="button"
            className="secondary"
            disabled={action.pending}
            onClick={() =>
              confirm('Archive this trek? It will no longer appear on Ohviana.') && save('archived')
            }
          >
            Archive
          </button>
        )}
      </div>
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
function AddBatches({
  trek,
  onClose,
  onCreated,
}: {
  trek: OrganizerTrek;
  onClose: () => void;
  onCreated: () => void;
}) {
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
        onCreated();
        return created;
      },
      `${weeks === 1 ? 'Draft batch' : `${weeks} draft batches`} created — publish them from Batches.`,
    );
  }

  return (
    <form onSubmit={submit} className="stack add-dates">
      <strong>Add dates</strong>
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
        <button type="button" className="secondary" onClick={onClose}>
          {action.message ? 'Close' : 'Cancel'}
        </button>
        {action.message && <Link href="/dashboard/batches?view=draft">Go to drafts →</Link>}
      </div>
    </form>
  );
}
