import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { removePhoneSignIns, removeWalkthroughData, sql } from './db';
import { enterPhoneCode, testPhone } from './phone';

/**
 * Full operator walkthrough through the real UI with email + password accounts:
 * organizer signs up and registers → admin approves → organizer adds a trek, adds its first date and
 * publishes it → repeats the batch a week later → shares the batch's link → a guest
 * books through it → organizer adds phone bookings to the batch and sees the totals.
 *
 * Needs NEXT_PUBLIC_AUTH_MODE=password and AUTH_JWT_SECRET on the API.
 */
const PASSWORD_AUTH = process.env.NEXT_PUBLIC_AUTH_MODE === 'password';
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
const tag = randomUUID().slice(0, 6);
const ORG_NAME = `E2E Trails ${tag}`;
const ORG_EMAIL = `e2e-org-${tag}@test.ohviana.dev`;
const ADMIN_EMAIL = `e2e-admin-${tag}@test.ohviana.dev`;
const PASSWORD = `Trek-${tag}-pass!`;
const GUEST_PHONE = testPhone();

test.skip(!PASSWORD_AUTH, 'Requires NEXT_PUBLIC_AUTH_MODE=password');
// The operator console is a desktop tool; the phone project covers customer journeys.
test.skip(({ isMobile }) => isMobile, 'Desktop only');
test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await removeWalkthroughData();
  // A throwaway admin: sign up through the API, then grant admin directly in the database.
  const res = await fetch(`${API}/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD, fullName: 'E2E Admin' }),
  });
  if (!res.ok) throw new Error(`admin signup failed: ${res.status} ${await res.text()}`);
  const { user } = (await res.json()) as { user: { id: string } };
  await sql`insert into platform_admins (user_id) values (${user.id}) on conflict do nothing`;
});
test.afterAll(async () => {
  await removeWalkthroughData();
  await removePhoneSignIns([GUEST_PHONE.e164]);
});

async function openAuth(page: Page, tab: 'Sign in' | 'Create account') {
  await page.goto('/login?next=/dashboard');
  await page
    .getByRole('group', { name: 'Sign in or create account' })
    .getByRole('button', { name: tab })
    .click();
}

async function signUp(page: Page, email: string, name: string) {
  await openAuth(page, 'Create account');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Path check: the sign-in URL itself contains ?next=/dashboard.
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'));
}

async function signIn(page: Page, email: string) {
  await openAuth(page, 'Sign in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Path check: the sign-in URL itself contains ?next=/dashboard.
  await page.waitForURL((url) => url.pathname.startsWith('/dashboard'));
}

async function signOut(page: Page) {
  await page.evaluate(() => localStorage.removeItem('ohviana:session'));
}

/** IST wall-clock string for a datetime-local input, `days` from now at `hh:mm`. */
function istLocal(days: number, hhmm: string): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}T${hhmm}`;
}

test('organizer + admin walkthrough, end to end', async ({ page }) => {
  test.setTimeout(240_000);
  page.on('dialog', (d) => void (d.type() === 'prompt' ? d.accept('7.5') : d.accept()));

  // 1. A new organizer creates an account and registers their organization.
  await signUp(page, ORG_EMAIL, 'Ravi Organizer');
  await expect(page.getByRole('heading', { name: 'List your treks on Ohviana' })).toBeVisible();
  await page.getByLabel('Organization name').fill(ORG_NAME);
  await page.getByLabel('City').fill('Bengaluru');
  await page.getByLabel('Email', { exact: true }).fill(ORG_EMAIL);
  await page.getByLabel('Mobile').fill('98450 12345');
  await page.getByRole('button', { name: 'Register organization' }).click();
  await expect(page.getByText('Awaiting approval from Ohviana')).toBeVisible();

  // 2. The admin approves it with 7.5% commission (the only approval step).
  await signOut(page);
  await signIn(page, ADMIN_EMAIL);
  await page.goto('/admin/organizers?status=pending');
  const row = page.getByRole('row').filter({ hasText: ORG_NAME });
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(`${ORG_NAME}: approve done.`)).toBeVisible();

  // 3. The organizer adds a trek in ONE form (details, photo, pickup, first batch) and publishes.
  await signOut(page);
  await signIn(page, ORG_EMAIL);
  await expect(page.getByText('Awaiting approval from Ohviana')).toHaveCount(0);
  await page.goto('/dashboard/treks');
  await page.getByRole('link', { name: 'New trek' }).click();
  await page.waitForURL(/\/dashboard\/treks\/new$/);
  // The trek name is the destination: the seed's Kudremukh is reused.
  await page.getByLabel('Trek name').fill('Kudremukh');
  await page.getByLabel('Duration').selectOption('2');
  await page.getByLabel('Difficulty').selectOption('moderate');
  await page.getByLabel('Start point').fill('Bengaluru');
  await page.getByLabel('Day 0 title').fill('Overnight bus from Bengaluru');
  await page.getByLabel('Day 1 title').fill('Summit and return');
  await page.getByLabel(/^Included/).fill('Transport\nBreakfast and lunch\nForest permit');
  await page.locator('#nt-policy').fill('Full refund up to 7 days before departure.');
  // Any real image will do: a screenshot saved as JPEG.
  const image = await page.screenshot({ type: 'jpeg', quality: 60 });
  await page
    .locator('#nt-photos')
    .setInputFiles({ name: 'bus.jpg', mimeType: 'image/jpeg', buffer: image });
  await page.getByRole('button', { name: 'Save trek' }).click();
  await page.waitForURL(/\/dashboard\/treks\/[0-9a-f-]+\?created=1/);
  await expect(page.getByText('Trek saved. Add its dates below')).toBeVisible();
  // View mode shows photos in the carousel (thumbnail slots appear only in Edit trek).
  await expect(page.locator('.photo-track img')).toHaveCount(1);

  // Dates are added on the trek page with pickups and a trek lead, and published right there.
  await page.getByRole('button', { name: '+ Add dates' }).click();
  await page.getByLabel('Departure', { exact: true }).fill(istLocal(10, '21:30'));
  await page.getByLabel('Return', { exact: true }).fill(istLocal(12, '06:00'));
  await page.getByLabel('Price per person (₹)').fill('2499');
  await page.getByLabel('Seats', { exact: true }).fill('12');
  await page.getByLabel('Pickup 1 name').fill('Majestic Bus Stand');
  await page.getByLabel('Pickup 1 time').fill(istLocal(10, '21:00'));
  await page.getByLabel('Trek lead 1 name').fill('Ravi Kumar');
  await page.getByLabel('Trek lead 1 mobile').fill('98450 12345');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published 1 date. Trekkers can book now.')).toBeVisible();

  // 4. The batch got a generated name; run it again a week later (published straight away).
  // Batch names capitalise each word of the organizer name, so the tag too.
  const nameTag = tag[0]!.toUpperCase() + tag.slice(1);
  const batchName = new RegExp(`E2E_Trails_${nameTag}_Kudremukh_\\d+(st|nd|rd|th)_\\w+_Batch_1`);
  await page.goto('/dashboard/batches?view=upcoming');
  const firstRow = page.getByRole('row').filter({ hasText: batchName });
  await expect(firstRow).toHaveCount(1);
  await firstRow.getByRole('link').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(batchName);
  const batchPage = page.url();
  await page.getByRole('button', { name: 'Run again' }).click();
  await page.getByRole('button', { name: 'Save & publish' }).click();
  await page.waitForURL((url) => url.href !== batchPage && url.pathname.includes('/batches/'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(batchName);
  await page.goto('/dashboard/batches?view=upcoming');
  await expect(page.getByRole('row').filter({ hasText: batchName })).toHaveCount(2);

  // 5. Every batch comes with its own booking link: nothing to create.
  await page.goto(batchPage);
  const shareUrl = await page.getByLabel('Booking link').inputValue();
  expect(shareUrl).toMatch(/\/b\/[A-Za-z0-9_-]{32}$/);

  // 6. A customer books through the link (signed out: the SMS code signs them in).
  await signOut(page);
  await page.goto(shareUrl);
  await expect(page.getByText(`You're booking directly with`)).toBeVisible();
  // Customers see the organizer's photos.
  await expect(page.locator('.gallery img').first()).toBeVisible();
  await page.getByRole('link', { name: 'Book seats' }).click();
  await page.getByLabel('Full name').fill('Ravi Kumar');
  await page.getByLabel('Mobile').first().fill(GUEST_PHONE.typed);
  await page.getByLabel('Traveller 1 name').fill('Ravi Kumar');
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await enterPhoneCode(page);
  await page.waitForURL(/\/bookings\/OHV-/);
  await expect(page.getByText("You're booked!")).toBeVisible();
  await expect(page.getByText('TREK PASS')).toBeVisible();
  // Customers get a plain marketplace header: no organizer Dashboard button.
  await expect(page.getByRole('banner').getByRole('link', { name: 'Dashboard' })).toHaveCount(0);

  // 7. The organizer sees the commission-free booking, adds two phone bookings to the same
  //    batch, and downloads attendees.
  await signIn(page, ORG_EMAIL);
  await page.goto(batchPage);
  // Travellers table: one row per traveller, like the CSV.
  const ravi = page.getByRole('row').filter({ hasText: 'Ravi Kumar' });
  await expect(ravi).toContainText('Your link');
  await expect(ravi).not.toContainText('commission');
  await page.getByRole('button', { name: 'Add members' }).click();
  await page.getByLabel('Contact name').fill('Asha Rao');
  await page.getByLabel('Mobile', { exact: true }).fill('98860 11223');
  await page.getByRole('button', { name: '+ Add another traveller' }).click();
  await page.getByLabel('Traveller 2 name').fill('Vikram S');
  await page.getByLabel('Traveller 2 mobile').fill('98860 44556');
  await page.getByRole('button', { name: 'Add 2 people' }).click();
  await expect(page.getByText('Added 2 people')).toBeVisible();
  const asha = page.getByRole('row').filter({ hasText: 'Asha Rao' });
  const vikram = page.getByRole('row').filter({ hasText: 'Vikram S' });
  await expect(asha.first()).toContainText('+919886011223');
  await expect(vikram).toContainText('+919886044556'); // his own number
  await expect(vikram).toContainText('Asha Rao'); // booked by
  await expect(vikram).toContainText('Added by you');
  await expect(page.getByText('2 confirmed · 3 seats')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download attendees (CSV)' }).click();
  expect((await download).suggestedFilename()).toMatch(/_Batch_1_attendees\.csv$/);

  // 8. Overview: ₹2,499 via the link and 2 × ₹2,499 added by the organizer, as separate rows.
  await page.goto('/dashboard');
  await expect(page.locator('.channel-row.direct')).toContainText('₹2,499');
  await expect(page.locator('.channel-row.added')).toContainText('₹4,998');
});
