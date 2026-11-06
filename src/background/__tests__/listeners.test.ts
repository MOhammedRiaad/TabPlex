/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, fakeChrome, EXTENSION_BASE } from '../../test/chromeMock';
import { makeTab } from '../../test/factories';
import { CLEANUP_ALARM, MAX_TRACKED_TABS, TRACK_ALL_TABS_KEY } from '../../utils/tabTracking';

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

    it('records new pages only while tracking is on, but keeps following tabs it already has', async () => {
        await chrome.storage.local.set({
            [TRACK_ALL_TABS_KEY]: false,
            tabboard_tabs: [makeTab({ id: 'mine', tabId: 5, url: 'https://old.dev' })],
        });
        mock.browser.events.tabUpdated.emit(5, { status: 'complete' }, { id: 5, url: 'https://new.dev', title: 'N' });
        mock.browser.events.tabUpdated.emit(6, { status: 'complete' }, { id: 6, url: 'https://other.dev' });
        await flush();
        expect(store().tabboard_tabs).toHaveLength(1);
        expect(store().tabboard_tabs[0]).toMatchObject({ id: 'mine', url: 'https://new.dev' });

        await chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: true });
        mock.browser.events.tabUpdated.emit(6, { status: 'complete' }, { id: 6, url: 'https://other.dev' });
        await flush();
        expect(store().tabboard_tabs).toHaveLength(2);
    });

    it('records pages when the setting was never stored (installs from before it existed)', async () => {
        mock.browser.events.tabUpdated.emit(8, { status: 'complete' }, { id: 8, url: 'https://a.dev' });
        await flush();
        expect(store().tabboard_tabs).toHaveLength(1);
    });

    it('drops the oldest closed tabs at once when the list is full', async () => {
        const full = Array.from({ length: MAX_TRACKED_TABS }, (_, i) =>
            makeTab({
                id: `t${i}`,
                tabId: 1000 + i,
                status: i < 3 ? 'closed' : 'open',
                lastAccessed: `2026-10-0${i < 3 ? 3 - i : 3}T00:00:00Z`,
            })
        );
        await chrome.storage.local.set({ tabboard_tabs: full });
        mock.browser.events.tabUpdated.emit(7, { status: 'complete' }, { id: 7, url: 'https://new.dev' });
        await flush();
        const ids = (store().tabboard_tabs as any[]).map(t => t.id);
        expect(ids).toHaveLength(MAX_TRACKED_TABS);
        expect(ids).not.toContain('t2'); // the oldest closed one
        expect(ids).toContain('t0');
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
    const seed = () =>
        chrome.storage.local.set({
            tabboard_tabs: [
                makeTab({ id: 'old', status: 'closed', lastAccessed: '2026-08-01T00:00:00Z' }),
                makeTab({ id: 'recent', status: 'closed', lastAccessed: '2026-10-01T00:00:00Z' }),
                makeTab({ id: 'open', status: 'open', lastAccessed: '2026-01-01T00:00:00Z' }),
            ],
        });

    it('schedules one daily alarm, and only once', async () => {
        await import('../cleanup-service');
        await flush();
        expect(fakeChrome().alarms.create).toHaveBeenCalledWith(CLEANUP_ALARM, { periodInMinutes: 24 * 60 });

        // The alarm outlives the worker: a restart finds it and does not create another
        vi.resetModules();
        await import('../cleanup-service');
        await flush();
        expect(fakeChrome().alarms.create).toHaveBeenCalledTimes(1);
    });

    it('deletes tabs closed for more than 30 days when the alarm fires', async () => {
        await import('../cleanup-service');
        await seed();
        mock.browser.events.alarm.emit({ name: 'something-else' });
        await flush();
        expect(store().tabboard_tabs).toHaveLength(3);

        mock.browser.events.alarm.emit({ name: CLEANUP_ALARM });
        await flush();
        expect(store().tabboard_tabs.map((t: any) => t.id)).toEqual(['recent', 'open']);
        expect(fakeChrome().runtime.sendMessage).toHaveBeenCalledWith({
            type: 'STORAGE_TAB_DELETED',
            payload: { id: 'old' },
        });
    });

    it('also cleans up when the browser starts', async () => {
        await import('../cleanup-service');
        await seed();
        mock.browser.events.startup.emit();
        await flush();
        expect(store().tabboard_tabs.map((t: any) => t.id)).toEqual(['recent', 'open']);
    });

    it('survives a failing cleanup', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await import('../cleanup-service');
        fakeChrome().storage.local.get.mockRejectedValue(new Error('read failed'));
        mock.browser.events.alarm.emit({ name: CLEANUP_ALARM });
        mock.browser.events.startup.emit();
        await flush();
        expect(console.warn).toHaveBeenCalledTimes(2);
    });

    it('runs no timer of its own (a sleeping worker would never reach it)', async () => {
        const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
        await import('../cleanup-service');
        expect(setIntervalSpy).not.toHaveBeenCalled();
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
        // New installs do not record every page until the user opts in
        expect(store()[TRACK_ALL_TABS_KEY]).toBe(false);
    });

    it('keeps existing folders on update', async () => {
        await chrome.storage.local.set({ tabboard_folders: [{ id: 'mine' }] });
        mock.browser.events.installed.emit({ reason: 'update' });
        await flush();
        expect(fakeChrome().tabs.create).not.toHaveBeenCalled();
        expect(store().tabboard_folders).toEqual([{ id: 'mine' }]);
        expect(store()[TRACK_ALL_TABS_KEY]).toBeUndefined(); // updates keep the old behaviour
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
