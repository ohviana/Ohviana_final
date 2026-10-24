'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState, type FormEvent } from 'react';
import { DirectLink, OrganizerBatch, OrganizerBooking } from '@ohviana/contracts';
import type { BookingSource } from '@ohviana/shared';
import { useAction } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Outcome } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { isoToIstLocal, istLocalToIso, paiseToRupees, rupeesToPaise } from '@/lib/datetime';
import { dateTime } from '@/lib/format';
import { toE164 } from '@/lib/phone';
import { shareUrl } from '@/lib/share';

export const SOURCE_LABELS: Record<BookingSource, { label: string; tone: string }> = {
  MARKETPLACE: { label: 'Marketplace', tone: '' },
  ORGANIZER_DIRECT: { label: 'Your link', tone: 'ok' },
  ORGANIZER_OFFLINE: { label: 'Added by you', tone: 'info' },
};

/**
 * One row per traveller, the same columns as the attendee CSV: who is coming, how to reach
 * them and where they board. Cancelled bookings stay listed, greyed out.
 */
export function TravellerTable({ bookings }: { bookings: OrganizerBooking[] }) {
  const rows = bookings.flatMap((bk) => bk.guests.map((g) => ({ bk, g })));
  return (
    <div className="table-wrap">
      <table className="traveller-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Traveller</th>
            <th>Phone</th>
            <th>Age</th>
            <th>Pickup</th>
            <th>Pickup time</th>
            <th>Booked by</th>
            <th>Booked by phone</th>
            <th>Booking</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ bk, g }, i) => (
            <tr
              key={`${bk.bookingReference}-${i}`}
              className={bk.status === 'cancelled' ? 'is-cancelled' : undefined}
            >
              <td className="muted">{i + 1}</td>
              <td>
                <strong>{g.fullName}</strong>
              </td>
              <td>{g.phone ? <a href={`tel:${g.phone}`}>{g.phone}</a> : <Dash />}</td>
              <td>{g.age ?? <Dash />}</td>
              <td>{g.pickup?.name ?? <Dash />}</td>
              <td>{g.pickup ? dateTime(g.pickup.pickupAt) : <Dash />}</td>
              <td>{bk.contact.name}</td>
              <td>
                <a href={`tel:${bk.contact.phone}`}>{bk.contact.phone}</a>
              </td>
              <td>
                <code>{bk.bookingReference}</code>
              </td>
              <td>
                <span className={`badge ${SOURCE_LABELS[bk.source].tone}`}>
                  {SOURCE_LABELS[bk.source].label}
                </span>
              </td>
              <td>
                <span className={`badge ${bk.status === 'confirmed' ? 'ok' : 'danger'}`}>
                  {bk.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dash() {
  return <span className="muted">—</span>;
}

/** A generated batch name that wraps only at its underscores ("RCB_Kudremukh_|25th_Sept_|…"). */
export function BatchName({ name }: { name: string }) {
  const parts = name.split('_');
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <>
              _<wbr />
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Record people who booked by phone, WhatsApp or at the bus: their seats count toward the
 * batch like online bookings, with no commission.
 */
interface TravellerRow {
  name: string;
  phone: string;
  pickupPointId: string;
}

const blankRow = (): TravellerRow => ({ name: '', phone: '', pickupPointId: '' });

export function AddMembers({
  batch,
  onAdded,
  onClose,
}: {
  batch: OrganizerBatch;
  onAdded: () => Promise<void>;
  onClose: () => void;
}) {
  const { call } = useOrg();
  const action = useAction();
  const blank = () => ({
    name: '',
    phone: '',
    email: '',
    travelling: true,
    pickupPointId: '',
    // One traveller (the contact) by default; "+ Add another traveller" adds more.
    others: [] as TravellerRow[],
    price: paiseToRupees(batch.pricePaise),
  });
  const [f, setF] = useState(blank);
  const others = f.others.filter((r) => r.name.trim());
  const count = (f.travelling && f.name.trim() ? 1 : 0) + others.length;
  const first = f.travelling ? 2 : 1; // number of the first "other" traveller

  const setRow = (i: number, patch: Partial<TravellerRow>) =>
    setF({ ...f, others: f.others.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const phone = toE164(f.phone);
    if (!phone) return action.setError('Enter a valid mobile number, e.g. 98765 43210');
    if (count === 0) return action.setError('Add at least one traveller.');
    const guests: { fullName: string; phone?: string; pickupPointId?: string }[] = [];
    if (f.travelling && f.name.trim()) {
      guests.push({
        fullName: f.name.trim(),
        phone,
        ...(f.pickupPointId ? { pickupPointId: f.pickupPointId } : {}),
      });
    }
    for (const r of others) {
      const own = r.phone.trim() ? toE164(r.phone) : null;
      if (r.phone.trim() && !own) {
        return action.setError(`Enter a valid mobile number for ${r.name.trim()}.`);
      }
      const pickupPointId = r.pickupPointId || f.pickupPointId;
      guests.push({
        fullName: r.name.trim(),
        ...(own ? { phone: own } : {}),
        ...(pickupPointId ? { pickupPointId } : {}),
      });
    }
    if (guests.some((g) => g.fullName.length < 2)) {
      return action.setError('Each name needs 2+ letters.');
    }
    if (guests.length > batch.seatsLeft) {
      return action.setError(
        `Only ${batch.seatsLeft} seat(s) left. Increase the batch's seats under Edit batch first.`,
      );
    }
    const unitPricePaise = rupeesToPaise(f.price);
    if (unitPricePaise === null) return action.setError('Enter the price in rupees, e.g. 2499');

    const ok = await action.run(
      async () => {
        const booking = await call(`/batches/${batch.id}/members`, OrganizerBooking, {
          method: 'POST',
          body: {
            contact: { name: f.name.trim(), phone, ...(f.email ? { email: f.email.trim() } : {}) },
            guests,
            ...(f.pickupPointId ? { pickupPointId: f.pickupPointId } : {}),
            unitPricePaise,
          },
        });
        await onAdded();
        return booking;
      },
      `Added ${guests.length} ${guests.length === 1 ? 'person' : 'people'} to ${batch.name}.`,
    );
    if (ok) setF(blank());
  }

  const set =
    (k: 'name' | 'phone' | 'email' | 'pickupPointId' | 'price') =>
    (e: { target: { value: string } }) =>
      setF({ ...f, [k]: e.target.value });

  const pickupOptions = (empty: string) => (
    <>
      <option value="">{empty}</option>
      {batch.pickups.map((p) => (
        <option key={p.pickupPointId} value={p.pickupPointId}>
          {p.name} · {dateTime(p.pickupAt)}
        </option>
      ))}
    </>
  );

  return (
    <form onSubmit={submit} className="card stack" id="add-members">
      <div className="spread">
        <h2 className="cluster" style={{ gap: 8, margin: 0 }}>
          <Icon name="users" /> Add members
        </h2>
        <span className="badge">{batch.seatsLeft} seats left</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        For people who booked by phone, WhatsApp or in person. Each traveller gets their own line in
        your attendee list with their mobile and pickup. No commission.
      </p>

      <h3 className="form-subhead">Booked by</h3>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="am-name">Contact name</label>
          <input id="am-name" required minLength={2} value={f.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="am-phone">Mobile</label>
          <input
            id="am-phone"
            required
            inputMode="tel"
            placeholder="98765 43210"
            value={f.phone}
            onChange={set('phone')}
          />
        </div>
        <div className="field">
          <label htmlFor="am-email">Email (optional)</label>
          <input id="am-email" type="email" value={f.email} onChange={set('email')} />
        </div>
        {batch.pickups.length > 0 && (
          <div className="field">
            <label htmlFor="am-pickup">Pickup</label>
            <select id="am-pickup" value={f.pickupPointId} onChange={set('pickupPointId')}>
              {pickupOptions('Not decided')}
            </select>
          </div>
        )}
      </div>
      <label className="check-field" style={{ minHeight: 0 }}>
        <input
          type="checkbox"
          checked={f.travelling}
          onChange={(e) =>
            setF({
              ...f,
              travelling: e.target.checked,
              // Someone has to travel: without the contact, start with one traveller row.
              others: !e.target.checked && f.others.length === 0 ? [blankRow()] : f.others,
            })
          }
        />
        The contact is travelling too {f.travelling && '(traveller 1)'}
      </label>

      {f.others.length > 0 && (
        <h3 className="form-subhead">{f.travelling ? 'Other travellers' : 'Travellers'}</h3>
      )}
      <div className="stack" style={{ gap: 10 }}>
        {f.others.map((r, i) => {
          const n = first + i;
          return (
            <div key={i} className="traveller-row">
              <span className="traveller-num" aria-hidden="true">
                {n}
              </span>
              <div className="field">
                <label htmlFor={`am-t${i}-name`}>Traveller {n} name</label>
                <input
                  id={`am-t${i}-name`}
                  value={r.name}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`am-t${i}-phone`}>
                  Traveller {n} mobile <span className="hint">(optional)</span>
                </label>
                <input
                  id={`am-t${i}-phone`}
                  inputMode="tel"
                  placeholder="98765 43210"
                  value={r.phone}
                  onChange={(e) => setRow(i, { phone: e.target.value })}
                />
              </div>
              {batch.pickups.length > 0 && (
                <div className="field">
                  <label htmlFor={`am-t${i}-pickup`}>Traveller {n} pickup</label>
                  <select
                    id={`am-t${i}-pickup`}
                    value={r.pickupPointId}
                    onChange={(e) => setRow(i, { pickupPointId: e.target.value })}
                  >
                    {pickupOptions('Same as contact')}
                  </select>
                </div>
              )}
              <button
                type="button"
                className="secondary icon-btn"
                aria-label={`Remove traveller ${n}`}
                disabled={!f.travelling && f.others.length === 1}
                onClick={() => setF({ ...f, others: f.others.filter((_, j) => j !== i) })}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="secondary small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setF({ ...f, others: [...f.others, blankRow()] })}
        >
          + Add another traveller
        </button>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="am-price">Price per person (₹)</label>
          <input id="am-price" inputMode="decimal" value={f.price} onChange={set('price')} />
        </div>
      </div>
      <Outcome error={action.error} message={action.message} />
      <div className="cluster">
        <button type="submit" disabled={action.pending}>
          {count > 1 ? `Add ${count} people` : 'Add to batch'}
        </button>
        <button type="button" className="link" onClick={onClose}>
          {action.message ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

/** Copies text, falling back to a prompt where the clipboard is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this link:', text);
    return false;
  }
}

/** Small "Copy link" button for a batch's booking link (batch lists). */
export function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="small secondary"
      onClick={async () => {
        if (await copyText(shareUrl(token))) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

/**
 * The batch's one booking link, created with the batch. Customers can book through it once the
 * batch is published; those bookings carry 0% commission.
 */
export function BookingLink({
  batch,
  onCreated,
}: {
  batch: OrganizerBatch;
  onCreated: () => Promise<void>;
}) {
  const { call, can } = useOrg();
  const action = useAction();
  const [copied, setCopied] = useState(false);
  const closed = batch.status === 'cancelled' || batch.status === 'completed';
  if (closed) return null;
  const url = batch.bookingLinkToken ? shareUrl(batch.bookingLinkToken) : null;
  const whatsapp = url
    ? `https://wa.me/?text=${encodeURIComponent(`Book your seat for ${batch.trekTitle}: ${url}`)}`
    : null;

  return (
    <section className="card stack" id="booking-link">
      <div className="spread">
        <h2 className="cluster" style={{ gap: 8, margin: 0 }}>
          <Icon name="link" /> Booking link
        </h2>
        <span className="badge ok">0% commission</span>
      </div>
      {url ? (
        <>
          <div className="link-box">
            <input
              readOnly
              aria-label="Booking link"
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={async () => {
                if (await copyText(url)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="spread small">
            <span className="muted">
              {batch.status === 'draft'
                ? 'Customers can book through it once you publish this batch.'
                : 'Share it on WhatsApp or Instagram. Bookings through it carry no commission.'}
            </span>
            {whatsapp && batch.status === 'published' && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                Share on WhatsApp →
              </a>
            )}
          </div>
        </>
      ) : (
        can('links:write') && (
          <button
            type="button"
            className="secondary"
            style={{ alignSelf: 'flex-start' }}
            disabled={action.pending}
            onClick={() =>
              action.run(async () => {
                await call('/direct-links', DirectLink, {
                  method: 'POST',
                  body: { batchId: batch.id, label: batch.name },
                });
                await onCreated();
              })
            }
          >
            Create booking link
          </button>
        )
      )}
      <Outcome error={action.error} />
    </section>
  );
}

/** A week later by default: same wall-clock times, so weekly trips are one click. */
function nextWeek(iso: string): string {
  return isoToIstLocal(new Date(new Date(iso).getTime() + 7 * 86_400_000).toISOString());
}

/** Copy this batch (price, seats, pickups, notes) onto new dates, as draft or published. */
export function RepeatBatch({ batch, onClose }: { batch: OrganizerBatch; onClose: () => void }) {
  const { call, can } = useOrg();
  const router = useRouter();
  const action = useAction();
  const [departure, setDeparture] = useState(() => nextWeek(batch.departureAt));
  const [ret, setRet] = useState(() => nextWeek(batch.returnAt));

  async function repeat(publish: boolean, e?: FormEvent) {
    e?.preventDefault();
    const departureAt = istLocalToIso(departure);
    const returnAt = istLocalToIso(ret);
    if (!departureAt || !returnAt) return action.setError('Enter departure and return.');
    const created = await action.run(() =>
      call(`/batches/${batch.id}/repeat`, OrganizerBatch, {
        method: 'POST',
        body: { departureAt, returnAt, publish },
      }),
    );
    if (created) router.push(`/dashboard/batches/${created.id}`);
  }

  return (
    <form onSubmit={(e) => repeat(false, e)} className="card stack" id="repeat">
      <h2 className="cluster" style={{ gap: 8, margin: 0 }}>
        <Icon name="calendar" /> Run this batch again
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        Same trek, price, seats and pickup points on new dates. It gets its own name and an empty
        attendee list.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="rb-dep">Departure (IST)</label>
          <input
            id="rb-dep"
            type="datetime-local"
            required
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rb-ret">Return (IST)</label>
          <input
            id="rb-ret"
            type="datetime-local"
            required
            value={ret}
            onChange={(e) => setRet(e.target.value)}
          />
        </div>
      </div>
      <Outcome error={action.error} message={action.message} />
      <div className="cluster">
        <button type="submit" className="secondary" disabled={action.pending}>
          Save as draft
        </button>
        {can('batches:publish') && (
          <button type="button" disabled={action.pending} onClick={() => void repeat(true)}>
            Save &amp; publish
          </button>
        )}
        <button type="button" className="link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
