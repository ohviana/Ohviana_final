import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

// Placeholder until the real content is written: kept out of search results.
export const metadata: Metadata = { title: 'Terms of service', robots: { index: false } };

export default function Page() {
  return (
    <ComingSoon
      title="Terms of service"
      intro="The terms for using Ohviana and booking treks through it."
    />
  );
}
