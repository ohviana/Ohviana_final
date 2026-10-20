import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

// Placeholder until the real content is written: kept out of search results.
export const metadata: Metadata = { title: 'Organizer verification', robots: { index: false } };

export default function Page() {
  return (
    <ComingSoon
      title="Organizer verification"
      intro="How Ohviana checks trek organizers before they can list treks."
    />
  );
}
