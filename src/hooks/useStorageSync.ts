import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';
import { Task } from '../types';
import { BACKGROUND_TASKS_KEY } from '../utils/taskContext';
import { isImportInThisTab } from '../utils/exportImport';
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
    deleteBoard,
} from '../utils/storage';

// Insert an item, or merge it over the existing item with the same id
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
    return list.some(i => i.id === item.id)
        ? list.map(i => (i.id === item.id ? { ...i, ...item } : i))
        : [...list, item];
}

// The background service worker can change tasks while no TabPlex tab is open (e.g. a task context
// auto-parked when its tab group was closed). Prefer whichever copy was updated most recently.
async function reconcileTasksWithBackground(local: Task[]): Promise<Task[]> {
    try {
        const result = await chrome.storage.local.get([BACKGROUND_TASKS_KEY]);
        const remote = (result[BACKGROUND_TASKS_KEY] as Task[] | undefined) ?? [];
        const remoteById = new Map(remote.map(t => [t.id, t]));
        return local.map(task => {
            const other = remoteById.get(task.id);
            if (!other) return task;
            const newer = (other.updatedAt ?? '') > (task.updatedAt ?? '') ? other : task;
            // Task contexts are owned by the background service worker
            return { ...newer, context: other.context ?? task.context };
        });
    } catch {
        return local;
    }
}

export const useStorageSync = () => {
    // Track if initial data has been loaded to prevent race conditions
    const isInitialized = useRef(false);

    const {
        boards,
        folders,
        tabs,
        tasks,
        notes,
        sessions,
        addBoardSilently: addBoardSilentlyToStore,
        addFolderSilently: addFolderSilentlyToStore,
        deleteTabSilently: deleteTabSilentlyFromStore,
        deleteTaskSilently: deleteTaskSilentlyFromStore,
        deleteNoteSilently: deleteNoteSilentlyFromStore,
        deleteFolderSilently: deleteFolderSilentlyFromStore,
        deleteSessionSilently: deleteSessionSilentlyFromStore,
        deleteBoardSilently: deleteBoardSilentlyFromStore,
    } = useBoardStore();

    // Load data from IndexedDB on mount
    useEffect(() => {
        const loadData = async () => {
            await initDB(); // Initialize DB

            const [storedBoards, storedFolders, storedTabs, storedTasks, storedNotes, storedSessions] =
                await Promise.all([
                    getAllBoards(),
                    getAllFolders(),
                    getAllTabs(),
                    getAllTasks(),
                    getAllNotes(),
                    getAllSessions(),
                ]);

            // Sort tabs by order, handling undefined order by placing at end or keeping relative
            const sortedTabs = storedTabs.sort((a, b) => {
                const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            });

            const reconciledTasks = await reconcileTasksWithBackground(storedTasks);

            // Hydrate the store in one go. Using the add* actions here would reset every item's
            // createdAt/updatedAt and send an ADD_* message to the background for every stored item
            // on every page load.
            useBoardStore.setState({
                boards: storedBoards,
                folders: storedFolders,
                tabs: sortedTabs,
                tasks: reconciledTasks,
                notes: storedNotes,
                sessions: storedSessions,
            });

            // Mark as initialized AFTER all data is loaded
            isInitialized.current = true;
        };

        loadData();
    }, []);

    // Sync boards to storage
    useEffect(() => {
        // Skip sync until data is loaded to prevent race conditions
        if (!isInitialized.current) return;

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
        // Skip sync until data is loaded to prevent race conditions
        if (!isInitialized.current) return;

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
        // Skip sync until data is loaded to prevent race conditions
        if (!isInitialized.current) return;

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
        // Skip sync until data is loaded to prevent race conditions
        if (!isInitialized.current) return;

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
        // Skip sync until data is loaded to prevent race conditions
        if (!isInitialized.current) return;

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
        // Skip sync until data is loaded to prevent race conditions
        if (!isInitialized.current) return;

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
                    // Updates are applied silently: updateBoard/updateFolder/updateTab would send
                    // UPDATE_* back to the background and loop forever
                    case 'STORAGE_BOARD_UPDATED':
                        useBoardStore.setState(state => ({ boards: upsertById(state.boards, event.data.payload) }));
                        break;

                    case 'STORAGE_BOARD_DELETED':
                        deleteBoardSilentlyFromStore(event.data.payload.id);
                        break;

                    case 'STORAGE_FOLDER_ADDED':
                        // Use silent add to prevent infinite loops (doesn't send message back to background)
                        addFolderSilentlyToStore(event.data.payload);
                        break;
                    case 'STORAGE_FOLDER_UPDATED':
                        useBoardStore.setState(state => ({ folders: upsertById(state.folders, event.data.payload) }));
                        break;

                    case 'STORAGE_TAB_ADDED':
                        // Apply as-is: never re-send to the background (prevents loops) or reset timestamps
                        useBoardStore.setState(state => ({ tabs: upsertById(state.tabs, event.data.payload) }));
                        break;
                    case 'STORAGE_TAB_UPDATED':
                        // Update only: the background also tracks every browser tab and broadcasts on
                        // activation; adding unknown ones would fill Boards with the user's browsing
                        useBoardStore.setState(state => ({
                            tabs: state.tabs.map(t =>
                                t.id === event.data.payload.id ? { ...t, ...event.data.payload } : t
                            ),
                        }));
                        break;
                    case 'STORAGE_TAB_DELETED':
                        deleteTabSilentlyFromStore(event.data.payload.id);
                        break;

                    case 'STORAGE_TASK_ADDED':
                    case 'STORAGE_TASK_UPDATED':
                        // Silent upsert: updateTask would send UPDATE_TASK back and loop forever
                        useBoardStore.getState().upsertTaskSilently(event.data.payload);
                        break;

                    case 'STORAGE_NOTE_ADDED':
                    case 'STORAGE_NOTE_UPDATED':
                        useBoardStore.setState(state => ({ notes: upsertById(state.notes, event.data.payload) }));
                        break;

                    case 'STORAGE_SESSION_ADDED':
                    case 'STORAGE_SESSION_UPDATED':
                        useBoardStore.setState(state => ({ sessions: upsertById(state.sessions, event.data.payload) }));
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
                        // Another tab imported data: reload to show it. The importing tab reloads itself
                        // after its success toast (App.tsx), so it would otherwise reload twice.
                        if (!isImportInThisTab()) window.location.reload();
                        break;
                }
            }
        };

        // Listen for messages from background script
        window.addEventListener('message', handleStorageChange);

        // Also listen for messages from extension runtime.
        // Return false: this listener never responds. Returning true kept every message channel open
        // until it timed out ("message port closed before a response was received").
        const handleRuntimeMessage = (message: unknown) => {
            handleStorageChange({ data: message } as MessageEvent);
            return false;
        };
        chrome.runtime.onMessage.addListener(handleRuntimeMessage);

        return () => {
            window.removeEventListener('message', handleStorageChange);
            chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
        };
        // Store actions are stable references: the listeners are registered once
    }, [
        addBoardSilentlyToStore,
        addFolderSilentlyToStore,
        deleteTabSilentlyFromStore,
        deleteTaskSilentlyFromStore,
        deleteNoteSilentlyFromStore,
        deleteFolderSilentlyFromStore,
        deleteSessionSilentlyFromStore,
        deleteBoardSilentlyFromStore,
    ]);
};
