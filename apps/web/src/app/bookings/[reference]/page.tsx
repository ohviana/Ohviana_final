import type { Metadata } from 'next';
import { BookingConfirmation } from './BookingConfirmation';

export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false, follow: false },
};

export default async function BookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return (
    <div className="container narrow">
      <BookingConfirmation reference={reference} />
    </div>
  );
}
