import { describe, expect, it } from 'vitest';
import { collectReadableTabs } from '../collectReadableTabs';
import { EXTENSION_BASE, fakeChrome } from '../../../../test/chromeMock';

const tab = (overrides: Partial<chrome.tabs.Tab>): chrome.tabs.Tab =>
    ({
        id: 1,
        windowId: 1,
        index: 0,
        title: 'Page',
        url: 'https://a.dev/page',
        pinned: false,
        incognito: false,
        discarded: false,
        status: 'complete',
        groupId: -1,
        active: false,
        highlighted: false,
        autoDiscardable: true,
        frozen: false,
        selected: false,
        ...overrides,
    }) as chrome.tabs.Tab;

/** Makes chrome.tabs.query return these tabs once */
const tabsInWindow = (...tabs: chrome.tabs.Tab[]) => fakeChrome().tabs.query.mockResolvedValueOnce(tabs as never);

describe('collectReadableTabs', () => {
    it('returns nothing without a window', async () => {
        expect(await collectReadableTabs(undefined)).toEqual([]);
        expect(fakeChrome().tabs.query).not.toHaveBeenCalled();
    });

    it('keeps pinned and grouped tabs, in tab-strip order, with origin pattern and favicon', async () => {
        tabsInWindow(
            tab({ id: 1, url: 'https://a.dev/one', title: 'One', favIconUrl: 'https://a.dev/icon.png' }),
            tab({ id: 2, url: 'https://b.dev/two', pinned: true, title: '' }),
            tab({ id: 3, url: 'https://c.dev/three', groupId: 9, title: '' })
        );

        const tabs = await collectReadableTabs(1);

        expect(tabs).toEqual([
            {
                id: 1,
                windowId: 1,
                title: 'One',
                url: 'https://a.dev/one',
                favicon: 'https://a.dev/icon.png',
                originPattern: 'https://a.dev/*',
                readable: true,
                reason: undefined,
                duplicateOf: undefined,
            },
            {
                id: 2,
                windowId: 1,
                title: 'https://b.dev/two',
                url: 'https://b.dev/two',
                favicon: undefined,
                originPattern: 'https://b.dev/*',
                readable: true,
                reason: undefined,
                duplicateOf: undefined,
            },
            expect.objectContaining({ id: 3, title: 'https://c.dev/three', readable: true }),
        ]);
    });

    it('skips incognito tabs, browser pages, file and ftp URLs, TabPlex itself, and tabs without a committed URL', async () => {
        tabsInWindow(
            tab({ id: 1, incognito: true }),
            tab({ id: 2, url: 'chrome://newtab/' }),
            tab({ id: 3, url: `${EXTENSION_BASE}index.html` }),
            tab({ id: 4, url: 'file:///C:/notes/a.html' }),
            tab({ id: 5, url: 'ftp://files.example/readme' }),
            tab({ id: 6, url: undefined, pendingUrl: 'https://pending.dev/' }),
            tab({ id: undefined, url: 'https://noid.dev/' }),
            tab({ id: 8, url: 'https://kept.dev/' })
        );

        const tabs = await collectReadableTabs(1);

        expect(tabs.map(t => t.id)).toEqual([8]);
    });

    it('greys out store pages, PDFs, sleeping tabs and tabs still loading, with the reason for each', async () => {
        tabsInWindow(
            tab({ id: 1, url: 'https://chromewebstore.google.com/detail/x/abc' }),
            tab({ id: 2, url: 'https://chrome.google.com/webstore/detail/y' }),
            tab({ id: 3, url: 'https://microsoftedge.microsoft.com/addons/detail/z' }),
            tab({ id: 4, url: 'https://arxiv.org/pdf/paper.PDF' }),
            tab({ id: 5, url: 'https://a.dev/asleep', discarded: true }),
            tab({ id: 6, url: 'https://a.dev/loading', status: 'loading' }),
            // Only the webstore path is blocked, not the rest of the host
            tab({ id: 7, url: 'https://chrome.google.com/about' })
        );

        const byId = Object.fromEntries((await collectReadableTabs(1)).map(t => [t.id, t]));

        expect(byId[1]).toMatchObject({ readable: false, reason: 'blocked-site' });
        expect(byId[2]).toMatchObject({ readable: false, reason: 'blocked-site' });
        expect(byId[3]).toMatchObject({ readable: false, reason: 'blocked-site' });
        expect(byId[4]).toMatchObject({ readable: false, reason: 'pdf' });
        expect(byId[5]).toMatchObject({ readable: false, reason: 'asleep' });
        expect(byId[6]).toMatchObject({ readable: false, reason: 'loading' });
        expect(byId[7]).toMatchObject({ readable: true, reason: undefined });
    });

    it('flags a tab whose URL is already listed earlier, ignoring the fragment', async () => {
        tabsInWindow(
            tab({ id: 1, url: 'https://a.dev/page#intro' }),
            tab({ id: 2, url: 'https://a.dev/other' }),
            tab({ id: 3, url: 'https://a.dev/page#details' }),
            tab({ id: 4, url: 'https://a.dev/page' })
        );

        const byId = Object.fromEntries((await collectReadableTabs(1)).map(t => [t.id, t]));

        expect(byId[1].duplicateOf).toBeUndefined();
        expect(byId[2].duplicateOf).toBeUndefined();
        expect(byId[3].duplicateOf).toBe(1);
        expect(byId[4].duplicateOf).toBe(1);
    });
});
