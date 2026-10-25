// Opens TabPlex (index.html) in a tab: focuses the one in this window, or creates it.
// Used by the toolbar button and by the onboarding page's "Get started".

export async function openApp(): Promise<void> {
    const url = chrome.runtime.getURL('index.html');

    try {
        // Check if we already have a TabPlex tab open
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
}
