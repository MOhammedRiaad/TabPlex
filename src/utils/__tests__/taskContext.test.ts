import { describe, expect, it } from 'vitest';
import {
    appendContextEvent,
    dedupeTabsByUrl,
    emptyContext,
    getContext,
    groupColorForPriority,
    groupTitleForTask,
    isCapturableUrl,
    isContextActive,
    isContextParked,
    MAX_CONTEXT_EVENTS,
    sameTabs,
} from '../taskContext';
import { makeContext, makeTask } from '../../test/factories';

describe('taskContext helpers', () => {
    it('defaults to an empty idle context', () => {
        expect(emptyContext()).toEqual({ tabs: [], state: 'idle' });
        expect(getContext(makeTask())).toEqual({ tabs: [], state: 'idle' });
        const ctx = makeContext();
        expect(getContext(makeTask({ context: ctx }))).toBe(ctx);
    });

    it('reports active and parked state', () => {
        expect(isContextActive(makeTask({ context: makeContext({ state: 'active' }) }))).toBe(true);
        expect(isContextParked(makeTask({ context: makeContext({ state: 'parked' }) }))).toBe(true);
        expect(isContextActive(makeTask())).toBe(false);
        expect(isContextParked(makeTask())).toBe(false);
    });

    it.each([
        ['https://a.dev/x', true],
        ['http://a.dev', true],
        ['file:///tmp/a.pdf', true],
        ['ftp://host/f', true],
        ['chrome://newtab/', false],
        ['about:blank', false],
        ['chrome-extension://ext/index.html', false],
        ['', false],
        [undefined, false],
    ])('isCapturableUrl(%s) → %s', (url, expected) => {
        expect(isCapturableUrl(url, 'chrome-extension://ext/')).toBe(expected);
    });

    it('excludes the extension itself only when a base url is given', () => {
        expect(isCapturableUrl('https://ext.dev/a', 'https://ext.dev/')).toBe(false);
        expect(isCapturableUrl('https://ext.dev/a')).toBe(true);
    });

    it('dedupes tabs by url, keeping the first', () => {
        const tabs = [
            { url: 'https://a', title: '1' },
            { url: 'https://b', title: '2' },
            { url: 'https://a', title: '3' },
        ];
        expect(dedupeTabsByUrl(tabs).map(t => t.title)).toEqual(['1', '2']);
    });

    it('compares tab lists by url and title, in order', () => {
        const a = [{ url: 'u1', title: 't1' }];
        expect(sameTabs(a, [{ url: 'u1', title: 't1', favicon: 'x' }])).toBe(true);
        expect(sameTabs(a, [{ url: 'u1', title: 'other' }])).toBe(false);
        expect(sameTabs(a, [])).toBe(false);
    });

    it('titles groups from the task, truncating long titles', () => {
        expect(groupTitleForTask({ title: '  Short  ' })).toBe('Short');
        expect(groupTitleForTask({ title: '' })).toBe('Task');
        const long = groupTitleForTask({ title: 'x'.repeat(40) });
        expect(long).toHaveLength(30);
        expect(long.endsWith('…')).toBe(true);
    });

    it('colours groups by priority', () => {
        expect(groupColorForPriority('high')).toBe('red');
        expect(groupColorForPriority('medium')).toBe('yellow');
        expect(groupColorForPriority('low')).toBe('blue');
    });

    it('appends events and caps the log', () => {
        const event = { type: 'park' as const, at: 'now', tabCount: 1 };
        expect(appendContextEvent(emptyContext(), event)).toEqual([event]);
        const full = {
            ...emptyContext(),
            events: Array.from({ length: MAX_CONTEXT_EVENTS }, (_, i) => ({ ...event, tabCount: i })),
        };
        const next = appendContextEvent(full, { ...event, tabCount: 999 });
        expect(next).toHaveLength(MAX_CONTEXT_EVENTS);
        expect(next[0].tabCount).toBe(1);
        expect(next.slice(-1)[0]?.tabCount).toBe(999);
    });
});
