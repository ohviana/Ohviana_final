import { describe, expect, it } from 'vitest';
import {
  isoToIstLocal,
  istLocalToIso,
  linesToList,
  paiseToRupees,
  percentToBps,
  rupeesToPaise,
} from './datetime';

describe('IST datetime-local conversion', () => {
  it('reads input as IST whatever the browser zone', () => {
    expect(istLocalToIso('2026-10-23T21:30')).toBe('2026-10-23T16:00:00.000Z');
    expect(istLocalToIso('2026-10-24T00:30')).toBe('2026-10-23T19:00:00.000Z');
  });

  it('round-trips', () => {
    expect(isoToIstLocal('2026-10-23T16:00:00.000Z')).toBe('2026-10-23T21:30');
    expect(isoToIstLocal(istLocalToIso('2026-12-31T23:45')!)).toBe('2026-12-31T23:45');
  });

  it('rejects malformed input', () => {
    expect(istLocalToIso('23/10/2026 9:30')).toBeNull();
  });
});

describe('money and percent inputs', () => {
  it.each([
    ['2499', 249_900],
    ['2,499.50', 249_950],
    ['₹ 1,000', 100_000],
    ['0', 0],
  ])('%s rupees -> %i paise', (input, paise) => {
    expect(rupeesToPaise(input)).toBe(paise);
  });

  it.each(['-5', 'abc', '1.234', ''])('rejects %s', (input) => {
    expect(rupeesToPaise(input)).toBeNull();
  });

  it('formats paise for editing', () => {
    expect(paiseToRupees(249_900)).toBe('2499');
    expect(paiseToRupees(249_950)).toBe('2499.50');
  });

  it('converts commission percent to basis points', () => {
    expect(percentToBps('7.5')).toBe(750);
    expect(percentToBps('101')).toBeNull();
  });

  it('splits lines', () => {
    expect(linesToList(' Meals \n\nTransport\r\n')).toEqual(['Meals', 'Transport']);
  });
});
