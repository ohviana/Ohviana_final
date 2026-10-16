import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container narrow stack">
      <h1>We couldn&apos;t find that</h1>
      <p className="muted">The page may have moved, or the departure is no longer listed.</p>
      <Link href="/search" className="btn">
        Browse treks
      </Link>
    </div>
  );
}
