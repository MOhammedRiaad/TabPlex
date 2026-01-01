// Storage functions for background service worker
// Using chrome.storage.local instead of IndexedDB for background script

const BOARDS_KEY = 'tabboard_boards';
const FOLDERS_KEY = 'tabboard_folders';
const TABS_KEY = 'tabboard_tabs';
const TASKS_KEY = 'tabboard_tasks';
const NOTES_KEY = 'tabboard_notes';
const SESSIONS_KEY = 'tabboard_sessions';

// Tab interface (duplicate from types for background script)
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

interface Folder {
  id: string;
  name: string;
  boardId: string;
  color: string;
  order: number;
  createdAt: string;
  rules?: FolderRule[];
}

interface FolderRule {
  id: string;
  condition: string;
  value: string;
  action: string;
}

interface Board {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  boardId?: string;
  folderId?: string;
  tabIds?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  content: string;
  boardId?: string;
  folderId?: string;
  tabId?: string;
  createdAt: string;
  updatedAt: string;
  format: 'markdown' | 'text';
}

interface Session {
  id: string;
  name: string;
  tabIds: string[];
  startTime: string;
  endTime?: string;
  summary?: string;
  createdAt: string;
}

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
  favicon?: string;
}

// Generic storage functions
async function getAllItems<T>(key: string): Promise<T[]> {
  const result = await chrome.storage.local.get([key]);
  return (result[key] as any[]) || [];
}

async function getItemById<T>(key: string, id: string): Promise<T | undefined> {
  const items = await getAllItems<T>(key);
  return items.find(item => (item as any).id === id);
}

async function addItem<T>(key: string, item: T): Promise<void> {
  const items = await getAllItems<T>(key);
  const itemId = (item as any).id;
  
  // Check if item already exists
  const existingIndex = items.findIndex(i => (i as any).id === itemId);
  
  if (existingIndex !== -1) {
    // Update existing item instead of adding duplicate
    items[existingIndex] = item;
  } else {
    // Add new item
    items.push(item);
  }
  
  await chrome.storage.local.set({ [key]: items });
}

async function updateItem<T>(key: string, item: T): Promise<void> {
  const items = await getAllItems<T>(key);
  const index = items.findIndex(i => (i as any).id === (item as any).id);
  
  if (index !== -1) {
    items[index] = item;
    await chrome.storage.local.set({ [key]: items });
  } else {
    // If not found, add it
    await addItem(key, item);
  }
}

async function deleteItem(key: string, id: string): Promise<void> {
  const items = await getAllItems<any>(key);
  const filteredItems = items.filter(item => item.id !== id);
  await chrome.storage.local.set({ [key]: filteredItems });
}

// Specific functions for each entity type
export async function getAllBoards(): Promise<Board[]> {
  return await getAllItems<Board>(BOARDS_KEY);
}

export async function getBoard(id: string): Promise<Board | undefined> {
  return await getItemById<Board>(BOARDS_KEY, id);
}

export async function addBoard(board: Board): Promise<void> {
  await addItem<Board>(BOARDS_KEY, board);
}

export async function updateBoard(board: Board): Promise<void> {
  await updateItem<Board>(BOARDS_KEY, board);
}

export async function deleteBoard(id: string): Promise<void> {
  await deleteItem(BOARDS_KEY, id);
}

export async function getAllFolders(): Promise<Folder[]> {
  return await getAllItems<Folder>(FOLDERS_KEY);
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return await getItemById<Folder>(FOLDERS_KEY, id);
}

export async function addFolder(folder: Folder): Promise<void> {
  await addItem<Folder>(FOLDERS_KEY, folder);
}

export async function updateFolder(folder: Folder): Promise<void> {
  await updateItem<Folder>(FOLDERS_KEY, folder);
}

export async function deleteFolder(id: string): Promise<void> {
  await deleteItem(FOLDERS_KEY, id);
}

export async function getAllTabs(): Promise<Tab[]> {
  return await getAllItems<Tab>(TABS_KEY);
}

export async function getTab(id: string): Promise<Tab | undefined> {
  return await getItemById<Tab>(TABS_KEY, id);
}

export async function addTab(tab: Tab): Promise<void> {
  await addItem<Tab>(TABS_KEY, tab);
}

export async function updateTab(tab: Tab): Promise<void> {
  await updateItem<Tab>(TABS_KEY, tab);
}

export async function deleteTab(id: string): Promise<void> {
  await deleteItem(TABS_KEY, id);
}

export async function getAllTasks(): Promise<Task[]> {
  return await getAllItems<Task>(TASKS_KEY);
}

export async function getTask(id: string): Promise<Task | undefined> {
  return await getItemById<Task>(TASKS_KEY, id);
}

export async function addTask(task: Task): Promise<void> {
  await addItem<Task>(TASKS_KEY, task);
}

export async function updateTask(task: Task): Promise<void> {
  await updateItem<Task>(TASKS_KEY, task);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteItem(TASKS_KEY, id);
}

export async function getAllNotes(): Promise<Note[]> {
  return await getAllItems<Note>(NOTES_KEY);
}

export async function getNote(id: string): Promise<Note | undefined> {
  return await getItemById<Note>(NOTES_KEY, id);
}

export async function addNote(note: Note): Promise<void> {
  await addItem<Note>(NOTES_KEY, note);
}

export async function updateNote(note: Note): Promise<void> {
  await updateItem<Note>(NOTES_KEY, note);
}

export async function deleteNote(id: string): Promise<void> {
  await deleteItem(NOTES_KEY, id);
}

export async function getAllSessions(): Promise<Session[]> {
  return await getAllItems<Session>(SESSIONS_KEY);
}

export async function getSession(id: string): Promise<Session | undefined> {
  return await getItemById<Session>(SESSIONS_KEY, id);
}

export async function addSession(session: Session): Promise<void> {
  await addItem<Session>(SESSIONS_KEY, session);
}

export async function updateSession(session: Session): Promise<void> {
  await updateItem<Session>(SESSIONS_KEY, session);
}

export async function deleteSession(id: string): Promise<void> {
  await deleteItem(SESSIONS_KEY, id);
}

// History functions
const HISTORY_KEY = 'history_items';

export async function getAllHistory(): Promise<HistoryItem[]> {
  return await getAllItems<HistoryItem>(HISTORY_KEY);
}

export async function getHistory(id: string): Promise<HistoryItem | undefined> {
  return await getItemById<HistoryItem>(HISTORY_KEY, id);
}

export async function addHistory(history: HistoryItem): Promise<void> {
  await addItem<HistoryItem>(HISTORY_KEY, history);
}

export async function updateHistory(history: HistoryItem): Promise<void> {
  await updateItem<HistoryItem>(HISTORY_KEY, history);
}

export async function deleteHistory(id: string): Promise<void> {
  await deleteItem(HISTORY_KEY, id);
}

// Bulk operations
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([
    BOARDS_KEY,
    FOLDERS_KEY,
    TABS_KEY,
    TASKS_KEY,
    NOTES_KEY,
    SESSIONS_KEY
  ]);
}