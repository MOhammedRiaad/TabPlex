// "Open" on a source in the review: switch to its tab when it is still open on the same page, otherwise open the
// address again in a new tab (spec §9).

/** The URL without its fragment: the same page */
const withoutFragment = (url: string) => url.split('#')[0];

/**
 * Brings the source's tab to the front (and its window), or opens the source's URL when the tab is gone or has moved
 * to another page.
 */
export async function openSource(source: { tabId: number; url: string }): Promise<void> {
    let tab: chrome.tabs.Tab | undefined;
    try {
        tab = await chrome.tabs.get(source.tabId);
    } catch {
        tab = undefined; // closed since the run: open the page again below
    }
    if (tab && tab.url !== undefined && withoutFragment(tab.url) === withoutFragment(source.url)) {
        await chrome.tabs.update(source.tabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        return;
    }
    await chrome.tabs.create({ url: source.url });
}
