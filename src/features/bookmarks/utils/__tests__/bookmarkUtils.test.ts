import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bookmark } from '../../../../types';
import { formatDate, formatDateTime, formatRelativeTime } from '../dateUtils';
import { extractDomain, getAllDomains } from '../domainUtils';
import {
    filterBookmarks,
    filterBookmarksByDomain,
    filterBookmarksByFolder,
    filterBookmarksByType,
    getAllFolders,
    getDefaultFilterConfig,
    loadFilterConfig,
    saveFilterConfig,
} from '../filterUtils';
import {
    getDefaultSortConfig,
    loadSortConfig,
    saveSortConfig,
    sortBookmarks,
    sortBookmarksByDateAdded,
    sortBookmarksByDateModified,
    sortBookmarksByDomain,
    sortBookmarksByName,
} from '../sortUtils';

const bm = (id: string, extra: Partial<Bookmark> = {}): Bookmark => ({ id, title: id, ...extra }) as Bookmark;
const titles = (list: Bookmark[]) => list.map(b => b.title);

const tree: Bookmark[] = [
    bm('bar', {
        title: 'Bar',
        children: [
            bm('g', { title: 'Github', url: 'https://www.github.com/x', dateAdded: 300 }),
            bm('docs', {
                title: 'Docs',
                children: [bm('mdn', { title: 'MDN', url: 'https://developer.mozilla.org', dateAdded: 100 })],
            }),
            bm('empty', { title: 'Empty', children: [] }),
        ],
    }),
];

describe('bookmark date utils', () => {
    const NOW = new Date('2026-10-03T12:00:00Z').getTime();
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it.each([
        [0, ''],
        [30_000, 'Just now'],
        [60_000, '1 minute ago'],
        [5 * 60_000, '5 minutes ago'],
        [3_600_000, '1 hour ago'],
        [2 * 3_600_000, '2 hours ago'],
        [86_400_000, '1 day ago'],
        [3 * 86_400_000, '3 days ago'],
        [7 * 86_400_000, '1 week ago'],
        [14 * 86_400_000, '2 weeks ago'],
        [30 * 86_400_000, '1 month ago'],
        [90 * 86_400_000, '3 months ago'],
        [365 * 86_400_000, '1 year ago'],
        [800 * 86_400_000, '2 years ago'],
    ])('formatRelativeTime(%i ago) → %s', (ago, expected) => {
        expect(formatRelativeTime(ago === 0 ? undefined : NOW - ago)).toBe(expected);
    });

    it('formats DD-MM-YYYY and date-time strings', () => {
        const ts = new Date(2026, 0, 5, 9, 30).getTime();
        expect(formatDate(ts)).toBe('05-01-2026');
        expect(formatDate()).toBe('');
        expect(formatDateTime(ts)).toContain('2026');
        expect(formatDateTime()).toBe('');
    });
});

describe('domain utils', () => {
    it.each([
        ['https://www.github.com/path?q=1', 'github.com'],
        ['http://example.org', 'example.org'],
        ['example.org/page', 'example.org'],
        ['  https://a.b.c  ', 'a.b.c'],
        ['', ''],
        ['   ', ''],
        [undefined, ''],
        ['file:///tmp/x', ''],
        ['https://exa mple.com', ''],
        ['http://[bad', '[bad'], // manual fallback keeps the raw host
    ])('extractDomain(%s) → %s', (url, expected) => {
        expect(extractDomain(url)).toBe(expected);
    });

    it('extracts manually when URL parsing fails', () => {
        expect(extractDomain('https://host:99999/path')).toBe('host:99999');
    });

    it('collects unique sorted domains recursively', () => {
        expect(getAllDomains(tree as never)).toEqual(['developer.mozilla.org', 'github.com']);
    });
});

describe('filterUtils', () => {
    it('filters by type recursively', () => {
        expect(filterBookmarksByType(tree, 'all')).toBe(tree);
        expect(titles(filterBookmarksByType(tree, 'folders')[0].children!)).toEqual(['Docs', 'Empty']);
        expect(filterBookmarksByType(tree, 'bookmarks')).toEqual([]);
        expect(titles(filterBookmarksByType(tree[0].children!, 'bookmarks'))).toEqual(['Github']);
        expect(filterBookmarksByType([bm('x')], 'other' as never)).toHaveLength(1);
    });

    it('filters to a folder subtree', () => {
        expect(titles(filterBookmarksByFolder(tree, 'docs'))).toEqual(['Docs']);
        expect(filterBookmarksByFolder(tree, 'g')).toEqual([]);
        expect(filterBookmarksByFolder(tree, 'missing')).toEqual([]);
    });

    it('filters by domain, dropping folders without matches', () => {
        const result = filterBookmarksByDomain(tree, 'DEVELOPER.mozilla.org');
        expect(titles(result)).toEqual(['Bar']);
        expect(titles(result[0].children!)).toEqual(['Docs']);
        expect(filterBookmarksByDomain(tree, 'nowhere.dev')).toEqual([]);
    });

    it('combines filters', () => {
        expect(filterBookmarks(tree, getDefaultFilterConfig())).toBe(tree);
        expect(titles(filterBookmarks(tree, { type: 'folders', folderId: 'bar' }))).toEqual(['Bar']);
        expect(filterBookmarks(tree, { type: 'all', domain: 'github.com' })[0].children).toHaveLength(1);
    });

    it('lists all folders', () => {
        expect(titles(getAllFolders(tree))).toEqual(['Bar', 'Docs', 'Empty']);
    });

    it('persists filter config with validation', () => {
        expect(loadFilterConfig()).toEqual(getDefaultFilterConfig());
        saveFilterConfig({ type: 'folders', folderId: 'f', domain: '' });
        expect(loadFilterConfig()).toEqual({ type: 'folders', folderId: 'f', domain: undefined });
        localStorage.setItem('tabboard-bookmark-filter', JSON.stringify({ type: 'weird' }));
        expect(loadFilterConfig()).toEqual(getDefaultFilterConfig());
        localStorage.setItem('tabboard-bookmark-filter', '{bad json');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(loadFilterConfig()).toEqual(getDefaultFilterConfig());
    });

    it('survives storage errors when saving', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('full');
        });
        saveFilterConfig(getDefaultFilterConfig());
        saveSortConfig(getDefaultSortConfig());
        expect(warn).toHaveBeenCalledTimes(2);
    });
});

describe('sortUtils', () => {
    const flat = [
        bm('1', { title: 'beta', url: 'https://z.com/b', dateAdded: 200 }),
        bm('2', { title: '', url: 'https://a.com', dateAdded: 0 }),
        bm('3', { title: 'Alpha', url: 'https://a.com/x', dateAdded: 300, dateGroupModified: 50 }),
        bm('4', { title: 'folder', children: [bm('5', { title: 'b' }), bm('6', { title: 'a' })] }),
        bm('7', { title: 'zed', dateAdded: 0 }),
    ];

    it('sorts by name with empty titles last, recursively', () => {
        expect(titles(sortBookmarksByName(flat, 'asc'))).toEqual(['Alpha', 'beta', 'folder', 'zed', '']);
        expect(titles(sortBookmarksByName(flat, 'desc'))).toEqual(['zed', 'folder', 'beta', 'Alpha', '']);
        expect(titles(sortBookmarksByName(flat)[2].children!)).toEqual(['a', 'b']);
        expect(sortBookmarksByName([])).toEqual([]);
        expect(sortBookmarksByName([bm('a', { title: '' }), bm('b', { title: '' })])).toHaveLength(2);
        expect(titles(sortBookmarksByName([bm('a', { title: 'same' }), bm('b', { title: 'same' })]))).toEqual([
            'same',
            'same',
        ]);
    });

    it('sorts by date added, undated last (by name)', () => {
        expect(titles(sortBookmarksByDateAdded(flat, 'desc'))).toEqual(['Alpha', 'beta', '', 'folder', 'zed']);
        expect(titles(sortBookmarksByDateAdded(flat, 'asc')).slice(0, 2)).toEqual(['beta', 'Alpha']);
        expect(titles(sortBookmarksByDateAdded(flat)[3].children!)).toEqual(['a', 'b']);
    });

    it('sorts by date modified, falling back to date added', () => {
        expect(titles(sortBookmarksByDateModified(flat, 'desc')).slice(0, 2)).toEqual(['beta', 'Alpha']);
        expect(titles(sortBookmarksByDateModified(flat, 'asc')).slice(0, 2)).toEqual(['Alpha', 'beta']);
        expect(titles(sortBookmarksByDateModified(flat)).slice(2)).toEqual(['', 'folder', 'zed']);
    });

    it('sorts by domain, folders last', () => {
        expect(titles(sortBookmarksByDomain(flat, 'asc'))).toEqual(['Alpha', '', 'beta', 'folder', 'zed']);
        expect(titles(sortBookmarksByDomain(flat, 'desc')).slice(0, 1)).toEqual(['beta']);
        const odd = [
            bm('a', { title: '', url: 'file:///x' }),
            bm('b', { title: 'n', url: 'file:///y' }),
            bm('c', { title: 'm', url: 'https://q.com' }),
            bm('d', { title: '', url: 'https://q.com' }),
            bm('e', { title: '' }),
            bm('f', { title: '' }),
            bm('g', { title: 'gg' }),
            bm('h', { title: '', url: 'file:///z' }),
        ];
        expect(sortBookmarksByDomain(odd).map(b => b.id)).toEqual(['c', 'd', 'b', 'a', 'h', 'g', 'e', 'f']);
    });

    it('sorts children of the Chrome root folders only', () => {
        const root = [
            bm('0', {
                children: [
                    bm('1', { children: [bm('x', { title: 'b' }), bm('y', { title: 'a' })] }),
                    bm('2', { children: [] }),
                ],
            }),
        ];
        for (const criteria of ['name', 'dateAdded', 'dateModified', 'domain'] as const) {
            const sorted = sortBookmarks(root, { criteria, order: 'asc' });
            expect(sorted[0].children![0].children).toHaveLength(2);
        }
        expect(titles(sortBookmarks(root, { criteria: 'name', order: 'asc' })[0].children![0].children!)).toEqual([
            'a',
            'b',
        ]);
        expect(
            sortBookmarks(root, { criteria: 'other' as never, order: 'asc' })[0].children![0].children![0].title
        ).toBe('b');
        expect(sortBookmarks([...root, bm('extra')], { criteria: 'name', order: 'asc' })[1].id).toBe('extra');
    });

    it('sorts plain lists by every criterion', () => {
        expect(sortBookmarks(flat, getDefaultSortConfig())).toBe(flat);
        expect(titles(sortBookmarks(flat, { criteria: 'name', order: 'asc' }))[0]).toBe('Alpha');
        expect(titles(sortBookmarks(flat, { criteria: 'dateAdded', order: 'desc' }))[0]).toBe('Alpha');
        expect(titles(sortBookmarks(flat, { criteria: 'dateModified', order: 'desc' }))[0]).toBe('beta');
        expect(titles(sortBookmarks(flat, { criteria: 'domain', order: 'asc' }))[0]).toBe('Alpha');
        expect(sortBookmarks(flat, { criteria: 'other' as never, order: 'asc' })).toBe(flat);
    });

    it('persists sort config with validation', () => {
        expect(loadSortConfig()).toEqual(getDefaultSortConfig());
        saveSortConfig({ criteria: 'domain', order: 'desc' });
        expect(loadSortConfig()).toEqual({ criteria: 'domain', order: 'desc' });
        localStorage.setItem('tabboard-bookmark-sort', JSON.stringify({ criteria: 'name', order: 'sideways' }));
        expect(loadSortConfig()).toEqual(getDefaultSortConfig());
        localStorage.setItem('tabboard-bookmark-sort', '{bad');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        expect(loadSortConfig()).toEqual(getDefaultSortConfig());
    });
});
