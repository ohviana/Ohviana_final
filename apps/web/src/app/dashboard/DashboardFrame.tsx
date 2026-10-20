'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { MeResponse } from '@ohviana/contracts';
import { useLoad } from '@/components/dash/hooks';
import { OrgProvider } from '@/components/dash/org-context';
import { Avatar, Loading, Shell, StatusBadge, type NavItem } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { authedFetch } from '@/lib/authed';
import { RegisterOrganizer } from './RegisterOrganizer';

const ACTIVE_ORG_KEY = 'ohviana:active-organizer';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: 'grid' },
  { href: '/dashboard/batches', label: 'Batches', icon: 'calendar' },
  { href: '/dashboard/treks', label: 'Treks', icon: 'mountain' },
  { href: '/dashboard/team', label: 'Team', icon: 'users' },
  { href: '/dashboard/profile', label: 'Profile', icon: 'building' },
];

function storedOrg(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

export function DashboardFrame({ children }: { children: ReactNode }) {
  const me = useLoad(() => authedFetch('/v1/me', MeResponse), []);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => setActiveId(storedOrg()), []);

  function choose(id: string) {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_ORG_KEY, id);
    } catch {
      // ignore
    }
  }

  if (me.loading && !me.data)
    return (
      <div className="container">
        <Loading />
      </div>
    );
  if (!me.data) return <OrganizerLanding />;

  const memberships = me.data.memberships;
  if (memberships.length === 0) {
    return (
      <div className="container narrow">
        <RegisterOrganizer
          onRegistered={async (id) => {
            choose(id);
            await me.reload();
          }}
        />
      </div>
    );
  }

  const org = memberships.find((m) => m.organizerId === activeId) ?? memberships[0]!;
  const switcher = (
    <div className="dash-org">
      <Avatar name={org.name} />
      <div className="stack" style={{ gap: 4, minWidth: 0, flex: 1 }}>
        {memberships.length > 1 ? (
          <select
            aria-label="Organizer"
            value={org.organizerId}
            onChange={(e) => choose(e.target.value)}
            style={{ minHeight: 36, padding: '4px 8px' }}
          >
            {memberships.map((m) => (
              <option key={m.organizerId} value={m.organizerId}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {org.name}
          </strong>
        )}
        <span className="cluster small" style={{ gap: 6 }}>
          <StatusBadge status={org.status} />{' '}
          <span className="muted" style={{ textTransform: 'capitalize' }}>
            {org.role}
          </span>
        </span>
      </div>
    </div>
  );

  return (
    <OrgProvider key={org.organizerId} me={me.data} org={org} reloadMe={me.reload}>
      <Shell title="Organizer" nav={NAV} aside={switcher}>
        {children}
      </Shell>
    </OrgProvider>
  );
}

/** What signed-out visitors see at /dashboard: why join, and how. */
function OrganizerLanding() {
  return (
    <div className="container stack-lg">
      <section className="cta-band" style={{ padding: 36 }}>
        <div className="stack" style={{ gap: 10, maxWidth: 620 }}>
          <span className="badge glass" style={{ alignSelf: 'flex-start' }}>
            For trek organizers
          </span>
          <h1 style={{ color: '#fff', margin: 0 }}>Grow your trek business with Ohviana</h1>
          <p>
            List your treks, publish batches, and get bookings from new trekkers — plus your own
            commission-free booking links for WhatsApp and Instagram.
          </p>
          <div className="cluster" style={{ marginTop: 8 }}>
            <Link href="/login?mode=signup&next=/dashboard" className="btn sun">
              Create organizer account <Icon name="arrowRight" size={16} />
            </Link>
            <Link href="/login?next=/dashboard" className="btn secondary">
              Sign in
            </Link>
          </div>
        </div>
      </section>
      <div className="grid-cards">
        {[
          {
            icon: 'calendar' as const,
            title: 'Weekly batches in one go',
            text: 'Create a whole season of batches at once, or repeat one in a click.',
          },
          {
            icon: 'link' as const,
            title: '0% on your own customers',
            text: 'Every batch gets its own booking link — those bookings carry no commission.',
          },
          {
            icon: 'download' as const,
            title: 'Attendee lists, ready',
            text: 'Download who is coming, pickups and emergency contacts for your trek leaders.',
          },
        ].map((f) => (
          <div key={f.title} className="card feature">
            <span className="icon-circle">
              <Icon name={f.icon} size={22} />
            </span>
            <div>
              <h3>{f.title}</h3>
              <p className="muted small" style={{ margin: 0 }}>
                {f.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
