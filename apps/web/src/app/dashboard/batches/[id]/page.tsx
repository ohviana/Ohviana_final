'use client';

import Link from 'next/link';
import { prettyPhone, toE164 } from '@/lib/phone';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  OrganizerBatch,
  OrganizerBooking,
  OrganizerBookingList,
  OrganizerTrek,
} from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { askReason, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { authedDownload } from '@/lib/authed';
import { isoToIstLocal, istLocalToIso, paiseToRupees, rupeesToPaise } from '@/lib/datetime';
import { dateRange, dateTime, price } from '@/lib/format';
import {
  AddMembers,
  BatchName,
  BookingLink,
  RepeatBatch,
  SOURCE_LABELS,
  TravellerTable,
} from './BatchTools';

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { call, can, org } = useOrg();
  const batch = useLoad(() => call(`/batches/${id}`, OrganizerBatch), [call, id]);
  const bookings = useLoad(() => call(`/batches/${id}/bookings`, OrganizerBookingList), [call, id]);
  const trekId = batch.data?.organizerTrekId;
  const trek = useLoad(
    // Only editors need the trek (its pickup points); trek leads can't read treks.
    async () => (trekId && can('batches:write') ? call(`/treks/${trekId}`, OrganizerTrek) : null),
    [call, trekId, can],
  );
  const action = useAction();
  const [view, setView] = useState<'travellers' | 'bookings'>('travellers');
  // At most one tool open at a time; none by default.
  const [panel, setPanel] = useState<'edit' | 'members' | 'repeat' | null>(null);
  const toggle = (p: NonNullable<typeof panel>) => setPanel(panel === p ? null : p);

  if (batch.loading && !batch.data) return <Loading />;
  if (!batch.data) return <Outcome error={batch.error} />;
  const b = batch.data;
  const editable = can('batches:write') && !['cancelled', 'completed', 'ongoing'].includes(b.view);
  // Members can be added until the trip ends (walk-ins at the bus count too).
  const canAdd =
    can('bookings:manage') &&
    (b.status === 'draft' || b.status === 'published') &&
    new Date(b.returnAt) > new Date();

  const refresh = async () => {
    await Promise.all([batch.reload(), bookings.reload()]);
  };

  const publish = () =>
    action.run(async () => {
      await call(`/batches/${b.id}/publish`, OrganizerBatch, { method: 'POST' });
      await refresh();
    }, 'Published — customers can book this batch now.');

  const cancel = () => {
    const reason = askReason(
      'Why is this batch cancelled? All its bookings will be cancelled and customers notified.',
    );
    if (!reason) return;
    void action.run(async () => {
      await call(`/batches/${b.id}/cancel`, OrganizerBatch, { method: 'POST', body: { reason } });
      await refresh();
    }, 'Batch cancelled.');
  };

  const cancelBooking = (bk: OrganizerBooking) => {
    const reason = askReason(
      `Cancel booking ${bk.bookingReference}? Give a reason for the customer.`,
    );
    if (!reason) return;
    void action.run(async () => {
      await call(`/bookings/${bk.bookingReference}/cancel`, OrganizerBooking, {
        method: 'POST',
        body: { reason },
      });
      await refresh();
    }, `Booking ${bk.bookingReference} cancelled; seats released.`);
  };

  return (
    <>
      <div className="stack">
        <span className="small">
          <Link href="/dashboard/batches">← Batches</Link>
        </span>
        <div className="spread">
          <h1 className="batch-title" style={{ margin: 0 }}>
            <BatchName name={b.name} />
          </h1>
          <StatusBadge status={b.view} />
        </div>
        <span className="muted">
          {b.trekTitle} · {dateRange(b.departureAt, b.returnAt)} · departs {dateTime(b.departureAt)}{' '}
          · {b.confirmedSeats}/{b.capacity} seats booked · {price(b.pricePaise)} per person
        </span>
        {b.cancelReason && <p className="notice danger small">Cancelled: {b.cancelReason}</p>}
      </div>

      <div className="cluster">
        {b.status === 'draft' && can('batches:publish') && (
          <button type="button" onClick={publish} disabled={action.pending}>
            Publish
          </button>
        )}
        {b.status === 'draft' && !can('batches:publish') && org.status === 'pending' && (
          <span className="badge warn">Publishing unlocks after approval</span>
        )}
        {editable && (
          <button
            type="button"
            className="secondary"
            aria-expanded={panel === 'edit'}
            onClick={() => toggle('edit')}
          >
            <Icon name="pencil" size={16} /> Edit batch
          </button>
        )}
        {canAdd && (
          <button
            type="button"
            className="secondary"
            aria-expanded={panel === 'members'}
            onClick={() => toggle('members')}
          >
            <Icon name="users" size={16} /> Add members
          </button>
        )}
        {can('batches:write') && (
          <button
            type="button"
            className="secondary"
            aria-expanded={panel === 'repeat'}
            onClick={() => toggle('repeat')}
          >
            <Icon name="calendar" size={16} /> Run again
          </button>
        )}
        {can('attendees:read') && (
          <button
            type="button"
            className="secondary"
            disabled={action.pending}
            onClick={() =>
              action.run(() =>
                authedDownload(`/v1/organizer/batches/${b.id}/attendees.csv`, org.organizerId),
              )
            }
          >
            Download attendees (CSV)
          </button>
        )}
        {b.status === 'published' && editable && (
          <button type="button" className="danger" onClick={cancel} disabled={action.pending}>
            Cancel batch
          </button>
        )}
      </div>
      {b.status === 'draft' && trek.data && !trek.data.catalogTrekId && (
        <p className="notice warn small" style={{ margin: 0 }}>
          Add the trek&apos;s destination before publishing.{' '}
          <Link href={`/dashboard/treks/${trek.data.id}`}>Open “{trek.data.title}”</Link>
        </p>
      )}
      <Outcome error={action.error} message={action.message} />
      {panel === 'edit' && editable && (
        <EditBatch
          batch={b}
          trek={trek.data}
          onSaved={async () => {
            await refresh();
            setPanel(null);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'members' && canAdd && (
        <AddMembers batch={b} onAdded={refresh} onClose={() => setPanel(null)} />
      )}
      {panel === 'repeat' && can('batches:write') && (
        <RepeatBatch key={b.id} batch={b} onClose={() => setPanel(null)} />
      )}
      <BookingLink batch={b} onCreated={batch.reload} />

      {b.leads.length > 0 && (
        <section className="card stack" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>Trek leads</h2>
          {b.leads.map((l) => (
            <div key={l.phone} className="spread small">
              <strong>{l.name}</strong>
              <a href={`tel:${l.phone}`}>{prettyPhone(l.phone)}</a>
            </div>
          ))}
        </section>
      )}

      <section className="stack">
        <h2>
          Bookings{' '}
          {bookings.data && (
            <span className="muted small">
              {bookings.data.totals.confirmedBookings} confirmed ·{' '}
              {bookings.data.totals.confirmedSeats} seats · {bookings.data.totals.cancelledBookings}{' '}
              cancelled
            </span>
          )}
        </h2>
        <Outcome error={bookings.error} />
        {bookings.data && bookings.data.items.length === 0 && (
          <p className="muted">
            No bookings yet.
            {canAdd && ' Use Add members for people who booked by phone or WhatsApp.'}
          </p>
        )}
        {bookings.data && bookings.data.items.length > 0 && (
          <div className="tabs" role="group" aria-label="Show">
            <button
              type="button"
              aria-pressed={view === 'travellers'}
              onClick={() => setView('travellers')}
            >
              Travellers ({bookings.data.items.reduce((n, bk) => n + bk.guests.length, 0)})
            </button>
            <button
              type="button"
              aria-pressed={view === 'bookings'}
              onClick={() => setView('bookings')}
            >
              Bookings ({bookings.data.items.length})
            </button>
          </div>
        )}
        {bookings.data && bookings.data.items.length > 0 && view === 'travellers' && (
          <TravellerTable bookings={bookings.data.items} />
        )}
        {bookings.data && bookings.data.items.length > 0 && view === 'bookings' && (
          <ul className="booking-cards">
            {bookings.data.items.map((bk) => (
              <li
                key={bk.bookingReference}
                className={`card booking-card${bk.status === 'cancelled' ? ' is-cancelled' : ''}`}
              >
                <div className="booking-card-head">
                  <div className="cluster" style={{ gap: 8 }}>
                    <code>{bk.bookingReference}</code>
                    <span className={`badge ${SOURCE_LABELS[bk.source].tone}`}>
                      {SOURCE_LABELS[bk.source].label}
                    </span>
                    <StatusBadge status={bk.status} />
                  </div>
                  <div className="cluster" style={{ gap: 12 }}>
                    <span style={{ textAlign: 'right' }}>
                      <strong>{price(bk.totalPaise)}</strong>
                      {bk.commissionPaise > 0 && (
                        <span className="muted small">
                          {' '}
                          · commission {price(bk.commissionPaise)}
                        </span>
                      )}
                    </span>
                    {bk.status === 'confirmed' &&
                      can('bookings:manage') &&
                      b.view !== 'completed' && (
                        <button
                          type="button"
                          className="small danger"
                          onClick={() => cancelBooking(bk)}
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </div>
                <div className="booking-card-body">
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="booking-label">Booked by</span>
                    <strong>{bk.contact.name}</strong>
                    <a className="small" href={`tel:${bk.contact.phone}`}>
                      {bk.contact.phone}
                    </a>
                    {bk.emergencyContact && (
                      <span className="muted small">
                        Emergency: {bk.emergencyContact.name} · {bk.emergencyContact.phone}
                      </span>
                    )}
                  </div>
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="booking-label">
                      {bk.guests.length} traveller{bk.guests.length === 1 ? '' : 's'}
                    </span>
                    <ol className="traveller-list">
                      {bk.guests.map((g, i) => (
                        <li key={i}>
                          <span className="t-name">
                            {g.fullName}
                            {(g.age || g.gender) && (
                              <span className="muted small">
                                {' '}
                                {[g.age && `${g.age} yrs`, g.gender].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                          <span className="t-phone small">
                            {g.phone ? (
                              <a href={`tel:${g.phone}`}>{g.phone}</a>
                            ) : (
                              <span className="muted">No phone</span>
                            )}
                          </span>
                          <span className="t-pickup small">
                            {g.pickup ? (
                              <>
                                {g.pickup.name}
                                <span className="muted"> · {dateTime(g.pickup.pickupAt)}</span>
                              </>
                            ) : (
                              <span className="muted">No pickup</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

interface LeadRow {
  key: number;
  name: string;
  phone: string;
}
let leadKey = 1;

/** Dates, price, seats, notes, pickup times and trek leads, saved together. */
function EditBatch({
  batch,
  trek,
  onSaved,
  onClose,
}: {
  batch: OrganizerBatch;
  trek: OrganizerTrek | null;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const { call } = useOrg();
  const action = useAction();
  const initial = {
    departureAt: isoToIstLocal(batch.departureAt),
    returnAt: isoToIstLocal(batch.returnAt),
    bookingCutoffAt: isoToIstLocal(batch.bookingCutoffAt),
    price: paiseToRupees(batch.pricePaise),
    capacity: String(batch.capacity),
    maxSeatsPerBooking: String(batch.maxSeatsPerBooking),
    notes: batch.notes ?? '',
  };
  const [f, setF] = useState(initial);
  const initialTimes: Record<string, string> = Object.fromEntries(
    batch.pickups.map((p) => [p.pickupPointId, isoToIstLocal(p.pickupAt)]),
  );
  const [times, setTimes] = useState(initialTimes);
  const [leads, setLeads] = useState<LeadRow[]>(() =>
    batch.leads.length
      ? batch.leads.map((l) => ({ key: leadKey++, name: l.name, phone: prettyPhone(l.phone) }))
      : [{ key: leadKey++, name: '', phone: '' }],
  );
  const datesLocked = batch.confirmedSeats > 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    if (f.departureAt !== initial.departureAt) body.departureAt = istLocalToIso(f.departureAt);
    if (f.returnAt !== initial.returnAt) body.returnAt = istLocalToIso(f.returnAt);
    if (f.bookingCutoffAt !== initial.bookingCutoffAt)
      body.bookingCutoffAt = istLocalToIso(f.bookingCutoffAt);
    if (f.price !== initial.price) {
      const paise = rupeesToPaise(f.price);
      if (paise === null) return action.setError('Enter the price in rupees, e.g. 2499');
      body.pricePaise = paise;
    }
    if (f.capacity !== initial.capacity) body.capacity = Number(f.capacity);
    if (f.maxSeatsPerBooking !== initial.maxSeatsPerBooking)
      body.maxSeatsPerBooking = Number(f.maxSeatsPerBooking);
    if (f.notes !== initial.notes) body.notes = f.notes.trim() || null;
    if (['departureAt', 'returnAt', 'bookingCutoffAt'].some((k) => k in body && body[k] === null)) {
      return action.setError('Check the dates.');
    }

    const nextLeads: { name: string; phone: string }[] = [];
    for (const l of leads.filter((x) => x.name.trim() || x.phone.trim())) {
      const phone = toE164(l.phone);
      if (!l.name.trim() || !phone) {
        return action.setError('Give each trek lead a name and a valid mobile number.');
      }
      nextLeads.push({ name: l.name.trim(), phone });
    }
    if (JSON.stringify(nextLeads) !== JSON.stringify(batch.leads)) body.leads = nextLeads;

    const pickups = Object.entries(times)
      .filter(([, t]) => t)
      .map(([pickupPointId, t]) => ({ pickupPointId, pickupAt: istLocalToIso(t) }));
    if (pickups.some((p) => !p.pickupAt)) return action.setError('Check the pickup times.');
    const pickupsChanged =
      JSON.stringify(
        Object.entries(times)
          .filter(([, t]) => t)
          .sort(),
      ) !== JSON.stringify(Object.entries(initialTimes).sort());

    if (Object.keys(body).length === 0 && !pickupsChanged)
      return action.setError('Nothing changed.');
    await action.run(async () => {
      if (Object.keys(body).length) {
        await call(`/batches/${batch.id}`, OrganizerBatch, { method: 'PATCH', body });
      }
      if (pickupsChanged) {
        await call(`/batches/${batch.id}/pickups`, OrganizerBatch, {
          method: 'PUT',
          body: { pickups },
        });
      }
      await onSaved();
    });
  }

  const field = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  const setLead = (key: number, k: 'name' | 'phone', v: string) =>
    setLeads(leads.map((l) => (l.key === key ? { ...l, [k]: v } : l)));

  return (
    <form onSubmit={save} className="card stack">
      <h2 style={{ margin: 0 }}>Edit batch</h2>
      {datesLocked && (
        <p className="small muted" style={{ margin: 0 }}>
          Departure and return are locked because seats are booked. Price changes apply to new
          bookings only.
        </p>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="eb-dep">Departure (IST)</label>
          <input
            id="eb-dep"
            type="datetime-local"
            disabled={datesLocked}
            {...field('departureAt')}
          />
        </div>
        <div className="field">
          <label htmlFor="eb-ret">Return (IST)</label>
          <input id="eb-ret" type="datetime-local" disabled={datesLocked} {...field('returnAt')} />
        </div>
        <div className="field">
          <label htmlFor="eb-cut">Booking cutoff (IST)</label>
          <input id="eb-cut" type="datetime-local" {...field('bookingCutoffAt')} />
        </div>
        <div className="field">
          <label htmlFor="eb-price">Price per person (₹)</label>
          <input id="eb-price" inputMode="decimal" {...field('price')} />
        </div>
        <div className="field">
          <label htmlFor="eb-cap">Capacity</label>
          <input
            id="eb-cap"
            type="number"
            min={Math.max(1, batch.confirmedSeats)}
            max={500}
            {...field('capacity')}
          />
        </div>
        <div className="field">
          <label htmlFor="eb-max">Max seats per booking</label>
          <input id="eb-max" type="number" min={1} max={50} {...field('maxSeatsPerBooking')} />
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <strong className="small">Pickup times</strong>
        {!trek || trek.pickupPoints.length === 0 ? (
          <span className="small muted">
            No pickup points on this trek yet. Add them when adding dates, or under Edit trek.
          </span>
        ) : (
          <>
            <span className="small muted">
              Leave a time empty to skip that pickup for this batch.
            </span>
            {trek.pickupPoints.map((p) => (
              <div key={p.id} className="row-inputs">
                <span>{p.name}</span>
                <input
                  type="datetime-local"
                  aria-label={`${p.name} pickup time`}
                  value={times[p.id] ?? ''}
                  onChange={(e) => setTimes({ ...times, [p.id]: e.target.value })}
                />
                <span />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <strong className="small">Trek leads</strong>
        {leads.map((l, i) => (
          <div key={l.key} className="row-inputs">
            <input
              aria-label={`Trek lead ${i + 1} name`}
              maxLength={80}
              placeholder="Name"
              value={l.name}
              onChange={(e) => setLead(l.key, 'name', e.target.value)}
            />
            <input
              aria-label={`Trek lead ${i + 1} mobile`}
              type="tel"
              inputMode="tel"
              placeholder="Mobile, e.g. 98450 12345"
              value={l.phone}
              onChange={(e) => setLead(l.key, 'phone', e.target.value)}
            />
            <button
              type="button"
              className="small secondary"
              aria-label={`Remove trek lead ${i + 1}`}
              onClick={() => setLeads(leads.filter((x) => x.key !== l.key))}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        {leads.length < 5 && (
          <button
            type="button"
            className="link small"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setLeads([...leads, { key: leadKey++, name: '', phone: '' }])}
          >
            + Add trek lead
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor="eb-notes">Notes for customers</label>
        <textarea id="eb-notes" {...field('notes')} />
      </div>
      <Outcome error={action.error} message={action.message} />
      <div className="cluster">
        <button type="submit" disabled={action.pending}>
          Save changes
        </button>
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
