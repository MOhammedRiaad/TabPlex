import { isCapturableUrl } from '../../../utils/taskContext';
import { STORE_PAGES } from '../constants';
import { ReadableTab, UnreadableReason } from '../types';
import { originPatternFor } from './pageAccess';

const WEB_URL = /^https?:/i;

/** The URL without its fragment, used to spot the same page open in two tabs */
const withoutFragment = (url: string) => url.split('#')[0];

function isStorePage(url: string): boolean {
    const { hostname, pathname } = new URL(url);
    return STORE_PAGES.some(
        store => hostname === store.host && (store.pathPrefix === undefined || pathname.startsWith(store.pathPrefix))
    );
}

/** The first reason the page cannot be read, in the order the dialog explains them */
function unreadableReason(tab: chrome.tabs.Tab, url: string): UnreadableReason | undefined {
    if (isStorePage(url)) return 'blocked-site';
    if (new URL(url).pathname.toLowerCase().endsWith('.pdf')) return 'pdf';
    if (tab.discarded || tab.frozen) return 'asleep';
    if (tab.status !== 'complete') return 'loading';
    return undefined;
}

/**
 * Web tabs of one window that the "Summarize open tabs" dialog lists, in tab-strip order. Pinned and grouped tabs
 * are included: reading does not change them. Incognito tabs, browser pages, TabPlex itself and tabs without a
 * committed http(s) URL are not listed. Tabs that cannot be read are listed greyed out with a reason.
 */
export async function collectReadableTabs(windowId: number | undefined): Promise<ReadableTab[]> {
    if (windowId === undefined) return [];
    const base = chrome.runtime.getURL('');
    const tabs = await chrome.tabs.query({ windowId });
    const firstTabForUrl = new Map<string, number>();
    const result: ReadableTab[] = [];

    for (const tab of tabs) {
        const url = tab.url;
        if (tab.id === undefined || tab.incognito || url === undefined) continue;
        if (!isCapturableUrl(url, base) || !WEB_URL.test(url)) continue;

        const id = tab.id;
        const key = withoutFragment(url);
        const duplicateOf = firstTabForUrl.get(key);
        if (duplicateOf === undefined) firstTabForUrl.set(key, id);

        const reason = unreadableReason(tab, url);
        result.push({
            id,
            windowId: tab.windowId,
            title: tab.title || url,
            url,
            favicon: tab.favIconUrl || undefined,
            originPattern: originPatternFor(url),
            readable: reason === undefined,
            reason,
            duplicateOf,
        });
    }
    return result;
}
