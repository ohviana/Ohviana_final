import { randomInt } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/**
 * Checkout signs customers in with an SMS code. The API must run with OTP_DEV_CODE set (e.g.
 * 123456 in .env), so every code is known here; no SMS is sent.
 */
const CODE = process.env.OTP_DEV_CODE;

/** A fresh mobile per test ("6xxxx xxxxx" as typed, and its E.164 form), so per-number code limits never trip. */
export function testPhone(): { typed: string; e164: string } {
  const digits = `6${String(randomInt(0, 1e9)).padStart(9, '0')}`;
  return { typed: `${digits.slice(0, 5)} ${digits.slice(5)}`, e164: `+91${digits}` };
}

/** After "Confirm booking": enter the texted code and finish booking. */
export async function enterPhoneCode(page: Page): Promise<void> {
  if (!CODE) throw new Error('Set OTP_DEV_CODE (e.g. 123456) in .env and restart the API');
  await expect(page.getByLabel('Verification code')).toBeVisible();
  await page.getByLabel('Verification code').fill(CODE);
  await page.getByRole('button', { name: 'Verify & book' }).click();
}
