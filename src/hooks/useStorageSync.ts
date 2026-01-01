import { useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';
import { 
  initDB,
  getAllBoards, 
  getAllFolders, 
  getAllTabs, 
  getAllTasks, 
  getAllNotes, 
  getAllSessions,
  addBoard,
  addFolder,
  addTab,
  addTask,
  addNote,
  addSession,
  updateBoard,
  updateFolder,
  updateTab,
  updateTask,
  updateNote,
  updateSession,
  deleteTab,
  deleteTask,
  deleteNote,
  deleteFolder,
  deleteSession,
  deleteBoard
} from '../utils/storage';

export const useStorageSync = () => {
  const {
    boards,
    folders,
    tabs,
    tasks,
    notes,
    sessions,
    addBoard: addBoardToStore,
    addBoardSilently: addBoardSilentlyToStore,
    addFolder: addFolderToStore,
    addFolderSilently: addFolderSilentlyToStore,
    addTab: addTabToStore,
    addTask: addTaskToStore,
    addNote: addNoteToStore,
    addSession: addSessionToStore,
    updateBoard: updateBoardInStore,
    updateFolder: updateFolderInStore,
    updateTab: updateTabInStore,
    updateTask: updateTaskInStore,
    updateNote: updateNoteInStore,
    updateSession: updateSessionInStore,
    deleteTabSilently: deleteTabSilentlyFromStore,
    deleteTaskSilently: deleteTaskSilentlyFromStore,
    deleteNoteSilently: deleteNoteSilentlyFromStore,
    deleteFolderSilently: deleteFolderSilentlyFromStore,
    deleteSessionSilently: deleteSessionSilentlyFromStore,
    deleteBoardSilently: deleteBoardSilentlyFromStore
  } = useBoardStore();

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      await initDB(); // Initialize DB
      
      const [
        storedBoards,
        storedFolders,
        storedTabs,
        storedTasks,
        storedNotes,
        storedSessions
      ] = await Promise.all([
        getAllBoards(),
        getAllFolders(),
        getAllTabs(),
        getAllTasks(),
        getAllNotes(),
        getAllSessions()
      ]);

      // Populate store with loaded data
      storedBoards.forEach(board => addBoardToStore(board));
      storedFolders.forEach(folder => addFolderToStore(folder));
      storedTabs.forEach(tab => addTabToStore(tab));
      storedTasks.forEach(task => addTaskToStore(task));
      storedNotes.forEach(note => addNoteToStore(note));
      storedSessions.forEach(session => addSessionToStore(session));
    };

    loadData();
  }, []);

  // Sync boards to storage
  useEffect(() => {
    const syncBoards = async () => {
      // Get all boards currently in IndexedDB
      const indexedDBBoards = await getAllBoards();
      
      // Delete boards that exist in IndexedDB but not in the store
      for (const indexedDBBoard of indexedDBBoards) {
        if (!boards.some(board => board.id === indexedDBBoard.id)) {
          await deleteBoard(indexedDBBoard.id);
        }
      }
      
      // Update/add boards that exist in the store
      for (const board of boards) {
        try {
          await updateBoard(board);
        } catch {
          // If update fails, try adding
          await addBoard(board);
        }
      }
    };
    syncBoards();
  }, [boards]);

  // Sync folders to storage
  useEffect(() => {
    const syncFolders = async () => {
      // Get all folders currently in IndexedDB
      const indexedDBFolders = await getAllFolders();
      
      // Delete folders that exist in IndexedDB but not in the store
      for (const indexedDBFolder of indexedDBFolders) {
        if (!folders.some(folder => folder.id === indexedDBFolder.id)) {
          await deleteFolder(indexedDBFolder.id);
        }
      }
      
      // Update/add folders that exist in the store
      for (const folder of folders) {
        try {
          await updateFolder(folder);
        } catch {
          // If update fails, try adding
          await addFolder(folder);
        }
      }
    };
    syncFolders();
  }, [folders]);

  // Sync tabs to storage
  useEffect(() => {
    const syncTabs = async () => {
      // Get all tabs currently in IndexedDB
      const indexedDBTabs = await getAllTabs();
      
      // Delete tabs that exist in IndexedDB but not in the store
      for (const indexedDBTab of indexedDBTabs) {
        if (!tabs.some(tab => tab.id === indexedDBTab.id)) {
          await deleteTab(indexedDBTab.id);
        }
      }
      
      // Update/add tabs that exist in the store
      for (const tab of tabs) {
        try {
          await updateTab(tab);
        } catch {
          // If update fails, try adding
          await addTab(tab);
        }
      }
    };
    syncTabs();
  }, [tabs]);

  // Sync tasks to storage
  useEffect(() => {
    const syncTasks = async () => {
      // Get all tasks currently in IndexedDB
      const indexedDBTasks = await getAllTasks();
      
      // Delete tasks that exist in IndexedDB but not in the store
      for (const indexedDBTask of indexedDBTasks) {
        if (!tasks.some(task => task.id === indexedDBTask.id)) {
          await deleteTask(indexedDBTask.id);
        }
      }
      
      // Update/add tasks that exist in the store
      for (const task of tasks) {
        try {
          await updateTask(task);
        } catch {
          // If update fails, try adding
          await addTask(task);
        }
      }
    };
    syncTasks();
  }, [tasks]);

  // Sync notes to storage
  useEffect(() => {
    const syncNotes = async () => {
      // Get all notes currently in IndexedDB
      const indexedDBNotes = await getAllNotes();
      
      // Delete notes that exist in IndexedDB but not in the store
      for (const indexedDBNote of indexedDBNotes) {
        if (!notes.some(note => note.id === indexedDBNote.id)) {
          await deleteNote(indexedDBNote.id);
        }
      }
      
      // Update/add notes that exist in the store
      for (const note of notes) {
        try {
          await updateNote(note);
        } catch {
          // If update fails, try adding
          await addNote(note);
        }
      }
    };
    syncNotes();
  }, [notes]);

  // Sync sessions to storage
  useEffect(() => {
    const syncSessions = async () => {
      // Get all sessions currently in IndexedDB
      const indexedDBSessions = await getAllSessions();
      
      // Delete sessions that exist in IndexedDB but not in the store
      for (const indexedDBSession of indexedDBSessions) {
        if (!sessions.some(session => session.id === indexedDBSession.id)) {
          await deleteSession(indexedDBSession.id);
        }
      }
      
      // Update/add sessions that exist in the store
      for (const session of sessions) {
        try {
          await updateSession(session);
        } catch {
          // If update fails, try adding
          await addSession(session);
        }
      }
    };
    syncSessions();
  }, [sessions]);

  // Set up event listeners for storage changes from background script
  useEffect(() => {
    const handleStorageChange = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        switch (event.data.type) {
          case 'STORAGE_BOARD_ADDED':
            // Use silent add to prevent infinite loops (doesn't send message back to background)
            addBoardSilentlyToStore(event.data.payload);
            break;
          case 'STORAGE_BOARD_UPDATED':
            updateBoardInStore(event.data.payload.id, event.data.payload);
            break;
          
          case 'STORAGE_BOARD_DELETED':
            deleteBoardSilentlyFromStore(event.data.payload.id);
            break;

          case 'STORAGE_FOLDER_ADDED':
            // Use silent add to prevent infinite loops (doesn't send message back to background)
            addFolderSilentlyToStore(event.data.payload);
            break;
          case 'STORAGE_FOLDER_UPDATED':
            updateFolderInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_TAB_ADDED':
            // Check if it already exists to prevent infinite loops
            const tabState = useBoardStore.getState();
            if (!tabState.tabs.some(t => t.id === event.data.payload.id)) {
              addTabToStore(event.data.payload);
            }
            break;
          case 'STORAGE_TAB_UPDATED':
            updateTabInStore(event.data.payload.id, event.data.payload);
            break;
          case 'STORAGE_TAB_DELETED':
            deleteTabSilentlyFromStore(event.data.payload.id);
            break;

          case 'STORAGE_TASK_ADDED':
            // Check if it already exists to prevent infinite loops
            const taskState = useBoardStore.getState();
            if (!taskState.tasks.some(t => t.id === event.data.payload.id)) {
              addTaskToStore(event.data.payload);
            }
            break;
          case 'STORAGE_TASK_UPDATED':
            updateTaskInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_NOTE_ADDED':
            // Check if it already exists to prevent infinite loops
            const noteState = useBoardStore.getState();
            if (!noteState.notes.some(n => n.id === event.data.payload.id)) {
              addNoteToStore(event.data.payload);
            }
            break;
          case 'STORAGE_NOTE_UPDATED':
            updateNoteInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_SESSION_ADDED':
            // Check if it already exists to prevent infinite loops
            const sessionState = useBoardStore.getState();
            if (!sessionState.sessions.some(s => s.id === event.data.payload.id)) {
              addSessionToStore(event.data.payload);
            }
            break;
          case 'STORAGE_SESSION_UPDATED':
            updateSessionInStore(event.data.payload.id, event.data.payload);
            break;
          
          case 'STORAGE_TASK_DELETED':
            deleteTaskSilentlyFromStore(event.data.payload.id);
            break;
          
          case 'STORAGE_NOTE_DELETED':
            deleteNoteSilentlyFromStore(event.data.payload.id);
            break;
          
          case 'STORAGE_FOLDER_DELETED':
            deleteFolderSilentlyFromStore(event.data.payload.id);
            break;
          
          case 'STORAGE_SESSION_DELETED':
            deleteSessionSilentlyFromStore(event.data.payload.id);
            break;
          
          case 'STORAGE_DATA_IMPORTED':
            // When data is imported, we need to refresh all data
            window.location.reload();
            break;
        }
      }
    };

    // Listen for messages from background script
    window.addEventListener('message', handleStorageChange);

    // Also listen for messages from extension runtime
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      handleStorageChange({ data: message } as MessageEvent);
      return true; // Required for async response
    });

    return () => {
      window.removeEventListener('message', handleStorageChange);
    };
  }, []);
};