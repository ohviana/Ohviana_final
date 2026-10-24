'use client';

import Link from 'next/link';
import { DashboardSummary, OrganizerProfile } from '@ohviana/contracts';
import { Icon, type IconName } from '@/components/Icon';
import { useLoad } from '@/components/dash/hooks';
import { useOrg } from '@/components/dash/org-context';
import { Loading, Outcome } from '@/components/dash/ui';
import { price } from '@/lib/format';

const VIEWS: { view: string; label: string; icon: IconName; tone?: 'sun' | 'danger' }[] = [
  { view: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { view: 'draft', label: 'Drafts', icon: 'clipboard', tone: 'sun' },
  { view: 'sold_out', label: 'Sold out', icon: 'zap', tone: 'sun' },
  { view: 'booking_closed', label: 'Booking closed', icon: 'clock' },
  { view: 'ongoing', label: 'On the trail', icon: 'mountain' },
  { view: 'completed', label: 'Completed', icon: 'check' },
  { view: 'cancelled', label: 'Cancelled', icon: 'logOut', tone: 'danger' },
];

export default function OverviewPage() {
  const { org, call, can, me } = useOrg();
  const summary = useLoad(() => call('/dashboard/summary', DashboardSummary), [call]);
  const profile = useLoad(() => call('/profile', OrganizerProfile), [call]);
  const firstName = me.user.fullName?.split(' ')[0];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>{firstName ? `Hi ${firstName} 👋` : org.name}</h1>
        </div>
        {can('treks:write') && (
          <div className="cluster">
            <Link href="/dashboard/treks/new" className="btn secondary">
              <Icon name="mountain" size={16} /> Add a trek
            </Link>
            <Link href="/dashboard/batches" className="btn">
              <Icon name="calendar" size={16} /> Manage batches
            </Link>
          </div>
        )}
      </div>

      {org.status === 'pending' && (
        <div className="notice warn cluster" style={{ alignItems: 'flex-start', gap: 12 }}>
          <span className="icon-circle sun" style={{ width: 40, height: 40 }}>
            <Icon name="clock" />
          </span>
          <div className="stack" style={{ gap: 2 }}>
            <strong>Awaiting approval from Ohviana</strong>
            <span className="small">
              Set up your treks and draft batches now — you can publish them and share booking links
              as soon as you&apos;re approved.
            </span>
          </div>
        </div>
      )}
      {(org.status === 'rejected' || org.status === 'suspended') && (
        <div className="notice danger stack" style={{ gap: 4 }}>
          <strong>Your organization is {org.status}</strong>
          {profile.data?.reviewNote && (
            <span className="small">Ohviana says: “{profile.data.reviewNote}”</span>
          )}
          <span className="small">
            Your records are read-only. Contact Ohviana support to resolve this.
          </span>
        </div>
      )}

      <Outcome error={summary.error} />
      {summary.loading && !summary.data && <Loading />}
      {summary.data && (
        <>
          <BookingChannels b={summary.data.bookings} />

          <section className="stack">
            <h2 style={{ margin: 0 }}>Batches</h2>
            <div className="batch-stats">
              {VIEWS.map(({ view, label, icon, tone }) => (
                <Link
                  key={view}
                  href={`/dashboard/batches?view=${view}`}
                  className={`batch-stat ${tone ?? ''}`}
                >
                  <Icon name={icon} size={16} />
                  <strong>
                    {summary.data!.batches[view as keyof typeof summary.data.batches]}
                  </strong>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** Gross and net up top, then bookings per channel: the total first (highlighted). */
function BookingChannels({ b }: { b: DashboardSummary['bookings'] }) {
  const { marketplace, directLink, addedByYou } = b.channels;
  const rows: {
    key: string;
    icon: IconName;
    label: string;
    hint: string;
    t: { confirmed: number; seatsSold: number; grossPaise: number; commissionPaise: number };
  }[] = [
    { key: 'total', icon: 'ticket', label: 'Total', hint: 'All confirmed bookings', t: b },
    {
      key: 'marketplace',
      icon: 'trendingUp',
      label: 'Ohviana marketplace',
      hint: 'Trekkers who found you on Ohviana',
      t: marketplace,
    },
    {
      key: 'direct',
      icon: 'link',
      label: 'Direct links',
      hint: 'Your booking links · 0% commission',
      t: directLink,
    },
    {
      key: 'added',
      icon: 'users',
      label: 'Added by you',
      hint: 'Phone, WhatsApp and walk-ins · 0% commission',
      t: addedByYou,
    },
  ];
  return (
    <section className="stack">
      <h2 style={{ margin: 0 }}>Bookings</h2>
      <div className="money-cards">
        <div className="card money-card">
          <span className="muted small">Gross booking value</span>
          <strong>{price(b.grossPaise)}</strong>
          <span className="muted small">
            {b.confirmed} booking{b.confirmed === 1 ? '' : 's'} · {b.seatsSold} trekker
            {b.seatsSold === 1 ? '' : 's'}
          </span>
        </div>
        <div className="card money-card net">
          <span className="small">Net earnings</span>
          <strong>{price(b.grossPaise - b.commissionPaise)}</strong>
          <span className="small">After {price(b.commissionPaise)} Ohviana commission</span>
        </div>
      </div>
      <div className="channels" role="table" aria-label="Bookings by channel">
        <div className="channel-row channel-head" role="row">
          <span role="columnheader">Channel</span>
          <span role="columnheader">Bookings</span>
          <span role="columnheader">Gross booking value</span>
          <span role="columnheader">Commission</span>
        </div>
        {rows.map(({ key, icon, label, hint, t }) => (
          <div key={key} className={`channel-row ${key}`} role="row">
            <span className="channel-name" role="rowheader">
              <span className="stat-icon">
                <Icon name={icon} size={18} />
              </span>
              <span className="stack" style={{ gap: 0 }}>
                <strong>{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </span>
            <span role="cell" data-label="Bookings">
              <strong>{t.confirmed}</strong>
              <span className="muted small">
                {' '}
                · {t.seatsSold} trekker{t.seatsSold === 1 ? '' : 's'}
              </span>
            </span>
            <span role="cell" data-label="Gross booking value">
              <strong>{price(t.grossPaise)}</strong>
            </span>
            <span role="cell" data-label="Commission">
              <strong>{price(t.commissionPaise)}</strong>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
