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
            <Link href="/dashboard/treks" className="btn secondary">
              <Icon name="mountain" size={16} /> Add a trek
            </Link>
            <Link href="/dashboard/batches?view=draft" className="btn">
              <Icon name="calendar" size={16} /> Manage departures
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
              Set up your treks and draft departures now — you can publish them and share booking
              links as soon as you&apos;re approved.
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
          <section className="stack">
            <h2 style={{ margin: 0 }}>Bookings</h2>
            <div className="stat-grid">
              <div className="card stat">
                <span className="stat-icon">
                  <Icon name="ticket" />
                </span>
                <strong>{summary.data.bookings.confirmed}</strong>
                <span className="muted small">Confirmed bookings</span>
              </div>
              <div className="card stat">
                <span className="stat-icon">
                  <Icon name="users" />
                </span>
                <strong>{summary.data.bookings.seatsSold}</strong>
                <span className="muted small">Trekkers booked</span>
              </div>
              <div className="card stat">
                <span className="stat-icon sun">
                  <Icon name="rupee" />
                </span>
                <strong>{price(summary.data.bookings.grossPaise)}</strong>
                <span className="muted small">Gross bookings</span>
              </div>
              <div className="card stat">
                <span className="stat-icon">
                  <Icon name="link" />
                </span>
                <strong>{price(summary.data.bookings.directGrossPaise)}</strong>
                <span className="muted small">Via your direct links (0% commission)</span>
              </div>
              <div className="card stat">
                <span className="stat-icon">
                  <Icon name="trendingUp" />
                </span>
                <strong>{price(summary.data.bookings.marketplaceGrossPaise)}</strong>
                <span className="muted small">Via Ohviana marketplace</span>
              </div>
              <div className="card stat">
                <span className="stat-icon sun">
                  <Icon name="building" />
                </span>
                <strong>{price(summary.data.bookings.commissionPaise)}</strong>
                <span className="muted small">Marketplace commission</span>
              </div>
            </div>
          </section>

          <section className="stack">
            <h2 style={{ margin: 0 }}>Departures</h2>
            <div className="stat-grid">
              {VIEWS.map(({ view, label, icon, tone }) => (
                <Link key={view} href={`/dashboard/batches?view=${view}`} className="card stat">
                  <span className={`stat-icon ${tone ?? ''}`}>
                    <Icon name={icon} />
                  </span>
                  <strong>
                    {summary.data!.batches[view as keyof typeof summary.data.batches]}
                  </strong>
                  <span className="muted small">{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
