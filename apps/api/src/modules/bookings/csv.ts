import type { OrganizerBooking } from '@ohviana/contracts';

/**
 * Spreadsheet-safe CSV cell: quoted, with formula-looking values neutralised so a guest named
 * "=HYPERLINK(...)" can't execute when a trek leader opens the file in Excel/Sheets.
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Byte-order mark so Excel opens UTF-8 (e.g. Kannada names) correctly. */
const UTF8_BOM = String.fromCharCode(0xfeff);

const ist = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** One row per traveller of each confirmed booking: the list a trek leader works from. */
export function attendeesCsv(bookings: OrganizerBooking[]): string {
  const header = [
    'Booking reference',
    'Traveller',
    'Traveller phone',
    'Age',
    'Gender',
    'Lead contact',
    'Lead phone',
    'Emergency contact',
    'Emergency phone',
    'Pickup',
    'Pickup time (IST)',
    'Source',
    'Booked at (IST)',
  ];
  const rows = bookings
    .filter((b) => b.status === 'confirmed')
    .flatMap((b) =>
      b.guests.map((g) => [
        b.bookingReference,
        g.fullName,
        g.phone,
        g.age,
        g.gender,
        b.contact.name,
        b.contact.phone,
        b.emergencyContact?.name,
        b.emergencyContact?.phone,
        b.pickup?.name,
        b.pickup ? ist(b.pickup.pickupAt) : '',
        b.source === 'ORGANIZER_DIRECT' ? 'Direct link' : 'Marketplace',
        ist(b.createdAt),
      ]),
    );
  // BOM so Excel opens UTF-8 names (e.g. Kannada) correctly; CRLF per RFC 4180.
  return UTF8_BOM + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
