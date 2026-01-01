import { getAllTabs, updateTab } from './storage';

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const allTabs = await getAllTabs();
  const activeTab = allTabs.find(t => t.tabId === activeInfo.tabId);
  
  if (activeTab) {
    await updateTab({
      ...activeTab,
      lastAccessed: new Date().toISOString()
    });
    
    // Notify the side panel about the update
    chrome.runtime.sendMessage({
      type: 'STORAGE_TAB_UPDATED',
      payload: {
        ...activeTab,
        lastAccessed: new Date().toISOString()
      }
    });
  }
});