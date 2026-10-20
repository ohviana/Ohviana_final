import type { Metadata } from 'next';
import { Icon, type IconName } from '@/components/Icon';
import { CONTACT_EMAIL, SOCIAL_HANDLE, SOCIAL_LINKS } from '@/lib/social';

export const metadata: Metadata = {
  title: 'Contact us',
  description: `Email ${CONTACT_EMAIL} or message @${SOCIAL_HANDLE} on Instagram or X.`,
};

const CHANNELS: { name: string; icon: IconName; value: string; href: string }[] = [
  { name: 'Email', icon: 'mail', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  ...SOCIAL_LINKS.map((s) => ({ ...s, value: `@${SOCIAL_HANDLE}` })),
];

export default function ContactPage() {
  return (
    <div className="container narrow stack-lg">
      <header className="stack" style={{ gap: 8 }}>
        <h1 style={{ margin: 0 }}>Contact us</h1>
        <p className="lead" style={{ margin: 0 }}>
          Questions about a booking, a trek or listing your treks? We&apos;re happy to help.
        </p>
      </header>
      <div className="contact-list">
        {CHANNELS.map((c) => (
          <a
            key={c.name}
            href={c.href}
            className="card contact-item"
            {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <span className="icon-circle">
              <Icon name={c.icon} size={20} />
            </span>
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <strong>{c.name}</strong>
              <span className="muted contact-value">{c.value}</span>
            </span>
          </a>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        About a booking? Include your booking reference (it starts with OHV-) so we can find it
        quickly.
      </p>
    </div>
  );
}
