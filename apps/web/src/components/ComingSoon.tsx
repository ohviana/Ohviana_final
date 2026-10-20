import Link from 'next/link';
import { CONTACT_EMAIL, SOCIAL_HANDLE, SOCIAL_LINKS } from '@/lib/social';

/** Placeholder for footer pages whose content isn't written yet. */
export function ComingSoon({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="container narrow stack">
      <h1>{title}</h1>
      <p>{intro}</p>
      <p className="muted">
        We&apos;re still writing this page. Until then, email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or message @{SOCIAL_HANDLE} on{' '}
        {SOCIAL_LINKS.map((s, i) => (
          <span key={s.name}>
            {i > 0 && ' or '}
            <a href={s.href} target="_blank" rel="noopener noreferrer">
              {s.name}
            </a>
          </span>
        ))}
        .
      </p>
      <Link href="/" className="btn secondary" style={{ alignSelf: 'flex-start' }}>
        Back to home
      </Link>
    </div>
  );
}
