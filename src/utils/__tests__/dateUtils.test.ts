import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDateTime, formatRelative, formatTime, getStartOfDay, isToday } from '../dateUtils';

const NOW = new Date('2026-10-03T12:00:00');

describe('dateUtils', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it.each([formatDate, formatDateTime, formatTime, formatRelative])(
        '%o returns "" for missing or invalid input',
        fn => {
            expect(fn(undefined)).toBe('');
            expect(fn('')).toBe('');
            expect(fn('not a date')).toBe('');
        }
    );

    it('formats dates, date-times and times in the local format', () => {
        const d = new Date('2026-01-12T20:00:00');
        expect(formatDate(d)).toBe(d.toLocaleDateString());
        expect(formatDateTime(d.getTime())).toBe(d.toLocaleString());
        expect(formatTime(d.toISOString())).toBe(d.toLocaleTimeString());
    });

    it.each([
        [10 * 1000, 'Just now'],
        [60 * 1000, '1 min ago'],
        [5 * 60 * 1000, '5 mins ago'],
        [60 * 60 * 1000, '1 hour ago'],
        [3 * 60 * 60 * 1000, '3 hours ago'],
        [24 * 60 * 60 * 1000, 'Yesterday'],
        [3 * 24 * 60 * 60 * 1000, '3 days ago'],
    ])('formatRelative %ims ago → %s', (ago, expected) => {
        expect(formatRelative(NOW.getTime() - ago)).toBe(expected);
    });

    it('formatRelative falls back to the date after a week', () => {
        const old = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
        expect(formatRelative(old)).toBe(old.toLocaleDateString());
    });

    it('isToday compares calendar days', () => {
        expect(isToday(new Date('2026-10-03T00:01:00'))).toBe(true);
        expect(isToday(new Date('2026-10-02T23:59:00'))).toBe(false);
        expect(isToday(undefined)).toBe(false);
        expect(isToday('nope')).toBe(false);
    });

    it('getStartOfDay returns local midnight', () => {
        const start = getStartOfDay('2026-10-03T15:45:00');
        expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([
            0, 0, 0, 0,
        ]);
        expect(getStartOfDay().getDate()).toBe(3);
    });
});
