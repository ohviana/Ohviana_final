import { describe, expect, it } from 'vitest';
import { escapeLike, slugify } from './text';

describe('slugify', () => {
  it.each([
    ['Kudremukh', 'kudremukh'],
    ['Kumara Parvatha (Pushpagiri)', 'kumara-parvatha-pushpagiri'],
    ['  Sahyadri & Ghats  Trek!! ', 'sahyadri-and-ghats-trek'],
    ['Café Peak', 'cafe-peak'],
    ['---', ''],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('never ends with a dash after truncation', () => {
    expect(slugify('aaaa bbbb', 5)).toBe('aaaa');
  });
});

describe('escapeLike', () => {
  it('escapes wildcard characters', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});
