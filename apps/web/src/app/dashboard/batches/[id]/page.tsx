'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  DirectLink,
  OrganizerBatch,
  OrganizerBooking,
  OrganizerBookingList,
  OrganizerTrek,
} from '@ohviana/contracts';
import { useAction, useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { askReason, Loading, Outcome, StatusBadge } from '@/components/dash/ui';
import { authedDownload } from '@/lib/authed';
import { isoToIstLocal, istLocalToIso, paiseToRupees, rupeesToPaise } from '@/lib/datetime';
import { dateRange, dateTime, price } from '@/lib/format';
import { shareUrl } from '../../links/share';

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { call, can, org } = useOrg();
  const batch = useLoad(() => call(`/batches/${id}`, OrganizerBatch), [call, id]);
  const bookings = useLoad(() => call(`/batches/${id}/bookings`, OrganizerBookingList), [call, id]);
  const trekId = batch.data?.organizerTrekId;
  const trek = useLoad(
    async () => (trekId ? call(`/treks/${trekId}`, OrganizerTrek) : null),
    [call, trekId],
  );
  const action = useAction();
  const [link, setLink] = useState<string | null>(null);

  if (batch.loading && !batch.data) return <Loading />;
  if (!batch.data) return <Outcome error={batch.error} />;
  const b = batch.data;
  const editable = can('batches:write') && !['cancelled', 'completed', 'ongoing'].includes(b.view);

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

  const share = () =>
    action.run(async () => {
      const created = await call('/direct-links', DirectLink, {
        method: 'POST',
        body: { batchId: b.id, label: `${b.trekTitle} ${dateRange(b.departureAt, b.returnAt)}` },
      });
      setLink(shareUrl(created.token));
    });

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
          <h1 style={{ margin: 0 }}>
            {b.trekTitle} · {dateRange(b.departureAt, b.returnAt)}
          </h1>
          <StatusBadge status={b.view} />
        </div>
        <span className="muted">
          Departs {dateTime(b.departureAt)} · {b.confirmedSeats}/{b.capacity} seats booked ·{' '}
          {price(b.pricePaise)} per person
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
        {b.status === 'published' && can('links:write') && (
          <button type="button" className="secondary" onClick={share} disabled={action.pending}>
            Create share link
          </button>
        )}
        {can('bookings:read') && (
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
      {b.status === 'draft' && trek.data && trek.data.status !== 'published' && (
        <p className="notice warn small" style={{ margin: 0 }}>
          This batch can only be published after its trek is published
          {trek.data.catalogTrekId ? '' : ' (and the trek needs a catalog trek linked)'}.{' '}
          <Link href={`/dashboard/treks/${trek.data.id}`}>Open “{trek.data.title}”</Link>
        </p>
      )}
      {link && (
        <div className="notice ok stack small" style={{ gap: 6 }}>
          <span>
            Share this link on WhatsApp or Instagram. Bookings through it carry 0% commission.
          </span>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      <Outcome error={action.error} message={action.message} />

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
          <p className="muted">No bookings yet.</p>
        )}
        {bookings.data && bookings.data.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Lead contact</th>
                  <th>Travellers</th>
                  <th>Pickup</th>
                  <th>Source</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {bookings.data.items.map((bk) => (
                  <tr key={bk.bookingReference}>
                    <td>
                      <code>{bk.bookingReference}</code>
                    </td>
                    <td>
                      {bk.contact.name}
                      <div className="muted small">
                        <a href={`tel:${bk.contact.phone}`}>{bk.contact.phone}</a>
                      </div>
                      {bk.emergencyContact && (
                        <div className="muted small">
                          SOS: {bk.emergencyContact.name} {bk.emergencyContact.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      {bk.guests.map((g) => g.fullName + (g.age ? ` (${g.age})` : '')).join(', ')}
                    </td>
                    <td>{bk.pickup?.name ?? '—'}</td>
                    <td>
                      <span className={`badge ${bk.source === 'ORGANIZER_DIRECT' ? 'ok' : ''}`}>
                        {bk.source === 'ORGANIZER_DIRECT' ? 'Direct' : 'Marketplace'}
                      </span>
                    </td>
                    <td>
                      {price(bk.totalPaise)}
                      {bk.commissionPaise > 0 && (
                        <div className="muted small">commission {price(bk.commissionPaise)}</div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={bk.status} />
                    </td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editable && <EditBatch batch={b} onSaved={refresh} />}
      {editable && trek.data && <BatchPickups batch={b} trek={trek.data} onSaved={refresh} />}
    </>
  );
}

function EditBatch({ batch, onSaved }: { batch: OrganizerBatch; onSaved: () => Promise<void> }) {
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
    if (Object.keys(body).length === 0) return action.setError('Nothing changed.');
    await action.run(async () => {
      await call(`/batches/${batch.id}`, OrganizerBatch, { method: 'PATCH', body });
      await onSaved();
    }, 'Saved.');
  }

  const field = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });

  return (
    <form onSubmit={save} className="card stack">
      <h2>Edit batch</h2>
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
      <div className="field">
        <label htmlFor="eb-notes">Notes for customers</label>
        <textarea id="eb-notes" {...field('notes')} />
      </div>
      <Outcome error={action.error} message={action.message} />
      <button type="submit" disabled={action.pending} style={{ alignSelf: 'flex-start' }}>
        Save changes
      </button>
    </form>
  );
}

function BatchPickups({
  batch,
  trek,
  onSaved,
}: {
  batch: OrganizerBatch;
  trek: OrganizerTrek;
  onSaved: () => Promise<void>;
}) {
  const { call } = useOrg();
  const action = useAction();
  const [times, setTimes] = useState<Record<string, string>>(() =>
    Object.fromEntries(batch.pickups.map((p) => [p.pickupPointId, isoToIstLocal(p.pickupAt)])),
  );

  if (trek.pickupPoints.length === 0) {
    return (
      <p className="muted small">
        No pickup points on this trek yet.{' '}
        <Link href={`/dashboard/treks/${trek.id}`}>Add pickup points</Link>
      </p>
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const pickups = Object.entries(times)
      .filter(([, t]) => t)
      .map(([pickupPointId, t]) => ({ pickupPointId, pickupAt: istLocalToIso(t) }));
    if (pickups.some((p) => !p.pickupAt)) return action.setError('Check the pickup times.');
    await action.run(async () => {
      await call(`/batches/${batch.id}/pickups`, OrganizerBatch, {
        method: 'PUT',
        body: { pickups },
      });
      await onSaved();
    }, 'Pickup times saved.');
  }

  return (
    <form onSubmit={save} className="card stack">
      <h2>Pickup times</h2>
      <p className="small muted" style={{ margin: 0 }}>
        Leave a time empty to not offer that pickup for this batch.
      </p>
      {trek.pickupPoints.map((p) => (
        <div key={p.id} className="form-grid">
          <span style={{ alignSelf: 'center' }}>{p.name}</span>
          <input
            type="datetime-local"
            aria-label={`${p.name} pickup time`}
            value={times[p.id] ?? ''}
            onChange={(e) => setTimes({ ...times, [p.id]: e.target.value })}
          />
        </div>
      ))}
      <Outcome error={action.error} message={action.message} />
      <button type="submit" disabled={action.pending} style={{ alignSelf: 'flex-start' }}>
        Save pickups
      </button>
    </form>
  );
}
