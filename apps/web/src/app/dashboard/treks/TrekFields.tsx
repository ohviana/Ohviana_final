'use client';

import { useId } from 'react';
import type { Difficulty } from '@ohviana/shared';

export const DIFFICULTY_CHOICES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'difficult', label: 'Difficult' },
];

/** Common trip start cities, offered as suggestions (any place can be typed). */
const START_POINTS = [
  'Bengaluru',
  'Mangaluru',
  'Mysuru',
  'Chennai',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Kochi',
];

export const MAX_DURATION_DAYS = 15;

export function StartPointInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={`${id}-start`}>Start point</label>
      <input
        id={`${id}-start`}
        list={`${id}-list`}
        maxLength={80}
        disabled={disabled}
        placeholder="e.g. Bengaluru"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={`${id}-list`}>
        {START_POINTS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}

export type DayDraft = { title: string; details: string };
/** Drafts by day number; kept when the duration changes so nothing typed is lost. */
export type ItineraryDrafts = Record<number, DayDraft>;

export const draftsFrom = (days: { day: number; title: string; details?: string }[]) =>
  Object.fromEntries(days.map((d) => [d.day, { title: d.title, details: d.details ?? '' }]));

/**
 * Days 0..duration that have content. Day 0 is the night before (e.g. the overnight bus); a day
 * with only details gets "Day N" as its title.
 */
export function itineraryBody(drafts: ItineraryDrafts, durationDays: number | null) {
  if (!durationDays) return [];
  return Array.from({ length: durationDays + 1 }, (_, day) => {
    const d = drafts[day];
    const title = d?.title.trim() ?? '';
    const details = d?.details.trim() ?? '';
    if (!title && !details) return null;
    return { day, title: title || `Day ${day}`, ...(details ? { details } : {}) };
  }).filter((d) => d !== null);
}

/** One box per day: Day 0 (the night before) through the last day of the trek. */
export function ItineraryEditor({
  durationDays,
  drafts,
  onChange,
  disabled,
}: {
  durationDays: number | null;
  drafts: ItineraryDrafts;
  onChange: (next: ItineraryDrafts) => void;
  disabled?: boolean;
}) {
  if (!durationDays) {
    return (
      <p className="muted small" style={{ margin: 0 }}>
        Choose the duration above to plan each day.
      </p>
    );
  }
  const set = (day: number, k: keyof DayDraft, v: string) =>
    onChange({ ...drafts, [day]: { title: '', details: '', ...drafts[day], [k]: v } });

  return (
    <ol className="day-list">
      {Array.from({ length: durationDays + 1 }, (_, day) => (
        <li key={day} className="day-box">
          <div className="day-badge">
            <span>Day</span>
            <strong>{day}</strong>
          </div>
          <div className="stack" style={{ gap: 8, flex: 1, minWidth: 0 }}>
            <input
              aria-label={`Day ${day} title`}
              maxLength={200}
              disabled={disabled}
              placeholder={
                day === 0
                  ? 'Night before (optional), e.g. Overnight bus from Bengaluru'
                  : day === 1
                    ? 'e.g. Reach base village, trek to the campsite'
                    : 'e.g. Sunrise at the summit, descend'
              }
              value={drafts[day]?.title ?? ''}
              onChange={(e) => set(day, 'title', e.target.value)}
            />
            <textarea
              aria-label={`Day ${day} details`}
              rows={2}
              maxLength={2000}
              disabled={disabled}
              placeholder="Details: timings, distance, meals, stay (optional)"
              value={drafts[day]?.details ?? ''}
              onChange={(e) => set(day, 'details', e.target.value)}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
