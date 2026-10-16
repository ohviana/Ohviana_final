import { expect, test, type Page } from '@playwright/test';
import { bookingByReference, removeBookings, seedDirectLinkToken } from './db';

/** Requires seed data: `npm run db:seed` (Kudremukh, Ghats Trail Co., ...). */

const made: string[] = [];

test.afterEach(async () => {
  await removeBookings(made.splice(0));
});

async function fillCheckout(page: Page, opts: { phone?: string } = {}) {
  await expect(page.getByRole('heading', { name: /^Book / })).toBeVisible();
  await page.getByLabel('Full name').fill('Asha Rao');
  await page
    .getByLabel('Mobile')
    .first()
    .fill(opts.phone ?? '98765 43210');
  await page.getByLabel(/^Email/).fill('asha.e2e@example.com');
  await page.getByLabel('Traveller 1 name').fill('Asha Rao');
  const pickup = page.getByLabel('Pickup point');
  if (await pickup.count()) await pickup.selectOption({ index: 1 });
}

async function confirmAndGetReference(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await page.waitForURL(/\/bookings\/OHV-[A-Z0-9]{8}$/);
  const reference = page.url().split('/').pop()!;
  made.push(reference);
  return reference;
}

test('marketplace journey: search → compare → book → confirmation → cancel', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Where do you want to trek?').fill('kudremuk'); // typo on purpose
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForURL(/\/search\?query=kudremuk/);

  await page
    .getByRole('link', { name: /Kudremukh/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kudremukh' })).toBeVisible();

  await page.getByLabel('Sort by').selectOption('price_asc');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForURL(/sort=price_asc/);

  await page.getByRole('link', { name: 'Book', exact: true }).first().click();
  await fillCheckout(page);
  const reference = await confirmAndGetReference(page);

  await expect(page.getByText("You're booked!")).toBeVisible();
  await expect(page.getByText(reference)).toBeVisible();
  // Guest access token was removed from the address bar after use.
  expect(page.url()).not.toContain('#t=');

  const row = await bookingByReference(reference);
  expect(row).toMatchObject({
    status: 'confirmed',
    source: 'MARKETPLACE',
    contact_phone: '+919876543210',
  });

  // Reload: the booking is still viewable as a guest on this device.
  await page.reload();
  await expect(page.getByText(reference)).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  expect((await bookingByReference(reference))?.status).toBe('cancelled');
});

test('direct link journey books commission-free with the organizer', async ({ page }) => {
  await page.goto(`/b/${seedDirectLinkToken('ghats-trail-co')}`);
  await expect(page.getByText(/booking directly with/i)).toBeVisible();

  await page.getByRole('link', { name: 'Book', exact: true }).first().click();
  await expect(page).toHaveURL(/\/book\/[0-9a-f-]+\?via=/);
  await fillCheckout(page);
  const reference = await confirmAndGetReference(page);

  await expect(page.getByText("You're booked!")).toBeVisible();
  expect(await bookingByReference(reference)).toMatchObject({
    source: 'ORGANIZER_DIRECT',
    commission_paise: 0,
  });
});

test('checkout explains invalid input instead of submitting', async ({ page }) => {
  await page.goto('/treks/kudremukh');
  await page.getByRole('link', { name: 'Book', exact: true }).first().click();
  await fillCheckout(page, { phone: '12345' });
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  // (Next.js also renders a route announcer with role=alert, so match the message itself.)
  await expect(page.getByText(/Enter a valid mobile number/)).toBeVisible();
  await expect(page).toHaveURL(/\/book\//);
});

test('a dead direct link explains itself', async ({ page }) => {
  await page.goto('/b/thisisnotarealtokenthisisnotreal');
  await expect(
    page.getByRole('heading', { name: 'This booking link is no longer valid' }),
  ).toBeVisible();
});

test('trek pages are indexable; checkout is not', async ({ page }) => {
  await page.goto('/treks/kudremukh');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/treks\/kudremukh$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Book', exact: true }).first().click();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
