'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isSignedIn, onAuthChange, signedInEmail, signOut } from '@/lib/session';
import { ThemeToggle } from './ThemeToggle';

const isConsole = (path: string) => /^\/(dashboard|admin)(\/|$)/.test(path);

/**
 * Header links. Customers (and signed-out visitors anywhere) get the marketplace links; a signed-in
 * organizer or admin inside their console gets who they are and sign out instead.
 */
export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [operator, setOperator] = useState<{ email: string | null } | null>(null);

  useEffect(() => {
    const refresh = async () =>
      setOperator((await isSignedIn()) ? { email: signedInEmail() } : null);
    void refresh();
    return onAuthChange(() => void refresh());
  }, []);

  if (isConsole(pathname) && operator) {
    return (
      <nav className="nav" aria-label="Account">
        {operator.email && <span className="nav-who">{operator.email}</span>}
        <button
          type="button"
          className="link nav-signout"
          onClick={() => void signOut().then(() => router.push('/'))}
        >
          Sign out
        </button>
        <ThemeToggle />
      </nav>
    );
  }

  return (
    <nav className="nav" aria-label="Main">
      <Link href="/search">
        Explore<span className="nav-long"> treks</span>
      </Link>
      {/* Signed out, it offers phone sign-in; signed in, it is the customer's account. */}
      <Link href="/my-bookings">My bookings</Link>
      {/* Signed out: the organizer pitch with sign-up/sign-in; signed in: the dashboard. */}
      <Link href="/dashboard" className="nav-quiet">
        For organizers
      </Link>
      <ThemeToggle />
    </nav>
  );
}
