import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

// Placeholder until the real content is written: kept out of search results.
export const metadata: Metadata = { title: 'Organizer terms', robots: { index: false } };

export default function Page() {
  return (
    <ComingSoon
      title="Organizer terms"
      intro="The terms for trek organizers listing and selling treks on Ohviana."
    />
  );
}
