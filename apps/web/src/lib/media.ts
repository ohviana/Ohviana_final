import type { PhotoCategory } from '@ohviana/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

/** Photo URLs come from the API as paths; images are served by the API. */
export function mediaUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  destination: 'Destination',
  trail: 'Trail',
  transport: 'Transport',
  stay: 'Stay',
  food: 'Food',
  group: 'Group',
  other: 'Other',
};
