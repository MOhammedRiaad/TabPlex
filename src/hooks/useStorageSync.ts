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
  updateSession
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
    addFolder: addFolderToStore,
    addTab: addTabToStore,
    addTask: addTaskToStore,
    addNote: addNoteToStore,
    addSession: addSessionToStore,
    updateBoard: updateBoardInStore,
    updateFolder: updateFolderInStore,
    updateTab: updateTabInStore,
    updateTask: updateTaskInStore,
    updateNote: updateNoteInStore,
    updateSession: updateSessionInStore
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
            addBoardToStore(event.data.payload);
            break;
          case 'STORAGE_BOARD_UPDATED':
            updateBoardInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_FOLDER_ADDED':
            addFolderToStore(event.data.payload);
            break;
          case 'STORAGE_FOLDER_UPDATED':
            updateFolderInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_TAB_ADDED':
            addTabToStore(event.data.payload);
            break;
          case 'STORAGE_TAB_UPDATED':
            updateTabInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_TASK_ADDED':
            addTaskToStore(event.data.payload);
            break;
          case 'STORAGE_TASK_UPDATED':
            updateTaskInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_NOTE_ADDED':
            addNoteToStore(event.data.payload);
            break;
          case 'STORAGE_NOTE_UPDATED':
            updateNoteInStore(event.data.payload.id, event.data.payload);
            break;

          case 'STORAGE_SESSION_ADDED':
            addSessionToStore(event.data.payload);
            break;
          case 'STORAGE_SESSION_UPDATED':
            updateSessionInStore(event.data.payload.id, event.data.payload);
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