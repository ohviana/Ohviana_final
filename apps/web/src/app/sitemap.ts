import type { MetadataRoute } from 'next';
import { PublicOrganizerList, PublicTrekList } from '@ohviana/contracts';
import { apiFetch, qs } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const MAX_PAGES = 50;

export const revalidate = 3600;

async function collect<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
) {
  const all: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchPage(cursor);
    all.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [treks, organizers] = await Promise.all([
    collect((cursor) => apiFetch(`/v1/treks${qs({ cursor, limit: 100 })}`, PublicTrekList)).catch(
      () => [],
    ),
    collect((cursor) =>
      apiFetch(`/v1/organizers${qs({ cursor, limit: 100 })}`, PublicOrganizerList),
    ).catch(() => []),
  ]);
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    ...treks.map((t) => ({
      url: `${SITE_URL}/treks/${t.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...organizers.map((o) => ({
      url: `${SITE_URL}/organizers/${o.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
