// What the background keeps of the tabs it records: closed tabs expire, and the list has a size limit.
import { deleteTabs, getAllTabs } from './storage';
import type { Tab } from '../types';
import { CLOSED_TAB_RETENTION_MS, MAX_TRACKED_TABS } from '../utils/tabTracking';

/** Ids to drop: tabs closed for longer than the retention time, then the oldest closed tabs while over the limit */
export function tabsToDrop(tabs: Tab[], now: number): string[] {
    const cutoff = now - CLOSED_TAB_RETENTION_MS;
    const drop = new Set<string>();
    for (const tab of tabs) {
        if (tab.status === 'closed' && new Date(tab.lastAccessed).getTime() < cutoff) drop.add(tab.id);
    }

    let excess = tabs.length - drop.size - MAX_TRACKED_TABS;
    if (excess > 0) {
        const oldestClosed = tabs
            .filter(tab => tab.status === 'closed' && !drop.has(tab.id))
            .sort((a, b) => new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime());
        for (const tab of oldestClosed) {
            if (excess <= 0) break;
            drop.add(tab.id);
            excess -= 1;
        }
    }
    return [...drop];
}

/** Removes what `tabsToDrop` picks and tells the open TabPlex tabs. Returns how many were removed. */
export async function pruneTabs(): Promise<number> {
    const ids = tabsToDrop(await getAllTabs(), Date.now());
    if (ids.length === 0) return 0;
    await deleteTabs(ids);
    for (const id of ids) {
        chrome.runtime.sendMessage({ type: 'STORAGE_TAB_DELETED', payload: { id } }).catch(() => {}); // No listener open
    }
    return ids.length;
}
