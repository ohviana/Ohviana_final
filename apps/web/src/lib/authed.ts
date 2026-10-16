'use client';

import type { z } from 'zod';
import { ApiError, apiFetch } from './api';
import { authHeader } from './session';

export interface AuthedOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Active organizer for /v1/organizer/* calls. */
  organizerId?: string | null;
}

/** Calls the API as the signed-in user. Throws ApiError(401) when signed out. */
export async function authedFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  opts: AuthedOptions = {},
): Promise<z.infer<T>> {
  const auth = await authHeader();
  if (Object.keys(auth).length === 0) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again');
  }
  return apiFetch(path, schema, {
    method: opts.method ?? 'GET',
    cache: 'no-store',
    headers: {
      ...auth,
      ...(opts.organizerId ? { 'x-organizer-id': opts.organizerId } : {}),
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

/** Authenticated file download (e.g. attendee CSV): fetches with headers, saves as a file. */
export async function authedDownload(path: string, organizerId: string): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
  const res = await fetch(`${base}${path}`, {
    headers: { ...(await authHeader()), 'x-organizer-id': organizerId },
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Download failed');
  const name =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}
