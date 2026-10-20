import { redirect } from 'next/navigation';

/** Booking links live on each batch now (one per batch, created with it). */
export default function LinksPage() {
  redirect('/dashboard/batches');
}
