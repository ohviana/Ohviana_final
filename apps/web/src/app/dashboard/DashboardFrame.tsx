'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { MeResponse } from '@ohviana/contracts';
import { roleHasPermission, type OrgPermission } from '@ohviana/shared';
import { useLoad } from '@/components/dash/hooks';
import { OrgProvider } from '@/components/dash/org-context';
import { Avatar, Loading, Shell, StatusBadge, type NavItem } from '@/components/dash/ui';
import { Icon } from '@/components/Icon';
import { authedFetch } from '@/lib/authed';
import { logoSrc } from '@/lib/media';
import { ROLE_LABELS } from '@/lib/roles';
import { RegisterOrganizer } from './RegisterOrganizer';

const ACTIVE_ORG_KEY = 'ohviana:active-organizer';

/** Each section shows only to roles that can use it (trek leads see just Batches). */
const NAV: (NavItem & { needs: OrgPermission })[] = [
  { href: '/dashboard', label: 'Overview', icon: 'grid', needs: 'org:read' },
  { href: '/dashboard/batches', label: 'Batches', icon: 'calendar', needs: 'batches:read' },
  { href: '/dashboard/treks', label: 'Treks', icon: 'mountain', needs: 'org:read' },
  { href: '/dashboard/team', label: 'Team', icon: 'users', needs: 'org:manage_members' },
  { href: '/dashboard/profile', label: 'Profile', icon: 'building', needs: 'org:read' },
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
  const pathname = usePathname();
  const router = useRouter();
  const active =
    me.data?.memberships.find((m) => m.organizerId === activeId) ?? me.data?.memberships[0];
  const nav = active ? NAV.filter((n) => roleHasPermission(active.role, n.needs)) : NAV;
  // Trek leads have no overview (it shows the organizer's money): send them to their batches.
  const lost =
    !!active && !nav.some((n) => n.href === pathname || pathname.startsWith(`${n.href}/`));
  useEffect(() => {
    if (lost && nav[0]) router.replace(nav[0].href);
  }, [lost, nav, router]);

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
      {org.logoUrl ? (
        <img src={logoSrc(org.logoUrl)} alt="" className="org-logo" />
      ) : (
        <Avatar name={org.name} />
      )}
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
          <StatusBadge status={org.status} /> <span className="muted">{ROLE_LABELS[org.role]}</span>
        </span>
      </div>
    </div>
  );

  return (
    <OrgProvider key={org.organizerId} me={me.data} org={org} reloadMe={me.reload}>
      <Shell title="Organizer" nav={nav} aside={switcher}>
        {/* Don't render (or load) a section this role can't use while redirecting. */}
        {lost ? <Loading /> : children}
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
