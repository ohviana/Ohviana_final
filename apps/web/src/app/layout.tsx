import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthNav } from '@/components/AuthNav';
import { Icon } from '@/components/Icon';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Self-hosted at build time by Next (no request to Google from visitors' browsers).
const font = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Ohviana — Book trekking departures', template: '%s · Ohviana' },
  description:
    'Compare dated trek departures from verified organizers in the Western Ghats and beyond, and book your seats.',
  openGraph: { siteName: 'Ohviana', type: 'website', locale: 'en_IN' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#073d27' },
    { media: '(prefers-color-scheme: dark)', color: '#04170f' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={font.variable}>
      <body>
        {process.env.NEXT_PUBLIC_AUTH_MODE === 'dev' && (
          <div className="dev-banner" role="note">
            Testing mode — sign-in without password
          </div>
        )}
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand" aria-label="Ohviana home">
              <span className="brand-mark">
                <Icon name="mountain" size={20} />
              </span>
              Ohviana
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/search">Explore treks</Link>
              <AuthNav />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="inner">
            <div className="stack" style={{ gap: 8 }}>
              <span className="brand">
                <span className="brand-mark">
                  <Icon name="mountain" size={20} />
                </span>
                Ohviana
              </span>
              <span>Compare and book trek departures from verified organizers.</span>
            </div>
            <div>
              <h4>Explore</h4>
              <Link href="/search">All treks</Link>
              <Link href="/search?difficulty=easy">Beginner friendly</Link>
              <Link href="/my-bookings">My bookings</Link>
            </div>
            <div>
              <h4>For organizers</h4>
              <Link href="/dashboard">List your treks</Link>
              <Link href="/login">Organizer sign in</Link>
            </div>
          </div>
          <div className="footer-bottom">
            © {new Date().getFullYear()} Ohviana · All times shown in India Standard Time (IST)
          </div>
        </footer>
      </body>
    </html>
  );
}
