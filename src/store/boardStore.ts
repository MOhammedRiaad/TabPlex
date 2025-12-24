import { create } from 'zustand';
import { Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';

interface BoardState {
  boards: Board[];
  folders: Folder[];
  tabs: Tab[];
  tasks: Task[];
  notes: Note[];
  sessions: Session[];
  history: HistoryItem[];
  addBoard: (board: Omit<Board, 'createdAt' | 'updatedAt'>) => void;
  updateBoard: (id: string, updates: Partial<Omit<Board, 'id' | 'createdAt'>>) => void;
  deleteBoard: (id: string) => void;
  deleteBoardSilently: (id: string) => void;
  addFolder: (folder: Omit<Folder, 'createdAt'>) => void;
  updateFolder: (id: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => void;
  deleteFolder: (id: string) => void;
  deleteFolderSilently: (id: string) => void;
  addTab: (tab: Omit<Tab, 'createdAt'>) => void;
  updateTab: (id: string, updates: Partial<Omit<Tab, 'id' | 'createdAt'>>) => void;
  deleteTab: (id: string) => void;
  deleteTabSilently: (id: string) => void;
  moveTab: (tabId: string, newFolderId: string) => void;
  addTask: (task: Omit<Task, 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteTask: (id: string) => void;
  deleteTaskSilently: (id: string) => void;
  addNote: (note: Omit<Note, 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteNote: (id: string) => void;
  deleteNoteSilently: (id: string) => void;
  addSession: (session: Omit<Session, 'createdAt'>) => void;
  updateSession: (id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>) => void;
  deleteSession: (id: string) => void;
  deleteSessionSilently: (id: string) => void;
  addHistory: (history: Omit<HistoryItem, 'createdAt'>) => void;
  updateHistory: (id: string, updates: Partial<Omit<HistoryItem, 'id' | 'createdAt'>>) => void;
  deleteHistory: (id: string) => void;
  fetchHistory: () => Promise<void>;
  fetchBrowserHistory: () => Promise<chrome.history.HistoryItem[]>;
  fetchSessions: () => Promise<void>;
  addSessionFromBackground: (session: Omit<Session, 'createdAt'>) => Promise<void>;
  updateSessionFromBackground: (id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>) => Promise<void>;
  deleteSessionFromBackground: (id: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  folders: [],
  tabs: [],
  tasks: [],
  notes: [],
  sessions: [],
  history: [],
  
  addBoard: (board) => {
    const newBoard = {
      ...board,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Update local state
    set((state) => ({
      boards: [
        ...state.boards,
        newBoard
      ]
    }));
    
    // Add to IndexedDB
    import('../utils/storage').then(({ addBoard: addBoardToIndexedDB }) => {
      addBoardToIndexedDB(newBoard).catch(error => {
        console.error('Error adding board to IndexedDB:', error);
      });
    });
    
    // Send message to background script to add to chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'ADD_BOARD',
      payload: newBoard
    }).catch(error => {
      console.error('Error adding board to storage:', error);
    });
  },
  
  addHistory: (history) => set((state) => ({
    history: [
      ...state.history,
      {
        ...history,
        createdAt: new Date().toISOString()
      }
    ]
  })),
  
  updateHistory: (id, updates) => set((state) => ({
    history: state.history.map(historyItem => 
      historyItem.id === id 
        ? { ...historyItem, ...updates } 
        : historyItem
    )
  })),
  
  deleteHistory: (id) => set((state) => ({
    history: state.history.filter(historyItem => historyItem.id !== id)
  })),
  
  fetchHistory: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_HISTORY'
      });
      
      if (response && !response.error) {
        set({ history: response });
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  },
  
  fetchBrowserHistory: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_BROWSER_HISTORY'
      });
      
      if (response && !response.error) {
        // Transform chrome.history items to our HistoryItem format
        const transformedHistory = response.map((item: chrome.history.HistoryItem) => ({
          id: item.id,
          url: item.url || '',
          title: item.title || '',
          lastVisitTime: item.lastVisitTime ? new Date(item.lastVisitTime).toISOString() : undefined,
          visitCount: item.visitCount,
          typedCount: item.typedCount,
          favicon: undefined, // Chrome history doesn't provide favicons directly
          createdAt: new Date().toISOString()
        }));
        
        set(state => ({
          history: [
            ...state.history,
            ...transformedHistory.filter((newItem: HistoryItem) => 
              !state.history.some(existingItem => existingItem.id === newItem.id)
            )
          ]
        }));
        
        return response;
      }
    } catch (error) {
      console.error('Error fetching browser history:', error);
      throw error;
    }
    
    return [];
  },
  
  updateBoard: (id, updates) => set((state) => ({
    boards: state.boards.map(board => 
      board.id === id 
        ? { ...board, ...updates, updatedAt: new Date().toISOString() } 
        : board
    )
  })),
  
  deleteBoard: (id) => {
    // Update local state immediately
    set((state) => ({
      boards: state.boards.filter(board => board.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteBoard: deleteBoardFromIndexedDB }) => {
      deleteBoardFromIndexedDB(id).catch(error => {
        console.error('Error deleting board from IndexedDB:', error);
      });
    });
    
    // Send message to background script to delete from chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'DELETE_BOARD',
      payload: { id }
    }).catch(error => {
      console.error('Error deleting board from storage:', error);
    });
  },
  
  // Internal function to delete board without sending message to background
  // Used when receiving delete message from background to avoid loop
  deleteBoardSilently: (id) => {
    // Update local state
    set((state) => ({
      boards: state.boards.filter(board => board.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteBoard: deleteBoardFromIndexedDB }) => {
      deleteBoardFromIndexedDB(id).catch(error => {
        console.error('Error deleting board from IndexedDB:', error);
      });
    });
  },
  
  addFolder: (folder) => {
    const newFolder = {
      ...folder,
      createdAt: new Date().toISOString()
    };
    
    // Update local state
    set((state) => ({
      folders: [
        ...state.folders,
        newFolder
      ]
    }));
    
    // Add to IndexedDB
    import('../utils/storage').then(({ addFolder: addFolderToIndexedDB }) => {
      addFolderToIndexedDB(newFolder).catch(error => {
        console.error('Error adding folder to IndexedDB:', error);
      });
    });
    
    // Send message to background script to add to chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'ADD_FOLDER',
      payload: newFolder
    }).catch(error => {
      console.error('Error adding folder to storage:', error);
    });
  },
  
  updateFolder: (id, updates) => set((state) => ({
    folders: state.folders.map(folder => 
      folder.id === id 
        ? { ...folder, ...updates } 
        : folder
    )
  })),
  
  deleteFolder: (id) => {
    // Update local state immediately
    set((state) => ({
      folders: state.folders.filter(folder => folder.id !== id),
      // Also remove tabs in this folder
      tabs: state.tabs.filter(tab => tab.folderId !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteFolder: deleteFolderFromIndexedDB }) => {
      deleteFolderFromIndexedDB(id).catch(error => {
        console.error('Error deleting folder from IndexedDB:', error);
      });
    });
    
    // Send message to background script to delete from chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'DELETE_FOLDER',
      payload: { id }
    }).catch(error => {
      console.error('Error deleting folder from storage:', error);
    });
  },
  
  // Internal function to delete folder without sending message to background
  // Used when receiving delete message from background to avoid loop
  deleteFolderSilently: (id) => {
    // Update local state
    set((state) => ({
      folders: state.folders.filter(folder => folder.id !== id),
      // Also remove tabs in this folder
      tabs: state.tabs.filter(tab => tab.folderId !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteFolder: deleteFolderFromIndexedDB }) => {
      deleteFolderFromIndexedDB(id).catch(error => {
        console.error('Error deleting folder from IndexedDB:', error);
      });
    });
  },
  
  addTab: (tab) => {
    const newTab = {
      ...tab,
      createdAt: new Date().toISOString()
    };
    
    // Update local state
    set((state) => ({
      tabs: [
        ...state.tabs,
        newTab
      ]
    }));
    
    // Add to IndexedDB
    import('../utils/storage').then(({ addTab: addTabToIndexedDB }) => {
      addTabToIndexedDB(newTab).catch(error => {
        console.error('Error adding tab to IndexedDB:', error);
      });
    });
    
    // Send message to background script to add to chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'ADD_TAB',
      payload: newTab
    }).catch(error => {
      console.error('Error adding tab to storage:', error);
    });
  },
  
  updateTab: (id, updates) => set((state) => ({
    tabs: state.tabs.map(tab => 
      tab.id === id 
        ? { ...tab, ...updates } 
        : tab
    )
  })),
  
  deleteTab: (id) => {
    // Update local state immediately
    set((state) => ({
      tabs: state.tabs.filter(tab => tab.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteTab: deleteTabFromIndexedDB }) => {
      deleteTabFromIndexedDB(id).catch(error => {
        console.error('Error deleting tab from IndexedDB:', error);
      });
    });
    
    // Send message to background script to delete from chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'DELETE_TAB',
      payload: { id }
    }).catch(error => {
      console.error('Error deleting tab from storage:', error);
      // If deletion failed, we might want to revert the UI change
      // For now, we'll just log the error
    });
  },
  
  // Internal function to delete tab without sending message to background
  // Used when receiving delete message from background to avoid loop
  deleteTabSilently: (id) => {
    // Update local state
    set((state) => ({
      tabs: state.tabs.filter(tab => tab.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteTab: deleteTabFromIndexedDB }) => {
      deleteTabFromIndexedDB(id).catch(error => {
        console.error('Error deleting tab from IndexedDB:', error);
      });
    });
  },

  
  moveTab: (tabId, newFolderId) => set((state) => ({
    tabs: state.tabs.map(tab => 
      tab.id === tabId 
        ? { ...tab, folderId: newFolderId } 
        : tab
    )
  })),
  
  addTask: (task) => {
    const newTask = {
      ...task,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Update local state
    set((state) => ({
      tasks: [
        ...state.tasks,
        newTask
      ]
    }));
    
    // Add to IndexedDB
    import('../utils/storage').then(({ addTask: addTaskToIndexedDB }) => {
      addTaskToIndexedDB(newTask).catch(error => {
        console.error('Error adding task to IndexedDB:', error);
      });
    });
    
    // Send message to background script to add to chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'ADD_TASK',
      payload: newTask
    }).catch(error => {
      console.error('Error adding task to storage:', error);
    });
  },
  
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(task => 
      task.id === id 
        ? { ...task, ...updates, updatedAt: new Date().toISOString() } 
        : task
    )
  })),
  
  deleteTask: (id) => {
    // Update local state immediately
    set((state) => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteTask: deleteTaskFromIndexedDB }) => {
      deleteTaskFromIndexedDB(id).catch(error => {
        console.error('Error deleting task from IndexedDB:', error);
      });
    });
    
    // Send message to background script to delete from chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'DELETE_TASK',
      payload: { id }
    }).catch(error => {
      console.error('Error deleting task from storage:', error);
    });
  },
  
  // Internal function to delete task without sending message to background
  // Used when receiving delete message from background to avoid loop
  deleteTaskSilently: (id) => {
    // Update local state
    set((state) => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteTask: deleteTaskFromIndexedDB }) => {
      deleteTaskFromIndexedDB(id).catch(error => {
        console.error('Error deleting task from IndexedDB:', error);
      });
    });
  },
  
  addNote: (note) => {
    const newNote = {
      ...note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Update local state
    set((state) => ({
      notes: [
        ...state.notes,
        newNote
      ]
    }));
    
    // Add to IndexedDB
    import('../utils/storage').then(({ addNote: addNoteToIndexedDB }) => {
      addNoteToIndexedDB(newNote).catch(error => {
        console.error('Error adding note to IndexedDB:', error);
      });
    });
    
    // Send message to background script to add to chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'ADD_NOTE',
      payload: newNote
    }).catch(error => {
      console.error('Error adding note to storage:', error);
    });
  },
  
  updateNote: (id, updates) => set((state) => ({
    notes: state.notes.map(note => 
      note.id === id 
        ? { ...note, ...updates, updatedAt: new Date().toISOString() } 
        : note
    )
  })),
  
  deleteNote: (id) => {
    // Update local state immediately
    set((state) => ({
      notes: state.notes.filter(note => note.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteNote: deleteNoteFromIndexedDB }) => {
      deleteNoteFromIndexedDB(id).catch(error => {
        console.error('Error deleting note from IndexedDB:', error);
      });
    });
    
    // Send message to background script to delete from chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'DELETE_NOTE',
      payload: { id }
    }).catch(error => {
      console.error('Error deleting note from storage:', error);
    });
  },
  
  // Internal function to delete note without sending message to background
  // Used when receiving delete message from background to avoid loop
  deleteNoteSilently: (id) => {
    // Update local state
    set((state) => ({
      notes: state.notes.filter(note => note.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteNote: deleteNoteFromIndexedDB }) => {
      deleteNoteFromIndexedDB(id).catch(error => {
        console.error('Error deleting note from IndexedDB:', error);
      });
    });
  },
  
  addSession: (session) => {
    const newSession = {
      ...session,
      tabIds: session.tabIds || [],
      createdAt: new Date().toISOString()
    };
    
    // Update local state
    set((state) => ({
      sessions: [
        ...state.sessions,
        newSession
      ]
    }));
    
    // Add to IndexedDB
    import('../utils/storage').then(({ addSession: addSessionToIndexedDB }) => {
      addSessionToIndexedDB(newSession).catch(error => {
        console.error('Error adding session to IndexedDB:', error);
      });
    });
    
    // Send message to background script to add to chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'ADD_SESSION',
      payload: newSession
    }).catch(error => {
      console.error('Error adding session to storage:', error);
    });
  },
  
  updateSession: (id, updates) => set((state) => ({
    sessions: state.sessions.map(session => 
      session.id === id 
        ? { ...session, ...updates } 
        : session
    )
  })),
  
  deleteSession: (id) => {
    // Update local state immediately
    set((state) => ({
      sessions: state.sessions.filter(session => session.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteSession: deleteSessionFromIndexedDB }) => {
      deleteSessionFromIndexedDB(id).catch(error => {
        console.error('Error deleting session from IndexedDB:', error);
      });
    });
    
    // Send message to background script to delete from chrome.storage.local
    chrome.runtime.sendMessage({
      type: 'DELETE_SESSION',
      payload: { id }
    }).catch(error => {
      console.error('Error deleting session from storage:', error);
    });
  },
  
  // Internal function to delete session without sending message to background
  // Used when receiving delete message from background to avoid loop
  deleteSessionSilently: (id) => {
    // Update local state
    set((state) => ({
      sessions: state.sessions.filter(session => session.id !== id)
    }));
    
    // Delete from IndexedDB
    import('../utils/storage').then(({ deleteSession: deleteSessionFromIndexedDB }) => {
      deleteSessionFromIndexedDB(id).catch(error => {
        console.error('Error deleting session from IndexedDB:', error);
      });
    });
  },
  
  fetchSessions: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SESSIONS'
      });
      
      if (response && !response.error) {
        set({ sessions: response });
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  },
  
  addSessionFromBackground: async (session) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_SESSION',
        payload: session
      });
      
      // Also update local state
      set((state) => ({
        sessions: [
          ...state.sessions,
          {
            ...session,
            tabIds: session.tabIds || [],
            createdAt: new Date().toISOString()
          }
        ]
      }));
    } catch (error) {
      console.error('Error adding session:', error);
    }
  },
  
  updateSessionFromBackground: async (id, updates) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SESSION',
        payload: { id, ...updates }
      });
      
      // Also update local state
      set((state) => ({
        sessions: state.sessions.map(session => 
          session.id === id 
            ? { ...session, ...updates, tabIds: updates.tabIds !== undefined ? updates.tabIds : session.tabIds } 
            : session
        )
      }));
    } catch (error) {
      console.error('Error updating session:', error);
    }
  },
  
  deleteSessionFromBackground: async (id) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_SESSION',
        payload: { id }
      });
      
      // Also update local state
      set((state) => ({
        sessions: state.sessions.filter(session => session.id !== id)
      }));
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }
}))