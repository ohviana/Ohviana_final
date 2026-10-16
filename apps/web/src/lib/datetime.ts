/**
 * `<input type="datetime-local">` has no time zone. Organizers think in India time, so values
 * are always read and written as IST, independent of the browser's zone.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** "2026-10-23T21:30" (IST wall clock) → "2026-10-23T16:00:00.000Z" */
export function istLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "2026-10-23T16:00:00.000Z" → "2026-10-23T21:30" (IST wall clock) */
export function isoToIstLocal(iso: string): string {
  return new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** Rupees as typed ("2,499.50") → integer paise, or null. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);
}

/** Basis points ↔ percent for commission inputs (750 bps = 7.5%). */
export const bpsToPercent = (bps: number) => (bps / 100).toString();
export function percentToBps(input: string): number | null {
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
}

/** One item per non-empty line: how organizers enter inclusions, exclusions, etc. */
export const linesToList = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
