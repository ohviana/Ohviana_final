import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Index canonical trek and organizer pages; keep checkout and personal pages out (PRD: SEO). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/book/', '/bookings/', '/b/', '/my-bookings', '/account', '/login', '/search'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
