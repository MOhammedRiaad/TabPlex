import { StateCreator } from 'zustand';
import { Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../../../types';

export interface BoardSlice {
    boards: Board[];
    folders: Folder[];
    addBoard: (board: Omit<Board, 'createdAt' | 'updatedAt'>) => void;
    addBoardSilently: (board: Board) => void;
    updateBoard: (id: string, updates: Partial<Omit<Board, 'id' | 'createdAt'>>) => void;
    deleteBoard: (id: string) => void;
    deleteBoardSilently: (id: string) => void;
    addFolder: (folder: Omit<Folder, 'createdAt'>) => void;
    addFolderSilently: (folder: Folder) => void;
    updateFolder: (id: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => void;
    deleteFolder: (id: string, moveTabs?: boolean, targetFolderId?: string) => void;
    deleteFolderSilently: (id: string, moveTabs?: boolean, targetFolderId?: string) => void;
}

export interface TabSlice {
    tabs: Tab[];
    addTab: (tab: Omit<Tab, 'createdAt'>) => void;
    updateTab: (id: string, updates: Partial<Omit<Tab, 'id' | 'createdAt'>>) => void;
    deleteTab: (id: string) => void;
    deleteTabSilently: (id: string) => void;
    moveTab: (tabId: string, newFolderId: string) => void;
    reorderTab: (tabId: string, newIndex: number, folderId: string) => void;
}

export interface TaskSlice {
    tasks: Task[];
    addTask: (task: Omit<Task, 'createdAt' | 'updatedAt'>) => void;
    updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => void;
    deleteTask: (id: string) => void;
    deleteTaskSilently: (id: string) => void;
}

export interface NoteSlice {
    notes: Note[];
    addNote: (note: Omit<Note, 'createdAt' | 'updatedAt'>) => void;
    updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => void;
    deleteNote: (id: string) => void;
    deleteNoteSilently: (id: string) => void;
}

export interface SessionSlice {
    sessions: Session[];
    addSession: (session: Omit<Session, 'createdAt'>) => void;
    updateSession: (id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>) => void;
    deleteSession: (id: string) => void;
    deleteSessionSilently: (id: string) => void;
    fetchSessions: () => Promise<void>;
    addSessionFromBackground: (session: Omit<Session, 'createdAt'>) => Promise<void>;
    updateSessionFromBackground: (id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>) => Promise<void>;
    deleteSessionFromBackground: (id: string) => Promise<void>;
}

export interface HistorySlice {
    history: HistoryItem[];
    addHistory: (history: Omit<HistoryItem, 'createdAt'>) => void;
    updateHistory: (id: string, updates: Partial<Omit<HistoryItem, 'id' | 'createdAt'>>) => void;
    deleteHistory: (id: string) => void;
    fetchHistory: () => Promise<void>;
    fetchBrowserHistory: () => Promise<chrome.history.HistoryItem[]>;
}

export type BoardState = BoardSlice & TabSlice & TaskSlice & NoteSlice & SessionSlice & HistorySlice;

export type BoardStoreCreator<T> = StateCreator<BoardState, [], [], T>;
