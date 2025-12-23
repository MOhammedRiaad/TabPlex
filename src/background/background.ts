import { 
  addTab, 
  updateTab, 
  deleteTab,
  getAllTabs,
  getAllFolders,
  addFolder
} from './storage';

// Reimport the interfaces to avoid conflicts
interface Tab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  folderId: string;
  tabId: number | null;
  lastAccessed: string;
  status: 'open' | 'suspended' | 'closed';
  createdAt: string;
}

// interface Folder {
//   id: string;
//   name: string;
//   boardId: string;
//   color: string;
//   order: number;
//   createdAt: string;
//   rules?: FolderRule[];
// }

// interface FolderRule {
//   id: string;
//   condition: string;
//   value: string;
//   action: string;
// }

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
      createdAt: new Date().toISOString()
    });
  }
});

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
        status: 'open'
      });
    } else {
      // Add new tab to storage if it's not already tracked
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
        createdAt: new Date().toISOString()
      });
    }
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const allTabs = await getAllTabs();
  const tabToRemove = allTabs.find(t => t.tabId === tabId);
  
  if (tabToRemove) {
    await updateTab({
      ...tabToRemove,
      status: 'closed',
      lastAccessed: new Date().toISOString()
    });
  }
});

// Open TabBoard in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(async (_tab) => {
  // Create or focus on a tab with the extension UI
  const url = chrome.runtime.getURL("index.html");
  
  try {
    // Check if we already have a TabBoard tab open
    const [existingTab] = await chrome.tabs.query({
      url: url,
      currentWindow: true
    });
    
    if (existingTab && existingTab.windowId) {
      // Focus on the existing tab
      await chrome.tabs.update(existingTab.id!, { active: true });
      await chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
      // Create a new tab with the extension UI
      await chrome.tabs.create({ url: url });
    }
  } catch (error) {
    // If there's an error, create a new tab anyway
    await chrome.tabs.create({ url: url });
  }
});

// Listen for messages from the popup/tab
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  console.log('Background received message:', message);
  
  let handledAsynchronously = false;
  
  // Handle different message types
  switch (message.type) {
    case 'MOVE_TAB':
      // Handle tab movement between folders
      handleMoveTab(message.payload);
      _sendResponse({ success: true });
      break;
      
    case 'GET_ACTIVE_TAB':
      // Return information about the currently active tab
      // Use a flag to track if response was sent
      let responseSent = false;
      
      getActiveTabInfo().then(tabInfo => {
        if (!responseSent) {
          responseSent = true;
          _sendResponse(tabInfo);
        }
      }).catch(error => {
        if (!responseSent) {
          responseSent = true;
          _sendResponse({ error: error.message });
        }
      });
      
      // Set a timeout to prevent hanging if the response isn't sent
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true;
          // Don't send response if channel is closed
        }
      }, 1000); // 1 second timeout
      
      return true; // Required to keep message channel open for async response
      
    case 'CREATE_TAB_IN_FOLDER':
      // Create a new tab and associate it with a folder
      createTabInFolder(message.payload);
      _sendResponse({ success: true });
      break;
    
    default:
      _sendResponse({ error: 'Unknown message type' });
      break;
  }
  
  // Only return true if we're handling asynchronously
  if (handledAsynchronously) {
    return true;
  }
  
  // For synchronous operations, don't return anything or return false
  return false;
});

// Function to handle moving a tab to a different folder
async function handleMoveTab(payload: { tabId: string; newFolderId: string }) {
  const allTabs = await getAllTabs();
  const tabToMove = allTabs.find(t => t.id === payload.tabId);
  
  if (tabToMove) {
    await updateTab({
      ...tabToMove,
      folderId: payload.newFolderId
    });
    
    // Notify the side panel about the change
    chrome.runtime.sendMessage({
      type: 'STORAGE_TAB_UPDATED',
      payload: {
        ...tabToMove,
        folderId: payload.newFolderId
      }
    });
  }
}

// Function to get information about the active tab
async function getActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ 
    active: true, 
    currentWindow: true 
  });
  
  if (tab) {
    return {
      id: `tab_${Date.now()}_${tab.id}`,
      title: tab.title || tab.url || '',
      url: tab.url || '',
      favicon: tab.favIconUrl || '',
      tabId: tab.id
    };
  }
  
  return null;
}

// Function to create a new tab and associate it with a folder
async function createTabInFolder(payload: { url: string; folderId: string }) {
  chrome.tabs.create({ url: payload.url }, async (tab) => {
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
        createdAt: new Date().toISOString()
      };
      
      await addTab(newTab);
      
      // Notify the side panel about the new tab
      chrome.runtime.sendMessage({
        type: 'STORAGE_TAB_ADDED',
        payload: newTab
      });
    }
  });
}

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