import { isCapturableUrl } from '../../../utils/taskContext';
import { OrganizableTab } from '../types';

const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE

/** Unpinned, non-incognito web tabs (never TabPlex itself or browser pages), keeping their order */
function toOrganizable(tabs: chrome.tabs.Tab[]): OrganizableTab[] {
    const base = chrome.runtime.getURL('');
    return tabs
        .filter(tab => tab.id !== undefined && !tab.pinned && !tab.incognito)
        .flatMap(tab => {
            const url = tab.url || tab.pendingUrl;
            if (!isCapturableUrl(url, base)) return [];
            return [
                {
                    id: tab.id as number,
                    windowId: tab.windowId,
                    title: tab.title || url,
                    url,
                    favicon: tab.favIconUrl || undefined,
                },
            ];
        });
}

/**
 * Ungrouped, unpinned web tabs in one window, in tab-strip order. Never includes TabPlex itself,
 * browser pages, incognito tabs, or tabs in any group (so the active Park & Resume task is safe).
 */
export async function getOrganizableTabs(windowId: number | undefined): Promise<OrganizableTab[]> {
    if (windowId === undefined) return [];
    const tabs = await chrome.tabs.query({ windowId });
    return toOrganizable(tabs.filter(tab => (tab.groupId ?? NO_GROUP) === NO_GROUP));
}

/**
 * Specific tabs, in the order of `ids`, with the same rules as getOrganizableTabs except grouped tabs are
 * allowed (e.g. a group made by Organize tabs). Closed tabs are skipped.
 */
export async function getTabsByIds(ids: number[]): Promise<OrganizableTab[]> {
    const tabs = await Promise.all(ids.map(id => chrome.tabs.get(id).catch(() => undefined)));
    return toOrganizable(tabs.filter((tab): tab is chrome.tabs.Tab => tab !== undefined));
}

export async function currentWindowId(): Promise<number | undefined> {
    try {
        return (await chrome.windows.getCurrent()).id;
    } catch {
        return undefined;
    }
}
