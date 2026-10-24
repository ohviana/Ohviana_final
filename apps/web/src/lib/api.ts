import { notFound } from 'next/navigation';
import { ErrorResponse } from '@ohviana/contracts';
import type { z } from 'zod';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Minimal typed fetch wrapper. Every response is validated against its contract schema,
 * so contract drift between API and web fails loudly. Replaced by a generated SDK later.
 */
export async function apiFetch<T extends z.ZodType>(
  path: string,
  schema: T,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...init.headers },
  });
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(body);
    if (parsed.success) {
      const { code, message, requestId, details } = parsed.data.error;
      throw new ApiError(res.status, code, friendlyMessage(message, details), requestId);
    }
    throw new ApiError(res.status, 'INTERNAL_ERROR', `Request failed with ${res.status}`);
  }
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  // A response cached (`next.revalidate`) before the API changed shape, e.g. right after a
  // deploy: fetch it fresh once rather than failing until the cache expires.
  if (init.cache !== 'no-store') {
    const fresh: RequestInit & { next?: unknown } = { ...init, cache: 'no-store' };
    delete fresh.next;
    return apiFetch(path, schema, fresh);
  }
  throw parsed.error;
}

/** Prefer the first specific validation issue over the generic "Request validation failed". */
function friendlyMessage(message: string, details: unknown): string {
  const issues = (details as { issues?: { message?: unknown }[] } | undefined)?.issues;
  const first = Array.isArray(issues) ? issues[0]?.message : undefined;
  return typeof first === 'string' && first ? first : message;
}

/** Server components: API 404 renders the page's not-found UI instead of an error. */
export async function apiFetchOrNotFound<T extends z.ZodType>(
  path: string,
  schema: T,
  init: RequestInit = {},
): Promise<z.infer<T>> {
  try {
    return await apiFetch(path, schema, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

/** Query string from defined values only. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
