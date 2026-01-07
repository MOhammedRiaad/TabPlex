import { openDB, IDBPDatabase } from 'idb';
import { Board, Folder, Tab, Task, Note, Session } from '../types';

const DB_NAME = 'TabBoardDB';
const DB_VERSION = 2;
const BOARDS_STORE = 'boards';
const FOLDERS_STORE = 'folders';
const TABS_STORE = 'tabs';
const TASKS_STORE = 'tasks';
const NOTES_STORE = 'notes';
const SESSIONS_STORE = 'sessions';

export interface DBSchema {
    [BOARDS_STORE]: Board;
    [FOLDERS_STORE]: Folder;
    [TABS_STORE]: Tab;
    [TASKS_STORE]: Task;
    [NOTES_STORE]: Note;
    [SESSIONS_STORE]: Session;
}

let db: IDBPDatabase<DBSchema> | null = null;

export async function initDB(): Promise<IDBPDatabase<DBSchema>> {
    if (db) return db;

    db = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
        upgrade(database) {
            // Create object stores
            database.createObjectStore(BOARDS_STORE, { keyPath: 'id' });
            database.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
            database.createObjectStore(TABS_STORE, { keyPath: 'id' });
            database.createObjectStore(TASKS_STORE, { keyPath: 'id' });
            database.createObjectStore(NOTES_STORE, { keyPath: 'id' });
            database.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        },
    });

    return db;
}

export async function getAllBoards(): Promise<Board[]> {
    const database = await initDB();
    return await database.getAll(BOARDS_STORE);
}

export async function getBoard(id: string): Promise<Board | undefined> {
    const database = await initDB();
    return await database.get(BOARDS_STORE, id);
}

export async function addBoard(board: Board): Promise<void> {
    const database = await initDB();
    // Use put instead of add to handle existing items gracefully
    await database.put(BOARDS_STORE, board);
}

export async function updateBoard(board: Board): Promise<void> {
    const database = await initDB();
    await database.put(BOARDS_STORE, board);
}

export async function deleteBoard(id: string): Promise<void> {
    const database = await initDB();
    await database.delete(BOARDS_STORE, id);
}

export async function getAllFolders(): Promise<Folder[]> {
    const database = await initDB();
    return await database.getAll(FOLDERS_STORE);
}

export async function getFolder(id: string): Promise<Folder | undefined> {
    const database = await initDB();
    return await database.get(FOLDERS_STORE, id);
}

export async function addFolder(folder: Folder): Promise<void> {
    const database = await initDB();
    // Use put instead of add to handle existing items gracefully
    await database.put(FOLDERS_STORE, folder);
}

export async function updateFolder(folder: Folder): Promise<void> {
    const database = await initDB();
    await database.put(FOLDERS_STORE, folder);
}

export async function deleteFolder(id: string): Promise<void> {
    const database = await initDB();
    await database.delete(FOLDERS_STORE, id);
}

export async function getAllTabs(): Promise<Tab[]> {
    const database = await initDB();
    return await database.getAll(TABS_STORE);
}

export async function getTab(id: string): Promise<Tab | undefined> {
    const database = await initDB();
    return await database.get(TABS_STORE, id);
}

export async function addTab(tab: Tab): Promise<void> {
    const database = await initDB();
    // Use put instead of add to handle existing items gracefully
    await database.put(TABS_STORE, tab);
}

export async function updateTab(tab: Tab): Promise<void> {
    const database = await initDB();
    await database.put(TABS_STORE, tab);
}

export async function deleteTab(id: string): Promise<void> {
    const database = await initDB();
    await database.delete(TABS_STORE, id);
}

export async function getAllTasks(): Promise<Task[]> {
    const database = await initDB();
    return await database.getAll(TASKS_STORE);
}

export async function getTask(id: string): Promise<Task | undefined> {
    const database = await initDB();
    return await database.get(TASKS_STORE, id);
}

export async function addTask(task: Task): Promise<void> {
    const database = await initDB();
    // Use put instead of add to handle existing items gracefully
    await database.put(TASKS_STORE, task);
}

export async function updateTask(task: Task): Promise<void> {
    const database = await initDB();
    await database.put(TASKS_STORE, task);
}

export async function deleteTask(id: string): Promise<void> {
    const database = await initDB();
    await database.delete(TASKS_STORE, id);
}

export async function getAllNotes(): Promise<Note[]> {
    const database = await initDB();
    return await database.getAll(NOTES_STORE);
}

export async function getNote(id: string): Promise<Note | undefined> {
    const database = await initDB();
    return await database.get(NOTES_STORE, id);
}

export async function addNote(note: Note): Promise<void> {
    const database = await initDB();
    // Use put instead of add to handle existing items gracefully
    await database.put(NOTES_STORE, note);
}

export async function updateNote(note: Note): Promise<void> {
    const database = await initDB();
    await database.put(NOTES_STORE, note);
}

export async function deleteNote(id: string): Promise<void> {
    const database = await initDB();
    await database.delete(NOTES_STORE, id);
}

export async function getAllSessions(): Promise<Session[]> {
    const database = await initDB();
    return await database.getAll(SESSIONS_STORE);
}

export async function getSession(id: string): Promise<Session | undefined> {
    const database = await initDB();
    return await database.get(SESSIONS_STORE, id);
}

export async function addSession(session: Session): Promise<void> {
    const database = await initDB();
    // Use put instead of add to handle existing items gracefully
    await database.put(SESSIONS_STORE, session);
}

export async function updateSession(session: Session): Promise<void> {
    const database = await initDB();
    await database.put(SESSIONS_STORE, session);
}

export async function deleteSession(id: string): Promise<void> {
    const database = await initDB();
    await database.delete(SESSIONS_STORE, id);
}

// Bulk operations
export async function clearAllData(): Promise<void> {
    const database = await initDB();
    await database.clear(BOARDS_STORE);
    await database.clear(FOLDERS_STORE);
    await database.clear(TABS_STORE);
    await database.clear(TASKS_STORE);
    await database.clear(NOTES_STORE);
    await database.clear(SESSIONS_STORE);
}
