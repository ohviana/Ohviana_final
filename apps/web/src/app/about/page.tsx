import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

// Placeholder until the real content is written: kept out of search results.
export const metadata: Metadata = { title: 'About Ohviana', robots: { index: false } };

export default function Page() {
  return (
    <ComingSoon
      title="About Ohviana"
      intro="Ohviana helps you discover treks and book them with verified local organizers."
    />
  );
}
