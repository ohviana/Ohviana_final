import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile('../.env');
} catch {
  // CI: environment provided by the job.
}

const CI = !!process.env.CI;
const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Browser tests of the customer journeys against a running API + web app and a seeded
 * database (`npm run db:seed`). Locally they reuse already-running dev servers.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // India time zone and locale, like our customers; also proves the UI never relies on the
    // device zone.
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    // E2E_SLOWMO=600 slows actions down so a human can watch (use with --headed).
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO ?? 0) },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // TDD critical test: "mobile-sized responsive checkout".
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: CI ? 'npm run start -w @ohviana/api' : 'npm run dev:api',
      cwd: '..',
      url: 'http://localhost:4000/v1/health',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: CI ? 'npm run start -w @ohviana/web' : 'npm run dev:web',
      cwd: '..',
      url: WEB_URL,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
