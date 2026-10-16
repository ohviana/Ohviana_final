import type { Metadata } from 'next';
import { PublicBatch } from '@ohviana/contracts';
import { BatchDetails } from '@/components/BatchDetails';
import { apiFetchOrNotFound } from '@/lib/api';
import { longDate } from '@/lib/format';
import { one, type SearchParams } from '@/lib/params';

type Params = Promise<{ id: string }>;

const getBatch = (id: string) =>
  apiFetchOrNotFound(`/v1/batches/${encodeURIComponent(id)}`, PublicBatch, {
    next: { revalidate: 30 },
  });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const b = await getBatch((await params).id);
  return {
    title: `${b.trek.title} — ${longDate(b.departureAt)}`,
    // Departures come and go; the trek page is the canonical, indexable page.
    robots: { index: false, follow: true },
    alternates: { canonical: `/treks/${b.catalogTrek.slug}` },
  };
}

export default async function BatchPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const batch = await getBatch((await params).id);
  const via = one((await searchParams).via);
  return (
    <div className="container">
      <BatchDetails batch={batch} via={via} />
    </div>
  );
}
