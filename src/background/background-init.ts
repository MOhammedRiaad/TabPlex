import { getAllFolders, addFolder } from './storage';
import { openApp } from './open-app';

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(async details => {
    console.log('TabPlex extension installed', details);

    // On first install, open the onboarding page
    if (details.reason === 'install') {
        console.log('First install detected - opening onboarding page');
        const onboardingUrl = chrome.runtime.getURL('onboarding.html');
        await chrome.tabs.create({ url: onboardingUrl });
    }

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

// Open TabPlex in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => openApp());
