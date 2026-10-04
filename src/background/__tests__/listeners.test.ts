/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, fakeChrome, EXTENSION_BASE } from '../../test/chromeMock';
import { makeTab } from '../../test/factories';

let mock: ChromeMock;
const store = () => mock.browser.store as Record<string, any>;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    mock = installChromeMock();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe('tab-service listeners', () => {
    beforeEach(async () => {
        await import('../tab-service');
    });

    it('tracks pages that finish loading, then updates them', async () => {
        mock.browser.events.tabUpdated.emit(7, { status: 'complete' }, { id: 7, url: 'https://a.dev', title: 'A' });
        await flush();
        expect(store().tabboard_tabs[0]).toMatchObject({
            tabId: 7,
            url: 'https://a.dev',
            title: 'A',
            folderId: 'default_folder',
            status: 'open',
        });

        mock.browser.events.tabUpdated.emit(
            7,
            { status: 'complete' },
            { id: 7, url: 'https://a.dev/2', favIconUrl: 'f' }
        );
        await flush();
        expect(store().tabboard_tabs).toHaveLength(1);
        expect(store().tabboard_tabs[0]).toMatchObject({
            url: 'https://a.dev/2',
            title: 'https://a.dev/2',
            favicon: 'f',
        });
    });

    it('ignores loading updates and tabs without a url', async () => {
        mock.browser.events.tabUpdated.emit(1, { status: 'loading' }, { id: 1, url: 'https://x' });
        mock.browser.events.tabUpdated.emit(2, { status: 'complete' }, { id: 2 });
        await flush();
        expect(store().tabboard_tabs).toBeUndefined();
    });

    it('marks tracked tabs closed when they are removed', async () => {
        await chrome.storage.local.set({ tabboard_tabs: [makeTab({ tabId: 9, status: 'open' })] });
        mock.browser.events.tabRemoved.emit(9, {});
        mock.browser.events.tabRemoved.emit(10, {});
        await flush();
        expect(store().tabboard_tabs[0].status).toBe('closed');
    });
});

describe('tab-listeners', () => {
    it('refreshes lastAccessed when a tracked tab is activated', async () => {
        await import('../tab-listeners');
        await chrome.storage.local.set({ tabboard_tabs: [makeTab({ tabId: 3, lastAccessed: 'old' })] });
        mock.browser.events.tabActivated.emit({ tabId: 3, windowId: 1 });
        mock.browser.events.tabActivated.emit({ tabId: 4, windowId: 1 });
        await flush();
        expect(store().tabboard_tabs[0].lastAccessed).toBe('2026-10-03T12:00:00.000Z');
        expect(fakeChrome().runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'STORAGE_TAB_UPDATED' })
        );
    });
});

describe('cleanup-service', () => {
    it('deletes tabs closed for more than 30 days, once a day', async () => {
        await import('../cleanup-service');
        await chrome.storage.local.set({
            tabboard_tabs: [
                makeTab({ id: 'old', status: 'closed', lastAccessed: '2026-08-01T00:00:00Z' }),
                makeTab({ id: 'recent', status: 'closed', lastAccessed: '2026-10-01T00:00:00Z' }),
                makeTab({ id: 'open', status: 'open', lastAccessed: '2026-01-01T00:00:00Z' }),
            ],
        });
        await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
        expect(store().tabboard_tabs.map((t: any) => t.id)).toEqual(['recent', 'open']);
        expect(fakeChrome().runtime.sendMessage).toHaveBeenCalledWith({
            type: 'STORAGE_TAB_DELETED',
            payload: { id: 'old' },
        });
    });
});

describe('background-init', () => {
    beforeEach(async () => {
        await import('../background-init');
    });

    it('opens onboarding and creates the Inbox on first install', async () => {
        mock.browser.events.installed.emit({ reason: 'install' });
        await flush();
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith({ url: `${EXTENSION_BASE}onboarding.html` });
        expect(store().tabboard_folders).toEqual([expect.objectContaining({ id: 'default_folder', name: 'Inbox' })]);
    });

    it('keeps existing folders on update', async () => {
        await chrome.storage.local.set({ tabboard_folders: [{ id: 'mine' }] });
        mock.browser.events.installed.emit({ reason: 'update' });
        await flush();
        expect(fakeChrome().tabs.create).not.toHaveBeenCalled();
        expect(store().tabboard_folders).toEqual([{ id: 'mine' }]);
    });

    it('focuses an open TabPlex tab when the toolbar icon is clicked', async () => {
        const otherWindow = mock.browser.openWindow();
        const existing = mock.browser.addTab({ url: `${EXTENSION_BASE}index.html#/today`, windowId: otherWindow });
        mock.browser.events.actionClicked.emit({});
        await flush();
        expect(fakeChrome().tabs.update).toHaveBeenCalledWith(existing.id, { active: true });
        expect(fakeChrome().windows.update).toHaveBeenCalledWith(otherWindow, { focused: true });
    });

    it('opens TabPlex when it is not open, or when focusing fails', async () => {
        mock.browser.events.actionClicked.emit({});
        await flush();
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith({ url: `${EXTENSION_BASE}index.html` });

        fakeChrome().tabs.query.mockRejectedValueOnce(new Error('query failed'));
        mock.browser.events.actionClicked.emit({});
        await flush();
        expect(fakeChrome().tabs.create).toHaveBeenCalledTimes(2);
    });
});
