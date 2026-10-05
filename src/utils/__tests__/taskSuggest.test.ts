import { describe, expect, it } from 'vitest';
import { DISMISS_FOR_MS, dismissKey, pruneDismissed, suggestTaskForUrl } from '../taskSuggest';
import { makeContext, makeTask } from '../../test/factories';
import { ContextTab, Task } from '../../types';

const NOW = Date.parse('2026-10-05T12:00:00Z');
const tabs = (...urls: string[]): ContextTab[] => urls.map(url => ({ url, title: url }));
const task = (id: string, urls: string[], overrides: Partial<Task> = {}, parkedAt = '2026-10-05T10:00:00Z') =>
    makeTask({ id, title: id, context: makeContext({ tabs: tabs(...urls), parkedAt }), ...overrides });

describe('suggestTaskForUrl', () => {
    it.each([
        ['two pages on the same site', ['https://stripe.com/pricing', 'https://dashboard.stripe.com/x'], 2],
        ['one page in the same section', ['https://stripe.com/docs/api'], 2],
        ['the same page (hash ignored)', ['https://stripe.com/docs/billing#top'], 5],
        ['two same-site pages in the same section', ['https://stripe.com/docs/a', 'https://stripe.com/docs/b'], 3],
    ])('scores %s', (_name, urls, score) => {
        expect(suggestTaskForUrl('https://stripe.com/docs/billing', [task('t1', urls)], {}, NOW)).toEqual({
            taskId: 't1',
            title: 't1',
            score,
            site: 'stripe.com',
        });
    });

    it('needs a score of 2: one same-site page in another section is not enough', () => {
        expect(
            suggestTaskForUrl('https://stripe.com/docs/x', [task('t1', ['https://stripe.com/blog'])], {}, NOW)
        ).toBeNull();
        expect(suggestTaskForUrl('https://stripe.com/', [task('t1', ['https://stripe.com/blog'])], {}, NOW)).toBeNull();
        expect(
            suggestTaskForUrl('https://paddle.com/docs', [task('t1', ['https://stripe.com/docs'])], {}, NOW)
        ).toBeNull();
    });

    it('ignores search engines, video, local and non-web pages, and TabPlex itself', () => {
        const all = task('t1', [
            'https://www.google.com/search?q=a',
            'https://mail.google.com/x',
            'https://youtube.com/watch?v=1',
            'http://localhost:3000/a',
            'file:///C:/a.txt',
            'file:///C:/b.txt',
        ]);
        for (const url of [
            'https://www.google.com/search?q=b',
            'https://youtube.com/watch?v=2',
            'http://localhost:3000/b',
            'file:///C:/c.txt',
            'chrome://settings',
            'chrome-extension://abc/index.html',
            'not a url',
        ]) {
            expect(suggestTaskForUrl(url, [all], {}, NOW, 'chrome-extension://abc/')).toBeNull();
        }
    });

    it('only suggests parked or idle tasks that are not done and have tabs', () => {
        const urls = ['https://stripe.com/a', 'https://stripe.com/b'];
        const candidates = [
            task('done', urls, { status: 'done' }),
            makeTask({ id: 'active', context: makeContext({ tabs: tabs(...urls), state: 'active' }) }),
            makeTask({ id: 'empty', context: makeContext({ tabs: [], state: 'idle' }) }),
            makeTask({ id: 'none' }),
        ];
        expect(suggestTaskForUrl('https://stripe.com/c', candidates, {}, NOW)).toBeNull();
        const idle = makeTask({
            id: 'idle',
            context: makeContext({ tabs: tabs(...urls), state: 'idle', parkedAt: undefined }),
        });
        expect(suggestTaskForUrl('https://stripe.com/c', [...candidates, idle], {}, NOW)?.taskId).toBe('idle');
    });

    it('skips a task the user dismissed for this site in the last 7 days', () => {
        const t = task('t1', ['https://stripe.com/a', 'https://stripe.com/b']);
        const recent = { [dismissKey('t1', 'stripe.com')]: NOW - DISMISS_FOR_MS + 1000 };
        const old = { [dismissKey('t1', 'stripe.com')]: NOW - DISMISS_FOR_MS };
        expect(suggestTaskForUrl('https://stripe.com/c', [t], recent, NOW)).toBeNull();
        expect(suggestTaskForUrl('https://stripe.com/c', [t], old, NOW)?.taskId).toBe('t1');
        expect(
            suggestTaskForUrl('https://stripe.com/c', [t], { [dismissKey('t1', 'paddle.com')]: NOW }, NOW)
        ).not.toBeNull();
    });

    it('picks the highest score, then the most recently parked, then the title', () => {
        const two = ['https://stripe.com/a', 'https://stripe.com/b'];
        const three = [...two, 'https://stripe.com/c'];
        expect(
            suggestTaskForUrl('https://stripe.com/x', [task('low', two), task('high', three)], {}, NOW)?.taskId
        ).toBe('high');
        const older = task('older', two, {}, '2026-10-01T00:00:00Z');
        const newer = task('newer', two, {}, '2026-10-04T00:00:00Z');
        expect(suggestTaskForUrl('https://stripe.com/x', [older, newer], {}, NOW)?.taskId).toBe('newer');
        const b = task('b', two, {}, '2026-10-04T00:00:00Z');
        const a = task('a', two, {}, '2026-10-04T00:00:00Z');
        expect(suggestTaskForUrl('https://stripe.com/x', [b, a], {}, NOW)?.taskId).toBe('a');
        const unparked = makeTask({
            id: 'z',
            title: 'z',
            context: makeContext({ tabs: tabs(...two), parkedAt: undefined }),
        });
        expect(suggestTaskForUrl('https://stripe.com/x', [unparked, a], {}, NOW)?.taskId).toBe('a');
    });
});

describe('pruneDismissed', () => {
    it('keeps only entries inside the 7-day window', () => {
        expect(pruneDismissed({ fresh: NOW - 1000, stale: NOW - DISMISS_FOR_MS }, NOW)).toEqual({ fresh: NOW - 1000 });
    });
});
