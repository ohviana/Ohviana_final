/** Public URL customers open from WhatsApp/Instagram for a direct-link token. */
export function shareUrl(token: string): string {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${site.replace(/\/+$/, '')}/b/${token}`;
}
