import { expect, it } from 'vitest';
import { formatLocalTimestamp } from './date-time';

it('formats the local date with fixed separators, padding and seconds', () => {
  expect(formatLocalTimestamp(new Date(2026, 10, 10, 23, 27, 46).toISOString())).toBe('2026-11-10 23:27:46');
  expect(formatLocalTimestamp(new Date(2026, 0, 2, 0, 3, 4).toISOString())).toBe('2026-01-02 00:03:04');
  expect(formatLocalTimestamp('invalid')).toBeUndefined();
  expect(formatLocalTimestamp()).toBeUndefined();
});
