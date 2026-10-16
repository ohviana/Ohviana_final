'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/lib/authed';

/** Loads data on mount and whenever `deps` change; `reload()` refetches after a mutation. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader.current());
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, deps);

  return { data, error, loading, reload, setData };
}

/**
 * Wraps a mutation: tracks pending state and the last error/success message, so every form and
 * button reports the outcome the same way.
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    async <R>(fn: () => Promise<R>, success?: string): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      setMessage(null);
      try {
        const result = await fn();
        if (success) setMessage(success);
        return result;
      } catch (err) {
        setError(errorText(err));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { pending, error, message, run, setError };
}
