import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicBatch } from '@ohviana/contracts';
import { apiFetchOrNotFound } from '@/lib/api';
import { one, type SearchParams } from '@/lib/params';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

type Params = Promise<{ batchId: string }>;

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { batchId } = await params;
  const via = one((await searchParams).via);
  // Fresh seat counts at checkout; the API re-checks everything when booking anyway.
  const batch = await apiFetchOrNotFound(
    `/v1/batches/${encodeURIComponent(batchId)}`,
    PublicBatch,
    {
      cache: 'no-store',
    },
  );

  if (batch.availability !== 'available') {
    return (
      <div className="container narrow stack">
        <h1>
          {batch.availability === 'sold_out'
            ? 'This departure is sold out'
            : 'Bookings have closed'}
        </h1>
        <Link href={`/treks/${batch.catalogTrek.slug}`} className="btn">
          See other departures
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <CheckoutForm batch={batch} via={via} />
    </div>
  );
}
