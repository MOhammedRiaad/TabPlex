import { isCapturableUrl } from '../../../utils/taskContext';
import { OrganizableTab } from '../types';

const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE

/**
 * Ungrouped, unpinned web tabs in one window, in tab-strip order. Never includes TabPlex itself,
 * browser pages, incognito tabs, or tabs in any group (so the active Park & Resume task is safe).
 */
export async function getOrganizableTabs(windowId: number | undefined): Promise<OrganizableTab[]> {
    if (windowId === undefined) return [];
    const base = chrome.runtime.getURL('');
    const tabs = await chrome.tabs.query({ windowId });
    return tabs
        .filter(tab => tab.id !== undefined && !tab.pinned && !tab.incognito)
        .filter(tab => (tab.groupId ?? NO_GROUP) === NO_GROUP)
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

export async function currentWindowId(): Promise<number | undefined> {
    try {
        return (await chrome.windows.getCurrent()).id;
    } catch {
        return undefined;
    }
}
