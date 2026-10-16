import type { Metadata } from 'next';
import Link from 'next/link';
import { DirectLinkLanding } from '@ohviana/contracts';
import { BatchDetails } from '@/components/BatchDetails';
import { BatchList } from '@/components/BatchList';
import { ApiError, apiFetch } from '@/lib/api';

type Params = Promise<{ token: string }>;

export const metadata: Metadata = {
  title: 'Book your trek',
  robots: { index: false, follow: false },
};

/**
 * Landing page for organizer-shared links (WhatsApp, Instagram). The token rides along to
 * checkout as `?via=`, where the API decides attribution; it is never trusted client-side.
 */
export default async function DirectLinkPage({ params }: { params: Params }) {
  const { token } = await params;
  let landing: DirectLinkLanding | null = null;
  let invalid = false;
  try {
    landing = await apiFetch(`/v1/direct/${encodeURIComponent(token)}`, DirectLinkLanding, {
      cache: 'no-store',
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) invalid = true;
    else throw err;
  }

  if (invalid || !landing) {
    return (
      <div className="container narrow stack">
        <h1>This booking link is no longer valid</h1>
        <p className="muted">
          The organizer may have closed this link or the departure is no longer available.
        </p>
        <Link href="/search" className="btn">
          Browse treks
        </Link>
      </div>
    );
  }

  const o = landing.organizer;
  return (
    <div className="container stack-lg">
      <p className="notice ok small">
        You&apos;re booking directly with <strong>{o.name}</strong>.
      </p>
      {landing.batch ? (
        <BatchDetails batch={landing.batch} via={token} />
      ) : (
        <section className="stack">
          <h1>{o.name}</h1>
          {o.tagline && <p className="muted">{o.tagline}</p>}
          {landing.batches.length === 0 ? (
            <p className="muted">No departures are open for booking right now.</p>
          ) : (
            <BatchList batches={landing.batches} showOrganizer={false} showTrek via={token} />
          )}
        </section>
      )}
    </div>
  );
}
