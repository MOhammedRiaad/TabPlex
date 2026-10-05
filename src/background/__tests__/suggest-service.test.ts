import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, EXTENSION_BASE } from '../../test/chromeMock';
import { makeContext, makeTask } from '../../test/factories';
import { Task } from '../../types';
import { ACTIVE_CONTEXT_KEY, BACKGROUND_TASKS_KEY, PARK_RESUME_SETTINGS_KEY } from '../../utils/taskContext';
import { SUGGEST_DISMISSED_KEY } from '../../utils/taskSuggest';

type Service = typeof import('../suggest-service');

let mock: ChromeMock;
let service: Service;

const STRIPE = makeTask({
    id: 'task_stripe',
    title: 'Compare pricing',
    context: makeContext({
        tabs: [
            { url: 'https://stripe.com/pricing', title: 'Pricing' },
            { url: 'https://stripe.com/docs/billing', title: 'Billing' },
        ],
    }),
});

const storedTask = (id = STRIPE.id) =>
    ((mock.browser.store[BACKGROUND_TASKS_KEY] as Task[]) ?? []).find(task => task.id === id);
const shown = () => [...mock.browser.notifications.keys()];
const suggestions = () => shown().filter(id => id.startsWith('suggest:'));

async function setup({ enabled = true, tasks = [STRIPE] }: { enabled?: boolean; tasks?: Task[] } = {}) {
    await chrome.storage.local.set({
        [BACKGROUND_TASKS_KEY]: tasks,
        [PARK_RESUME_SETTINGS_KEY]: { suggestTasksForTabs: enabled },
    });
}

/** A loaded tab, as tabs.onUpdated delivers it */
function load(url: string, props: Partial<chrome.tabs.Tab> = {}) {
    const tab = mock.browser.addTab({ url, title: `Page ${url}` });
    return { ...tab, ...props } as unknown as chrome.tabs.Tab;
}

describe('suggest-service', () => {
    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
        mock = installChromeMock();
        vi.resetModules();
        service = await import('../suggest-service');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('does nothing while the setting is off (the default)', async () => {
        await setup({ enabled: false });
        await service.considerTab(load('https://stripe.com/docs/api'));
        expect(suggestions()).toEqual([]);
    });

    it('offers the matching parked task when a page finishes loading', async () => {
        await setup();
        const tab = load('https://stripe.com/docs/api');
        mock.browser.events.tabUpdated.emit(tab.id, { status: 'loading' }, tab);
        mock.browser.events.tabUpdated.emit(tab.id, { status: 'complete' }, tab);
        await vi.advanceTimersByTimeAsync(0);

        expect(suggestions()).toEqual([`suggest:${tab.id}:task_stripe`]);
        expect(mock.browser.notifications.get(suggestions()[0])).toMatchObject({
            title: 'Add this tab to a task?',
            // A full URL: relative paths resolve against the worker's folder and the notification never shows
            iconUrl: `${EXTENSION_BASE}assets/icon128.png`,
            message: `"Page https://stripe.com/docs/api" looks like part of "Compare pricing".`,
            buttons: [{ title: 'Add to task' }, { title: 'Not now' }],
        });
    });

    it('skips pinned, incognito, grouped and already-saved tabs, and pages that match nothing', async () => {
        await setup();
        await service.considerTab(load('https://stripe.com/docs/a', { pinned: true }));
        await service.considerTab(load('https://stripe.com/docs/b', { incognito: true }));
        await service.considerTab(load('https://stripe.com/docs/c', { groupId: 7 }));
        await service.considerTab(load('https://stripe.com/pricing'));
        await service.considerTab(load('https://paddle.com/docs'));
        await service.considerTab({ ...load('https://stripe.com/docs/d'), id: undefined });
        expect(suggestions()).toEqual([]);
    });

    it('skips a tab that was just auto-added to the active task in its window', async () => {
        const active = makeTask({ id: 'task_active', context: makeContext({ state: 'active', windowId: 1 }) });
        await setup({ tasks: [STRIPE, active] });
        await chrome.storage.local.set({ [ACTIVE_CONTEXT_KEY]: 'task_active' });
        await service.considerTab(load('https://stripe.com/docs/api', { windowId: 1 }));
        expect(suggestions()).toEqual([]);

        // Another window: auto-add didn't take it
        await service.considerTab(load('https://stripe.com/docs/api', { windowId: 2 }));
        expect(suggestions()).toHaveLength(1);
    });

    it('shows at most one suggestion per 2 minutes, and never twice for a tab', async () => {
        await setup();
        const first = load('https://stripe.com/docs/a');
        await service.considerTab(first);
        await service.considerTab(load('https://stripe.com/docs/b'));
        expect(suggestions()).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(service.SUGGEST_INTERVAL_MS);
        await service.considerTab(first); // a redirect of the same tab
        expect(suggestions()).toHaveLength(1);
        await service.considerTab(load('https://stripe.com/docs/c'));
        expect(suggestions()).toHaveLength(2);
    });

    it('"Add to task" saves the tab in the task, tells open TabPlex pages and confirms', async () => {
        await setup();
        const tab = load('https://stripe.com/docs/api');
        await service.considerTab(tab);
        const id = suggestions()[0];

        mock.browser.events.notificationButtonClicked.emit(id, 0);
        await vi.advanceTimersByTimeAsync(0);
        expect(storedTask()?.context?.tabs.map(t => t.url)).toContain('https://stripe.com/docs/api');
        expect(chrome.tabs.get).toHaveBeenCalledWith(tab.id);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'STORAGE_TASK_UPDATED' })
        );
        expect(suggestions()).toEqual([]);
        const confirmation = shown().find(n => n.startsWith('suggest-done:'))!;
        expect(mock.browser.notifications.get(confirmation)).toMatchObject({ message: 'Added to "Compare pricing".' });

        // The close that follows the click isn't a "Not now"
        mock.browser.events.notificationClosed.emit(id, true);
        await vi.advanceTimersByTimeAsync(4000);
        expect(mock.browser.store[SUGGEST_DISMISSED_KEY]).toBeUndefined();
        expect(shown()).toEqual([]);
    });

    it('"Add to task" says so when the tab was closed, and does nothing for a finished or deleted task', async () => {
        await setup();
        const tab = load('https://stripe.com/docs/api');
        await service.considerTab(tab);
        await chrome.tabs.remove(tab.id!);
        await service.handleButton(`suggest:${tab.id}:task_stripe`, 0);
        expect(mock.browser.notifications.get(shown()[0])).toMatchObject({ message: 'The tab was closed.' });

        await vi.advanceTimersByTimeAsync(4000);
        await chrome.storage.local.set({ [BACKGROUND_TASKS_KEY]: [{ ...STRIPE, status: 'done' }] });
        await service.handleButton('suggest:5:task_stripe', 0);
        await service.handleButton('suggest:5:task_gone', 0);
        expect(shown()).toEqual([]);
    });

    it('"Not now" or swiping it away silences the site for that task for 7 days', async () => {
        await setup();
        const tab = load('https://stripe.com/docs/api');
        await service.considerTab(tab);
        await service.handleButton(suggestions()[0], 1);
        expect(mock.browser.store[SUGGEST_DISMISSED_KEY]).toEqual({ 'task_stripe|stripe.com': Date.now() });

        await vi.advanceTimersByTimeAsync(service.SUGGEST_INTERVAL_MS);
        await service.considerTab(load('https://stripe.com/docs/other'));
        expect(suggestions()).toEqual([]);

        // A week later it may ask again; swiping that one away counts as "Not now" too
        await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);
        const later = load('https://stripe.com/docs/later');
        await service.considerTab(later);
        expect(suggestions()).toHaveLength(1);
        await service.handleClosed(suggestions()[0], false); // timed out: not a dismissal
        expect((mock.browser.store[SUGGEST_DISMISSED_KEY] as Record<string, number>)['task_stripe|stripe.com']).toBe(
            Date.parse('2026-10-05T12:00:00Z') // unchanged since the first "Not now"
        );
        await service.handleClosed(suggestions()[0], true);
        expect(mock.browser.store[SUGGEST_DISMISSED_KEY]).toEqual({ 'task_stripe|stripe.com': Date.now() });
    });

    it('ignores other notifications and malformed ids', async () => {
        await setup();
        for (const id of ['other', 'suggest:', 'suggest:abc:task', 'suggest:5:']) {
            await service.handleButton(id, 1);
            await service.handleClosed(id, true);
        }
        expect(service.parseNotificationId(`suggest:12:${STRIPE.id}`)).toEqual({ tabId: 12, taskId: STRIPE.id });
        expect(mock.browser.store[SUGGEST_DISMISSED_KEY]).toBeUndefined();
        // Not now on a tab that's gone: nothing to remember
        await service.handleButton('suggest:999:task_stripe', 1);
        expect(mock.browser.store[SUGGEST_DISMISSED_KEY]).toBeUndefined();
    });

    it('still works when chrome.storage.session is unavailable', async () => {
        await setup();
        vi.mocked(chrome.storage.session.get).mockRejectedValue(new Error('no session storage'));
        vi.mocked(chrome.storage.session.set).mockRejectedValue(new Error('no session storage'));
        await service.considerTab(load('https://stripe.com/docs/api'));
        expect(suggestions()).toHaveLength(1);
    });

    it('logs instead of throwing when a listener fails', async () => {
        await setup();
        vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('boom'));
        const tab = load('https://stripe.com/docs/api');
        mock.browser.events.tabUpdated.emit(tab.id, { status: 'complete' }, tab);
        vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('boom'));
        mock.browser.events.notificationButtonClicked.emit('suggest:1:task_stripe', 1);
        vi.mocked(chrome.tabs.get).mockRejectedValueOnce(new Error('boom'));
        mock.browser.events.notificationClosed.emit('suggest:1:task_stripe', true);
        await vi.advanceTimersByTimeAsync(0);
        expect(console.warn).toHaveBeenCalledWith('Task suggestion failed', expect.any(Error));
        mock.browser.events.tabRemoved.emit(tab.id, {});
    });
});
