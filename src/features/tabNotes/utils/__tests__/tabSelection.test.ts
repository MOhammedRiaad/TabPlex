import { describe, expect, it } from 'vitest';
import { ReadableTab } from '../../types';
import { MAX_TABS_PER_RUN, canSelect, initialSelection, keepSelection, originsOf, pickedTabs } from '../tabSelection';

const tab = (id: number, overrides: Partial<ReadableTab> = {}): ReadableTab => ({
    id,
    windowId: 1,
    title: `Tab ${id}`,
    url: `https://site${id}.test/`,
    originPattern: `https://site${id}.test/*`,
    readable: true,
    ...overrides,
});

const many = (count: number) => Array.from({ length: count }, (_, i) => tab(i + 1));

describe('initialSelection', () => {
    it('checks every readable tab when there are up to 10', () => {
        expect([...initialSelection(many(10))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('checks nothing above 10 readable tabs', () => {
        expect(initialSelection(many(11)).size).toBe(0);
    });

    it('never checks a duplicate, and does not count unreadable tabs as pre-checkable', () => {
        const tabs = [tab(1), tab(2, { duplicateOf: 1 }), tab(3, { readable: false, reason: 'pdf' })];
        expect([...initialSelection(tabs)]).toEqual([1]);
    });
});

describe('keepSelection', () => {
    it('keeps only selected tabs that are still listed and readable', () => {
        const tabs = [tab(1), tab(2, { readable: false, reason: 'loading' }), tab(3)];
        expect([...keepSelection(new Set([1, 2, 4]), tabs)]).toEqual([1]);
    });
});

describe('canSelect', () => {
    it('never allows an unreadable tab, and stops new picks at the cap', () => {
        expect(canSelect(tab(1, { readable: false, reason: 'pdf' }), new Set())).toBe(false);
        expect(canSelect(tab(99), new Set())).toBe(true);

        const full = new Set(Array.from({ length: MAX_TABS_PER_RUN }, (_, i) => i + 1));
        expect(canSelect(tab(99), full)).toBe(false);
        // A tab already in the selection stays tickable so it can be unticked
        expect(canSelect(tab(1), full)).toBe(true);
    });
});

describe('pickedTabs and originsOf', () => {
    it('returns the picked readable tabs in list order, with their distinct origins', () => {
        const tabs = [tab(1), tab(2, { originPattern: 'https://site1.test/*' }), tab(3), tab(4)];
        const picked = pickedTabs(tabs, new Set([3, 1, 2]));
        expect(picked.map(t => t.id)).toEqual([1, 2, 3]);
        expect(originsOf(picked)).toEqual(['https://site1.test/*', 'https://site3.test/*']);
    });
});
