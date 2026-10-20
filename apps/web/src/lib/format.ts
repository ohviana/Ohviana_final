import { formatInr } from '@ohviana/shared';

/** All customer-facing times are shown in India time, whatever the viewer's device zone. */
export const IST = 'Asia/Kolkata';

export function price(paise: number): string {
  // Whole rupees read better on listings; paise only when present.
  return paise % 100 === 0
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(paise / 100)
    : formatInr(paise);
}

/** "Fri, 23 Oct, 9:30 pm" */
export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * "Fri, 23 Oct, 9:30 pm IST": for times people act on (departure, pickup) on the trek pass,
 * which gets screenshotted and shared, sometimes with people outside India.
 */
export function dateTimeIst(iso: string): string {
  return `${dateTime(iso)} IST`;
}

/** "Fri, 23 Oct 2026" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "23–25 Oct" or "30 Oct – 1 Nov" (IST). */
export function dateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, ...opts });
  const sameMonth =
    fmt(startIso, { month: 'short', year: 'numeric' }) ===
    fmt(endIso, { month: 'short', year: 'numeric' });
  return sameMonth
    ? `${fmt(startIso, { day: 'numeric' })}–${fmt(endIso, { day: 'numeric', month: 'short' })}`
    : `${fmt(startIso, { day: 'numeric', month: 'short' })} – ${fmt(endIso, { day: 'numeric', month: 'short' })}`;
}

/** Nights between departure and return, e.g. an overnight Friday trek returning Sunday. */
export function durationLabel(startIso: string, endIso: string): string {
  const days = Math.max(1, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 86_400_000));
  return days === 1 ? '1 day' : `${days} days`;
}

/** Today's date in IST as YYYY-MM-DD (for date input `min`). */
export function todayIst(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: IST });
}

export function seatsLabel(seatsLeft: number): string {
  if (seatsLeft === 0) return 'Sold out';
  if (seatsLeft <= 5) return `Only ${seatsLeft} left`;
  return `${seatsLeft} seats left`;
}
