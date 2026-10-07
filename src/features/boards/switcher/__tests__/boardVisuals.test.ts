import { describe, expect, it } from 'vitest';
import { boardColor, boardColorVars, boardInitials, plural, readableTextColor, stableVariation } from '../boardVisuals';

describe('boardVisuals', () => {
    it('falls back to blue for boards without a colour', () => {
        expect(boardColor({})).toBe('#3b82f6');
        expect(boardColor({ color: '#ef4444' })).toBe('#ef4444');
    });

    it('picks white text on dark colours and dark text on light ones', () => {
        expect(readableTextColor('#3b82f6')).toBe('#ffffff');
        expect(readableTextColor('#64748b')).toBe('#ffffff');
        expect(readableTextColor('#f59e0b')).toBe('#111827');
        expect(readableTextColor('#14b8a6')).toBe('#111827');
        expect(readableTextColor('#ffffff')).toBe('#111827');
        expect(readableTextColor('#000000')).toBe('#ffffff');
        expect(readableTextColor('teal')).toBe('#ffffff');
    });

    it('makes up to two initials', () => {
        expect(boardInitials('Side project')).toBe('SP');
        expect(boardInitials('Work')).toBe('W');
        expect(boardInitials('  home  sweet home ')).toBe('HS');
        expect(boardInitials('   ')).toBe('?');
    });

    it('gives a stable variation within the range', () => {
        expect(stableVariation('board_1', 23)).toBe(stableVariation('board_1', 23));
        for (const id of ['a', 'board_2', 'xyz', '']) {
            const value = stableVariation(id, 23);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(23);
        }
    });

    it('builds colour variables and plurals', () => {
        expect(boardColorVars({ color: '#f59e0b' }, { '--book-height': '80%' })).toEqual({
            '--board-color': '#f59e0b',
            '--board-text': '#111827',
            '--book-height': '80%',
        });
        expect(plural(1, 'tab', 'tabs')).toBe('1 tab');
        expect(plural(0, 'tab', 'tabs')).toBe('0 tabs');
    });
});
