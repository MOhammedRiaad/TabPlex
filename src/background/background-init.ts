import { getAllFolders, addFolder } from './storage';

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(async () => {
    console.log('TabBoard extension installed');

    // Create a default board and folder if none exist
    const folders = await getAllFolders();

    if (folders.length === 0) {
        await addFolder({
            id: 'default_folder',
            name: 'Inbox',
            boardId: 'default_board',
            color: '#3b82f6',
            order: 0,
            createdAt: new Date().toISOString(),
        });
    }
});

// Open TabBoard in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(async _tab => {
    // Create or focus on a tab with the extension UI
    const url = chrome.runtime.getURL('index.html');

    try {
        // Check if we already have a TabBoard tab open
        const [existingTab] = await chrome.tabs.query({
            url: url,
            currentWindow: true,
        });

        if (existingTab && existingTab.windowId) {
            // Focus on the existing tab
            await chrome.tabs.update(existingTab.id!, { active: true });
            await chrome.windows.update(existingTab.windowId, { focused: true });
        } else {
            // Create a new tab with the extension UI
            await chrome.tabs.create({ url: url });
        }
    } catch {
        // If there's an error, create a new tab anyway
        await chrome.tabs.create({ url: url });
    }
});
