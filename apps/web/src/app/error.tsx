'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container narrow stack">
      <h1>Something went wrong</h1>
      <p className="muted">Please try again. If it keeps happening, come back in a few minutes.</p>
      <button type="button" onClick={reset} style={{ alignSelf: 'flex-start' }}>
        Try again
      </button>
    </div>
  );
}
