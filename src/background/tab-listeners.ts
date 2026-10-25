import { getTabByBrowserId, updateTab } from './storage';

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async activeInfo => {
    const activeTab = await getTabByBrowserId(activeInfo.tabId);

    if (activeTab) {
        await updateTab({
            ...activeTab,
            lastAccessed: new Date().toISOString(),
        });

        // Notify the side panel about the update
        chrome.runtime
            .sendMessage({
                type: 'STORAGE_TAB_UPDATED',
                payload: {
                    ...activeTab,
                    lastAccessed: new Date().toISOString(),
                },
            })
            .catch(() => {}); // No listener open
    }
});
