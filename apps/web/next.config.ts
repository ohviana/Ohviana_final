import type { NextConfig } from 'next';

// Share the monorepo root .env with the web app (Next only reads apps/web/.env* by default).
try {
  process.loadEnvFile('../../.env');
} catch {
  // No root .env (e.g. CI/hosting): rely on the environment.
}

const PUBLIC_ENV_KEYS = [
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_AUTH_MODE',
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev only: keep compiled pages in memory for an hour instead of ~1 minute, so returning to a
  // tab doesn't trigger a recompile.
  onDemandEntries: { maxInactiveAge: 60 * 60 * 1000, pagesBufferLength: 50 },
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@ohviana/contracts', '@ohviana/shared'],
  // Inline browser-safe values explicitly, since they come from the root .env.
  env: Object.fromEntries(PUBLIC_ENV_KEYS.map((k) => [k, process.env[k] ?? ''])),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Origin only cross-site: direct-link tokens in ?via= never leak to e.g. map links.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
