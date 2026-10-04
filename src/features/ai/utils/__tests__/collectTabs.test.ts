import { describe, expect, it } from 'vitest';
import { currentWindowId, getOrganizableTabs } from '../collectTabs';
import { EXTENSION_BASE, fakeChrome } from '../../../../test/chromeMock';

describe('getOrganizableTabs', () => {
    it('returns only ungrouped, unpinned web tabs of the window, in order', async () => {
        const a = await chrome.tabs.create({ url: 'https://a.dev/1' });
        await chrome.tabs.create({ url: 'https://pinned.dev', pinned: true } as chrome.tabs.CreateProperties);
        const grouped = await chrome.tabs.create({ url: 'https://grouped.dev' });
        await chrome.tabs.group({ tabIds: grouped.id! });
        await chrome.tabs.create({ url: 'chrome://newtab/' });
        await chrome.tabs.create({ url: `${EXTENSION_BASE}index.html` });
        const b = await chrome.tabs.create({ url: 'https://b.dev/2' });

        const tabs = await getOrganizableTabs(a.windowId);
        expect(tabs.map(t => t.id)).toEqual([a.id, b.id]);
        // The fake gives tabs the URL as title; an empty title falls back to the URL
        expect(tabs[0]).toMatchObject({ windowId: a.windowId, url: 'https://a.dev/1', title: 'https://a.dev/1' });
    });

    it('skips incognito tabs and returns nothing without a window', async () => {
        const tab = await chrome.tabs.create({ url: 'https://private.dev' });
        fakeChrome().tabs.query.mockResolvedValueOnce([{ ...tab, incognito: true, title: '' }] as never);
        expect(await getOrganizableTabs(tab.windowId)).toEqual([]);
        expect(await getOrganizableTabs(undefined)).toEqual([]);
    });

    it('uses the pending URL while a tab is loading', async () => {
        const tab = await chrome.tabs.create({ url: 'https://loading.dev' });
        fakeChrome().tabs.query.mockResolvedValueOnce([
            { ...tab, url: '', pendingUrl: 'https://loading.dev/', title: 'Loading', favIconUrl: 'f.png' },
        ] as never);
        expect(await getOrganizableTabs(tab.windowId)).toEqual([
            { id: tab.id, windowId: tab.windowId, title: 'Loading', url: 'https://loading.dev/', favicon: 'f.png' },
        ]);
    });
});

describe('currentWindowId', () => {
    it('returns the current window, or undefined if Chrome refuses', async () => {
        expect(await currentWindowId()).toEqual(expect.any(Number));
        fakeChrome().windows.getCurrent.mockRejectedValueOnce(new Error('no window'));
        expect(await currentWindowId()).toBeUndefined();
    });
});
