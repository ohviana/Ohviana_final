'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

/** Two-column console layout with a section nav (stacks on phones). */
export function Shell({
  title,
  nav,
  aside,
  children,
}: {
  title: string;
  nav: NavItem[];
  aside?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    pathname === href || (href !== nav[0]?.href && pathname.startsWith(`${href}/`));
  return (
    <div className="container dash">
      <aside className="dash-nav">
        {aside ?? <strong className="eyebrow">{title}</strong>}
        <nav aria-label={title}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="dash-main stack-lg">{children}</section>
    </div>
  );
}

/** Success/error line under a form or action. */
export function Outcome({ error, message }: { error: string | null; message?: string | null }) {
  if (error)
    return (
      <p className="notice danger small" role="alert" style={{ margin: 0 }}>
        {error}
      </p>
    );
  if (message)
    return (
      <p className="notice ok small" role="status" style={{ margin: 0 }}>
        {message}
      </p>
    );
  return null;
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <p className="muted">{what}…</p>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'approved' ||
    status === 'published' ||
    status === 'upcoming' ||
    status === 'confirmed'
      ? 'ok'
      : status === 'pending' ||
          status === 'draft' ||
          status === 'booking_closed' ||
          status === 'sold_out'
        ? 'warn'
        : status === 'rejected' || status === 'suspended' || status === 'cancelled'
          ? 'danger'
          : '';
  return <span className={`badge ${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

/** Ask-for-a-reason prompt used by reject / suspend / cancel actions. */
export function askReason(label: string, minLength = 3): string | null {
  const reason = window.prompt(label)?.trim();
  if (!reason) return null;
  if (reason.length < minLength) {
    window.alert(`Please give a reason of at least ${minLength} characters.`);
    return null;
  }
  return reason;
}

/** Friendly "nothing here yet" block with an optional call to action. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="icon-circle">
        <Icon name={icon} size={26} />
      </span>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Rounded initials avatar for an organization or person. */
export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return <span className="avatar">{initials || '?'}</span>;
}
