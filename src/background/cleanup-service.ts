import { getAllTabs, deleteTab } from './storage';

// Periodically clean up closed tabs (remove them after a certain period)
setInterval(async () => {
  const allTabs = await getAllTabs();
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days ago
  
  for (const tab of allTabs) {
    if (tab.status === 'closed') {
      const tabDate = new Date(tab.lastAccessed);
      if (tabDate < cutoffDate) {
        // Remove tabs that have been closed for more than 30 days
        await deleteTab(tab.id);
        
        // Notify the side panel about the deletion
        chrome.runtime.sendMessage({
          type: 'STORAGE_TAB_DELETED',
          payload: { id: tab.id }
        });
      }
    }
  }
}, 24 * 60 * 60 * 1000); // Run cleanup daily