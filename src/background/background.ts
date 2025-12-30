import { 
  addTab, 
  updateTab, 
  deleteTab,
  getAllTabs,
  getAllFolders,
  addFolder,
  deleteFolder,
  getAllHistory,
  addHistory,
  updateHistory,
  deleteHistory,
  getHistory,
  getAllSessions,
  addSession,
  updateSession,
  deleteSession,
  getSession,
  deleteTask,
  deleteNote,
  addTask,
  addNote
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
  
  // Helper function to safely send response
  const safeSendResponse = (response: any) => {
    try {
      _sendResponse(response);
    } catch (error) {
      // Response already sent or channel closed
      console.warn('Failed to send response:', error);
    }
  };
  
  // Handle different message types
  switch (message.type) {
    case 'MOVE_TAB':
      // Handle tab movement between folders
      let moveTabResponseSent = false;
      
      handleMoveTab(message.payload).then(() => {
        if (!moveTabResponseSent) {
          moveTabResponseSent = true;
          safeSendResponse({ success: true });
        }
      }).catch(error => {
        if (!moveTabResponseSent) {
          moveTabResponseSent = true;
          safeSendResponse({ error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!moveTabResponseSent) {
          moveTabResponseSent = true;
          safeSendResponse({ success: true }); // Fallback response
        }
      }, 1000);
      
      return true;
    
    case 'ADD_TAB':
      // Add a tab
      if (message.payload) {
        let addTabResponseSent = false;
        
        addTab(message.payload).then(() => {
          // Notify the side panel about the addition
          chrome.runtime.sendMessage({
            type: 'STORAGE_TAB_ADDED',
            payload: message.payload
          }).catch(() => {}); // Ignore errors from sendMessage
          
          if (!addTabResponseSent) {
            addTabResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!addTabResponseSent) {
            addTabResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addTabResponseSent) {
            addTabResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
      
    case 'GET_ACTIVE_TAB':
      // Return information about the currently active tab
      let responseSent = false;
      
      getActiveTabInfo().then(tabInfo => {
        if (!responseSent) {
          responseSent = true;
          safeSendResponse(tabInfo);
        }
      }).catch(error => {
        if (!responseSent) {
          responseSent = true;
          safeSendResponse({ error: error.message });
        }
      });
      
      // Set a timeout to prevent hanging if the response isn't sent
      setTimeout(() => {
        if (!responseSent) {
          responseSent = true;
          safeSendResponse({ error: 'Timeout getting active tab info' });
        }
      }, 1000);
      
      return true;
      
    case 'CREATE_TAB_IN_FOLDER':
      // Create a new tab and associate it with a folder
      createTabInFolder(message.payload);
      safeSendResponse({ success: true });
      break;
    
    case 'ADD_TASK':
      // Add a task
      if (message.payload) {
        let addTaskResponseSent = false;
        
        addTask(message.payload).then(() => {
          // Notify the side panel about the addition
          chrome.runtime.sendMessage({
            type: 'STORAGE_TASK_ADDED',
            payload: message.payload
          }).catch(() => {}); // Ignore errors from sendMessage
          
          if (!addTaskResponseSent) {
            addTaskResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!addTaskResponseSent) {
            addTaskResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addTaskResponseSent) {
            addTaskResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_TAB':
      // Delete a tab
      if (message.payload && message.payload.id) {
        
        let deleteTabResponseSent = false;
        
        deleteTab(message.payload.id).then(() => {
          // Notify the side panel about the deletion
          chrome.runtime.sendMessage({
            type: 'STORAGE_TAB_DELETED',
            payload: { id: message.payload.id }
          }).catch(() => {}); // Ignore errors from sendMessage
          
          if (!deleteTabResponseSent) {
            deleteTabResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!deleteTabResponseSent) {
            deleteTabResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteTabResponseSent) {
            deleteTabResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    

    
    case 'GET_HISTORY':
      // Return browser history items
      
      let historyResponseSent = false;
      
      getAllHistory().then(history => {
        if (!historyResponseSent) {
          historyResponseSent = true;
          safeSendResponse(history);
        }
      }).catch(error => {
        if (!historyResponseSent) {
          historyResponseSent = true;
          safeSendResponse({ error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!historyResponseSent) {
          historyResponseSent = true;
          safeSendResponse({ error: 'Timeout getting history' }); // Fallback response
        }
      }, 1000);
      
      return true;
    
    case 'ADD_HISTORY':
      // Add a history item
      if (message.payload) {
        
        let addHistoryResponseSent = false;
        
        addHistory(message.payload).then(() => {
          if (!addHistoryResponseSent) {
            addHistoryResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!addHistoryResponseSent) {
            addHistoryResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addHistoryResponseSent) {
            addHistoryResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'UPDATE_HISTORY':
      // Update a history item
      if (message.payload) {
        
        let updateHistoryResponseSent = false;
        
        updateHistory(message.payload).then(() => {
          if (!updateHistoryResponseSent) {
            updateHistoryResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!updateHistoryResponseSent) {
            updateHistoryResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!updateHistoryResponseSent) {
            updateHistoryResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'ADD_FOLDER':
      // Add a folder
      if (message.payload) {
        
        let addFolderResponseSent = false;
        
        addFolder(message.payload).then(() => {
          // Notify the side panel about the addition
          chrome.runtime.sendMessage({
            type: 'STORAGE_FOLDER_ADDED',
            payload: message.payload
          }).catch(() => {}); // Ignore errors from sendMessage
          
          if (!addFolderResponseSent) {
            addFolderResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!addFolderResponseSent) {
            addFolderResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addFolderResponseSent) {
            addFolderResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_HISTORY':
      // Delete a history item
      if (message.payload && message.payload.id) {
        
        let deleteHistoryResponseSent = false;
        
        deleteHistory(message.payload.id).then(() => {
          if (!deleteHistoryResponseSent) {
            deleteHistoryResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!deleteHistoryResponseSent) {
            deleteHistoryResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteHistoryResponseSent) {
            deleteHistoryResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'ADD_BOARD':
      // Add a board
      if (message.payload) {
        
        let addBoardResponseSent = false;
        
        // Check if board already exists before adding
        chrome.storage.local.get(['tabboard_boards']).then((result: any) => {
          const boards: any[] = result['tabboard_boards'] || [];
          const boardId = message.payload.id;
          
          // Check if board already exists
          const existingIndex = boards.findIndex((board: any) => board.id === boardId);
          
          if (existingIndex !== -1) {
            // Update existing board instead of adding duplicate
            boards[existingIndex] = message.payload;
          } else {
            // Add new board
            boards.push(message.payload);
          }
          
          chrome.storage.local.set({ 'tabboard_boards': boards }).then(() => {
            // Only notify if it's a new board, not an update
            if (existingIndex === -1) {
              chrome.runtime.sendMessage({
                type: 'STORAGE_BOARD_ADDED',
                payload: message.payload
              }).catch(() => {}); // Ignore errors from sendMessage
            }
            
            if (!addBoardResponseSent) {
              addBoardResponseSent = true;
              safeSendResponse({ success: true });
            }
          }).catch(error => {
            if (!addBoardResponseSent) {
              addBoardResponseSent = true;
              safeSendResponse({ error: error.message });
            }
          });
        }).catch(error => {
          if (!addBoardResponseSent) {
            addBoardResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addBoardResponseSent) {
            addBoardResponseSent = true;
            safeSendResponse({ success: true }); // Fallback response
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_BOARD':
      // Delete a board
      if (message.payload && message.payload.id) {
        
        let deleteBoardResponseSent = false;
        
        // For now, we'll just delete the board from storage
        // In a real implementation, you might want to also delete associated folders/tabs
        chrome.storage.local.get(['tabboard_boards']).then((result: any) => {
          const boards: any[] = result['tabboard_boards'] || [];
          const filteredBoards = boards.filter((board: any) => board.id !== message.payload.id);
          
          chrome.storage.local.set({ 'tabboard_boards': filteredBoards }).then(() => {
            // Notify the side panel about the deletion
            chrome.runtime.sendMessage({
              type: 'STORAGE_BOARD_DELETED',
              payload: { id: message.payload.id }
            }).catch(() => {}); // Ignore errors from sendMessage
            
            if (!deleteBoardResponseSent) {
              deleteBoardResponseSent = true;
              safeSendResponse({ success: true });
            }
          }).catch(error => {
            if (!deleteBoardResponseSent) {
              deleteBoardResponseSent = true;
              safeSendResponse({ error: error.message });
            }
          });
        }).catch(error => {
          if (!deleteBoardResponseSent) {
            deleteBoardResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteBoardResponseSent) {
            deleteBoardResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_TASK':
      // Delete a task
      if (message.payload && message.payload.id) {
        
        let deleteTaskResponseSent = false;
        
        deleteTask(message.payload.id).then(() => {
          // Notify the side panel about the deletion
          chrome.runtime.sendMessage({
            type: 'STORAGE_TASK_DELETED',
            payload: { id: message.payload.id }
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!deleteTaskResponseSent) {
            deleteTaskResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!deleteTaskResponseSent) {
            deleteTaskResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteTaskResponseSent) {
            deleteTaskResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'GET_HISTORY_ITEM':
      // Get a specific history item
      if (message.payload && message.payload.id) {
        
        let getHistoryItemResponseSent = false;
        
        getHistory(message.payload.id).then(historyItem => {
          if (!getHistoryItemResponseSent) {
            getHistoryItemResponseSent = true;
            safeSendResponse(historyItem);
          }
        }).catch(error => {
          if (!getHistoryItemResponseSent) {
            getHistoryItemResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!getHistoryItemResponseSent) {
            getHistoryItemResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'GET_BROWSER_HISTORY':
      // Get actual browser history using chrome.history API
      
      let browserHistoryResponseSent = false;
      
      chrome.history.search({
        text: '',
        startTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // Last 30 days
        maxResults: 100
      }).then(browserHistory => {
        if (!browserHistoryResponseSent) {
          browserHistoryResponseSent = true;
          safeSendResponse(browserHistory);
        }
      }).catch(error => {
        if (!browserHistoryResponseSent) {
          browserHistoryResponseSent = true;
          safeSendResponse({ error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!browserHistoryResponseSent) {
          browserHistoryResponseSent = true;
        }
      }, 3000); // Longer timeout for history search
      
      return true;
    
    case 'GET_SESSIONS':
      // Return all sessions
      
      let sessionsResponseSent = false;
      
      getAllSessions().then(sessions => {
        if (!sessionsResponseSent) {
          sessionsResponseSent = true;
          safeSendResponse(sessions);
        }
      }).catch(error => {
        if (!sessionsResponseSent) {
          sessionsResponseSent = true;
          safeSendResponse({ error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!sessionsResponseSent) {
          sessionsResponseSent = true;
        }
      }, 1000);
      
      return true;
    
    case 'ADD_SESSION':
      // Add a session
      if (message.payload) {
        
        let addSessionResponseSent = false;
        
        addSession(message.payload).then(() => {
          if (!addSessionResponseSent) {
            addSessionResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!addSessionResponseSent) {
            addSessionResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addSessionResponseSent) {
            addSessionResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'UPDATE_SESSION':
      // Update a session
      if (message.payload) {
        
        let updateSessionResponseSent = false;
        
        updateSession(message.payload).then(() => {
          if (!updateSessionResponseSent) {
            updateSessionResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!updateSessionResponseSent) {
            updateSessionResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!updateSessionResponseSent) {
            updateSessionResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_SESSION':
      // Delete a session
      if (message.payload && message.payload.id) {
        
        let deleteSessionResponseSent = false;
        
        deleteSession(message.payload.id).then(() => {
          if (!deleteSessionResponseSent) {
            deleteSessionResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!deleteSessionResponseSent) {
            deleteSessionResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteSessionResponseSent) {
            deleteSessionResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_FOLDER':
      // Delete a folder
      if (message.payload && message.payload.id) {
        
        let deleteFolderResponseSent = false;
        
        // First, get all tabs to check if the folder has any tabs
        getAllTabs().then(allTabs => {
          const tabsInFolder = allTabs.filter(tab => tab.folderId === message.payload.id);
          
          if (tabsInFolder.length > 0) {
            // Folder has tabs - check if we should move them or delete them
            if (message.payload.moveTabs) {
              // Move tabs to another folder
              const updatedTabs = tabsInFolder.map(tab => ({
                ...tab,
                folderId: message.payload.targetFolderId || ''
              }));
              
              // Save updated tabs
              return Promise.all(updatedTabs.map(tab => updateTab(tab)));
            } else {
              // Delete the tabs in the folder
              return Promise.all(tabsInFolder.map(tab => deleteTab(tab.id)));
            }
          }
        }).then(() => {
          // Now delete the folder itself
          return deleteFolder(message.payload.id);
        }).then(() => {
          // Notify the side panel about the deletion
          chrome.runtime.sendMessage({
            type: 'STORAGE_FOLDER_DELETED',
            payload: { id: message.payload.id }
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!deleteFolderResponseSent) {
            deleteFolderResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!deleteFolderResponseSent) {
            deleteFolderResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteFolderResponseSent) {
            deleteFolderResponseSent = true;
            safeSendResponse({ error: 'Delete folder timed out' });
          }
        }, 2000);
        
        return true;
      }
      break;
    
    case 'ADD_NOTE':
      // Add a note
      if (message.payload) {
        
        let addNoteResponseSent = false;
        
        addNote(message.payload).then(() => {
          // Notify the side panel about the addition
          chrome.runtime.sendMessage({
            type: 'STORAGE_NOTE_ADDED',
            payload: message.payload
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!addNoteResponseSent) {
            addNoteResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!addNoteResponseSent) {
            addNoteResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!addNoteResponseSent) {
            addNoteResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'DELETE_NOTE':
      // Delete a note
      if (message.payload && message.payload.id) {
        
        let deleteNoteResponseSent = false;
        
        deleteNote(message.payload.id).then(() => {
          // Notify the side panel about the deletion
          chrome.runtime.sendMessage({
            type: 'STORAGE_NOTE_DELETED',
            payload: { id: message.payload.id }
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!deleteNoteResponseSent) {
            deleteNoteResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!deleteNoteResponseSent) {
            deleteNoteResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!deleteNoteResponseSent) {
            deleteNoteResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'GET_SESSION':
      // Get a specific session
      if (message.payload && message.payload.id) {
        
        let getSessionResponseSent = false;
        
        getSession(message.payload.id).then(session => {
          if (!getSessionResponseSent) {
            getSessionResponseSent = true;
            safeSendResponse(session);
          }
        }).catch(error => {
          if (!getSessionResponseSent) {
            getSessionResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!getSessionResponseSent) {
            getSessionResponseSent = true;
          }
        }, 1000);
        
        return true;
      }
      break;
    
    case 'SESSION_INFERENCE_COMPLETE':
      // Handle session inference completion
      // This message is sent from the inferSessions function
      // We don't need to send a response for this
      console.log('Session inference completed:', message.payload);
      break;
    
    case 'EXPORT_ALL_DATA':
      // Export all data from storage
      
      let exportAllResponseSent = false;
      
      Promise.all([
        chrome.storage.local.get(['tabboard_boards']).then(result => result['tabboard_boards'] || []),
        chrome.storage.local.get(['tabboard_folders']).then(result => result['tabboard_folders'] || []),
        chrome.storage.local.get(['tabboard_tabs']).then(result => result['tabboard_tabs'] || []),
        chrome.storage.local.get(['tabboard_tasks']).then(result => result['tabboard_tasks'] || []),
        chrome.storage.local.get(['tabboard_notes']).then(result => result['tabboard_notes'] || []),
        chrome.storage.local.get(['tabboard_sessions']).then(result => result['tabboard_sessions'] || []),
        chrome.storage.local.get(['tabboard_history']).then(result => result['tabboard_history'] || [])
      ]).then(([boards, folders, tabs, tasks, notes, sessions, history]) => {
        if (!exportAllResponseSent) {
          exportAllResponseSent = true;
          safeSendResponse({
            boards,
            folders,
            tabs,
            tasks,
            notes,
            sessions,
            history
          });
        }
      }).catch(error => {
        if (!exportAllResponseSent) {
          exportAllResponseSent = true;
          safeSendResponse({ error: error.message });
        }
      });
      
      setTimeout(() => {
        if (!exportAllResponseSent) {
          exportAllResponseSent = true;
          safeSendResponse({ error: 'Export timed out' });
        }
      }, 2000);
      
      return true;
      
    case 'IMPORT_ALL_DATA':
      // Import all data to storage
      if (message.payload) {
        
        let importAllResponseSent = false;
        
        const { boards, folders, tabs, tasks, notes, sessions, history } = message.payload;
        
        // Save all data to storage
        Promise.all([
          chrome.storage.local.set({ 'tabboard_boards': boards }),
          chrome.storage.local.set({ 'tabboard_folders': folders }),
          chrome.storage.local.set({ 'tabboard_tabs': tabs }),
          chrome.storage.local.set({ 'tabboard_tasks': tasks }),
          chrome.storage.local.set({ 'tabboard_notes': notes }),
          chrome.storage.local.set({ 'tabboard_sessions': sessions }),
          chrome.storage.local.set({ 'tabboard_history': history })
        ]).then(() => {
          // Notify the UI about the import completion
          chrome.runtime.sendMessage({
            type: 'STORAGE_DATA_IMPORTED'
          }).catch(() => {}); // Suppress errors if message listener is unavailable
          
          if (!importAllResponseSent) {
            importAllResponseSent = true;
            safeSendResponse({ success: true });
          }
        }).catch(error => {
          if (!importAllResponseSent) {
            importAllResponseSent = true;
            safeSendResponse({ error: error.message });
          }
        });
        
        setTimeout(() => {
          if (!importAllResponseSent) {
            importAllResponseSent = true;
            safeSendResponse({ error: 'Import timed out' });
          }
        }, 2000);
        
        return true;
      }
      break;
      
    default:
      safeSendResponse({ error: 'Unknown message type' });
      break;
  }
  
  // Return false for synchronous operations (response already sent)
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

// Function to infer sessions based on tab usage patterns
async function inferSessions() {
  try {
    // Get all tabs from storage
    const allTabs = await getAllTabs();
    const now = new Date();
    
    // Group tabs by recency and patterns
    // For now, let's create sessions based on tabs accessed in the last hour
    const recentThreshold = new Date(now.getTime() - (60 * 60 * 1000)); // 1 hour ago
    const recentTabs = allTabs.filter(tab => new Date(tab.lastAccessed) > recentThreshold);
    
    if (recentTabs.length > 0) {
      // Create a session for recently accessed tabs
      const session = {
        id: `session_${Date.now()}`,
        name: `Recent Activity Session - ${now.toLocaleString()}`,
        tabIds: recentTabs.map(tab => tab.id),
        startTime: recentThreshold.toISOString(),
        endTime: now.toISOString(),
        createdAt: now.toISOString()
      };
      
      // Add the inferred session to storage
      await addSession(session);
      
      // Notify the UI about the new session
      chrome.runtime.sendMessage({
        type: 'SESSION_INFERENCE_COMPLETE',
        payload: session
      });
    }
  } catch (error) {
    console.error('Error inferring sessions:', error);
  }
}

// Set up automatic session inference periodically
// Check for session patterns every 30 minutes
setInterval(inferSessions, 30 * 60 * 1000); // 30 minutes

// Also infer sessions when the extension starts
chrome.runtime.onStartup.addListener(() => {
  // Small delay to ensure everything is loaded
  setTimeout(inferSessions, 5000); // 5 seconds after startup
});

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
