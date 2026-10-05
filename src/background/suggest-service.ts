// Suggest a task for a new tab (docs/specs/SUGGEST_TASK_FOR_TAB.md): when a page that clearly belongs to a parked
// task finishes loading, a notification offers to add it to that task. Off by default; no AI, nothing leaves the device.
//
// The service worker may sleep between showing the notification and the click: everything the button handlers
// need is in the notification id and in storage.
import { getAllTasks, getTask } from './storage';
import { addTabsToTask } from './context-service';
import { ParkResumeSettings } from '../types';
import { siteKey } from '../utils/siteKey';
import {
    ACTIVE_CONTEXT_KEY,
    DEFAULT_PARK_RESUME_SETTINGS,
    PARK_RESUME_SETTINGS_KEY,
    getContext,
} from '../utils/taskContext';
import {
    DismissMap,
    SUGGEST_DISMISSED_KEY,
    dismissKey,
    isSuggestable,
    pruneDismissed,
    suggestTaskForUrl,
} from '../utils/taskSuggest';

const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE
export const SUGGEST_PREFIX = 'suggest:';
const DONE_PREFIX = 'suggest-done:';
/** At most one suggestion per this long */
export const SUGGEST_INTERVAL_MS = 2 * 60 * 1000;
const LAST_SHOWN_KEY = 'tabplex_suggest_last_shown';
const ASKED_KEY = 'tabplex_suggest_asked';
const MAX_ASKED = 200;
const CONFIRMATION_MS = 4000;
// Full URL: a relative one resolves against the worker's folder (src/background/), and Chrome then shows nothing
const icon = () => chrome.runtime.getURL('assets/icon128.png');

/**
 * Tabs we already asked about (redirects fire "complete" again). Kept in chrome.storage.session too: Chrome stops an
 * idle worker after ~30 s, and an in-memory list alone let the same tab be offered again once the rate limit passed.
 */
const askedTabIds = new Set<number>();
/** Notifications whose button was used, so the close that follows isn't read as "Not now" */
const handled = new Set<string>();

const extensionBaseUrl = () => chrome.runtime.getURL('');

async function getSettings(): Promise<ParkResumeSettings> {
    const result = await chrome.storage.local.get([PARK_RESUME_SETTINGS_KEY]);
    return { ...DEFAULT_PARK_RESUME_SETTINGS, ...(result[PARK_RESUME_SETTINGS_KEY] as Partial<ParkResumeSettings>) };
}

async function getDismissed(): Promise<DismissMap> {
    const result = await chrome.storage.local.get([SUGGEST_DISMISSED_KEY]);
    return (result[SUGGEST_DISMISSED_KEY] as DismissMap | undefined) ?? {};
}

async function getLastShownAt(): Promise<number> {
    try {
        const result = await chrome.storage.session.get(LAST_SHOWN_KEY);
        return (result[LAST_SHOWN_KEY] as number | undefined) ?? 0;
    } catch {
        return 0;
    }
}

async function wasAsked(tabId: number): Promise<boolean> {
    if (askedTabIds.has(tabId)) return true;
    try {
        const result = await chrome.storage.session.get(ASKED_KEY);
        return ((result[ASKED_KEY] as number[] | undefined) ?? []).includes(tabId);
    } catch {
        return false;
    }
}

async function setAsked(tabId: number, asked: boolean): Promise<void> {
    if (asked) askedTabIds.add(tabId);
    else askedTabIds.delete(tabId);
    try {
        const result = await chrome.storage.session.get(ASKED_KEY);
        const stored = ((result[ASKED_KEY] as number[] | undefined) ?? []).filter(id => id !== tabId);
        if (asked) stored.push(tabId);
        await chrome.storage.session.set({ [ASKED_KEY]: stored.slice(-MAX_ASKED) });
    } catch {
        // Only the in-memory list then
    }
}

async function setLastShownAt(at: number): Promise<void> {
    try {
        await chrome.storage.session.set({ [LAST_SHOWN_KEY]: at });
    } catch {
        // Only the in-memory rate limit then
    }
}

export const notificationId = (tabId: number, taskId: string) => `${SUGGEST_PREFIX}${tabId}:${taskId}`;

export function parseNotificationId(id: string): { tabId: number; taskId: string } | null {
    if (!id.startsWith(SUGGEST_PREFIX)) return null;
    const rest = id.slice(SUGGEST_PREFIX.length);
    const colon = rest.indexOf(':');
    const tabId = Number(rest.slice(0, colon));
    const taskId = rest.slice(colon + 1);
    return colon > 0 && Number.isInteger(tabId) && taskId ? { tabId, taskId } : null;
}

/** Decide whether to suggest a task for this loaded tab, and show the notification */
export async function considerTab(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id === undefined || !tab.url || (await wasAsked(tab.id))) return;
    if (tab.pinned || tab.incognito) return;
    if (tab.groupId !== undefined && tab.groupId !== NO_GROUP) return;

    const settings = await getSettings();
    if (!settings.suggestTasksForTabs) return;

    const tasks = await getAllTasks();
    // Already part of a task (also covers tabs Start/Resume just reopened)
    if (tasks.some(task => getContext(task).tabs.some(saved => saved.url === tab.url))) return;

    // It was just auto-added to the active task
    if (settings.autoAddNewTabs) {
        const { [ACTIVE_CONTEXT_KEY]: activeId } = await chrome.storage.local.get([ACTIVE_CONTEXT_KEY]);
        const active = tasks.find(task => task.id === activeId);
        if (active && getContext(active).state === 'active' && getContext(active).windowId === tab.windowId) return;
    }

    const now = Date.now();
    const suggestion = suggestTaskForUrl(tab.url, tasks, await getDismissed(), now, extensionBaseUrl());
    if (!suggestion) return;
    if (now - (await getLastShownAt()) < SUGGEST_INTERVAL_MS) return;

    await setAsked(tab.id, true);
    await setLastShownAt(now);
    const page = tab.title || tab.url;
    await chrome.notifications.create(notificationId(tab.id, suggestion.taskId), {
        type: 'basic',
        iconUrl: icon(),
        title: 'Add this tab to a task?',
        message: `"${page}" looks like part of "${suggestion.title}".`,
        buttons: [{ title: 'Add to task' }, { title: 'Not now' }],
        requireInteraction: false,
    });
}

/** "Not now": don't suggest this site for this task for a week */
async function dismiss(taskId: string, tabId: number): Promise<void> {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    const site = tab?.url ? siteKey(tab.url) : null;
    if (!site) return;
    const now = Date.now();
    const dismissed = pruneDismissed(await getDismissed(), now);
    dismissed[dismissKey(taskId, site)] = now;
    await chrome.storage.local.set({ [SUGGEST_DISMISSED_KEY]: dismissed });
}

async function confirm(message: string): Promise<void> {
    const id = `${DONE_PREFIX}${Date.now()}`;
    await chrome.notifications.create(id, { type: 'basic', iconUrl: icon(), title: 'TabPlex', message });
    setTimeout(() => {
        chrome.notifications.clear(id).catch(() => undefined);
    }, CONFIRMATION_MS);
}

async function accept(taskId: string, tabId: number): Promise<void> {
    const task = await getTask(taskId);
    // Deleted, finished or started meanwhile: nothing to offer any more
    if (!task || !isSuggestable(task)) return;
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (!tab) {
        await confirm('The tab was closed.');
        return;
    }
    // Saves the task and broadcasts STORAGE_TASK_UPDATED, so open TabPlex pages refresh
    const result = await addTabsToTask({ task, chromeTabIds: [tabId] });
    if (result.error) throw new Error(result.error);
    await confirm(`Added to "${task.title}".`);
}

export async function handleButton(notificationId: string, buttonIndex: number): Promise<void> {
    const parsed = parseNotificationId(notificationId);
    if (!parsed) return;
    handled.add(notificationId);
    await chrome.notifications.clear(notificationId).catch(() => undefined);
    if (buttonIndex === 0) await accept(parsed.taskId, parsed.tabId);
    else await dismiss(parsed.taskId, parsed.tabId);
}

export async function handleClosed(notificationId: string, byUser: boolean): Promise<void> {
    const parsed = parseNotificationId(notificationId);
    if (!parsed) return;
    // A button click clears the notification too; only a swipe away means "Not now"
    if (handled.delete(notificationId) || !byUser) return;
    await dismiss(parsed.taskId, parsed.tabId);
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    considerTab(tab).catch(error => console.warn('Task suggestion failed', error));
});

chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    handleButton(id, buttonIndex).catch(error => console.warn('Task suggestion action failed', error));
});

chrome.notifications.onClosed.addListener((id, byUser) => {
    handleClosed(id, byUser).catch(error => console.warn('Task suggestion dismiss failed', error));
});

chrome.tabs.onRemoved.addListener(tabId => {
    setAsked(tabId, false).catch(() => undefined);
});
