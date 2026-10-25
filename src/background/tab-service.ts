import { addTab, updateTab, getAllTabs } from './storage';
import { pruneTabs } from './tab-retention';
import type { Tab } from '../types';
import { isTrackingEnabled, MAX_TRACKED_TABS } from '../utils/tabTracking';

// Listen for tab updates (creation, updates, removal)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if this tab is already in our storage
        const allTabs = await getAllTabs();
        const existingTab = allTabs.find(t => t.tabId === tabId);

        if (existingTab) {
            // Update existing tab
            await updateTab({
                ...existingTab,
                title: tab.title || tab.url,
                url: tab.url,
                favicon: tab.favIconUrl,
                lastAccessed: new Date().toISOString(),
                status: 'open',
            });
        } else if (await isTrackingEnabled()) {
            // Add new tab to storage if it's not already tracked (only when the user lets TabPlex record every page)
            // For now, we'll add it to the default folder
            await addTab({
                id: `tab_${Date.now()}_${tabId}`,
                title: tab.title || tab.url,
                url: tab.url,
                favicon: tab.favIconUrl || '',
                folderId: 'default_folder', // Default folder
                tabId: tabId,
                lastAccessed: new Date().toISOString(),
                status: 'open',
                createdAt: new Date().toISOString(),
            });
            // The list has a size limit: drop the oldest closed tabs now rather than wait for the daily cleanup
            if (allTabs.length >= MAX_TRACKED_TABS) await pruneTabs();
        }
    }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(async tabId => {
    const allTabs = await getAllTabs();
    const tabToRemove = allTabs.find(t => t.tabId === tabId);

    if (tabToRemove) {
        await updateTab({
            ...tabToRemove,
            status: 'closed',
            lastAccessed: new Date().toISOString(),
        });
    }
});

// Function to handle moving a tab to a different folder
export async function handleMoveTab(payload: { tabId: string; newFolderId: string }) {
    const allTabs = await getAllTabs();
    const tabToMove = allTabs.find(t => t.id === payload.tabId);

    if (tabToMove) {
        await updateTab({
            ...tabToMove,
            folderId: payload.newFolderId,
        });

        // Notify the side panel about the change
        chrome.runtime
            .sendMessage({
                type: 'STORAGE_TAB_UPDATED',
                payload: {
                    ...tabToMove,
                    folderId: payload.newFolderId,
                },
            })
            .catch(() => {}); // No listener open
    }
}

// Function to get information about the active tab
export async function getActiveTabInfo() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });

    if (tab) {
        return {
            id: `tab_${Date.now()}_${tab.id}`,
            title: tab.title || tab.url || '',
            url: tab.url || '',
            favicon: tab.favIconUrl || '',
            tabId: tab.id,
        };
    }

    return null;
}

// Function to create a new tab and associate it with a folder
export async function createTabInFolder(payload: { url: string; folderId: string }) {
    chrome.tabs.create({ url: payload.url }, async tab => {
        if (tab) {
            const newTab: Tab = {
                id: `tab_${Date.now()}_${tab.id}`,
                title: tab.title || payload.url,
                url: payload.url,
                favicon: tab.favIconUrl || '',
                folderId: payload.folderId,
                tabId: tab.id || null,
                lastAccessed: new Date().toISOString(),
                status: 'open',
                createdAt: new Date().toISOString(),
            };

            await addTab(newTab);

            // Notify the side panel about the new tab
            chrome.runtime
                .sendMessage({
                    type: 'STORAGE_TAB_ADDED',
                    payload: newTab,
                })
                .catch(() => {}); // No listener open
        }
    });
}
