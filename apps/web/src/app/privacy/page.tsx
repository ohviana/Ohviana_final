import type { Metadata } from 'next';
import { ComingSoon } from '@/components/ComingSoon';

// Placeholder until the real content is written: kept out of search results.
export const metadata: Metadata = { title: 'Privacy policy', robots: { index: false } };

export default function Page() {
  return (
    <ComingSoon
      title="Privacy policy"
      intro="How Ohviana collects, uses and protects your personal information."
    />
  );
}
