import { create } from 'zustand';
import { Board, Folder, Tab, Task, Note, Session } from '../types';

interface BoardState {
  boards: Board[];
  folders: Folder[];
  tabs: Tab[];
  tasks: Task[];
  notes: Note[];
  sessions: Session[];
  addBoard: (board: Omit<Board, 'createdAt' | 'updatedAt'>) => void;
  updateBoard: (id: string, updates: Partial<Omit<Board, 'id' | 'createdAt'>>) => void;
  deleteBoard: (id: string) => void;
  addFolder: (folder: Omit<Folder, 'createdAt'>) => void;
  updateFolder: (id: string, updates: Partial<Omit<Folder, 'id' | 'createdAt'>>) => void;
  deleteFolder: (id: string) => void;
  addTab: (tab: Omit<Tab, 'createdAt'>) => void;
  updateTab: (id: string, updates: Partial<Omit<Tab, 'id' | 'createdAt'>>) => void;
  deleteTab: (id: string) => void;
  moveTab: (tabId: string, newFolderId: string) => void;
  addTask: (task: Omit<Task, 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteTask: (id: string) => void;
  addNote: (note: Omit<Note, 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteNote: (id: string) => void;
  addSession: (session: Omit<Session, 'createdAt'>) => void;
  updateSession: (id: string, updates: Partial<Omit<Session, 'id' | 'createdAt'>>) => void;
  deleteSession: (id: string) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  folders: [],
  tabs: [],
  tasks: [],
  notes: [],
  sessions: [],
  
  addBoard: (board) => set((state) => ({
    boards: [
      ...state.boards,
      {
        ...board,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  })),
  
  updateBoard: (id, updates) => set((state) => ({
    boards: state.boards.map(board => 
      board.id === id 
        ? { ...board, ...updates, updatedAt: new Date().toISOString() } 
        : board
    )
  })),
  
  deleteBoard: (id) => set((state) => ({
    boards: state.boards.filter(board => board.id !== id)
  })),
  
  addFolder: (folder) => set((state) => ({
    folders: [
      ...state.folders,
      {
        ...folder,
        createdAt: new Date().toISOString()
      }
    ]
  })),
  
  updateFolder: (id, updates) => set((state) => ({
    folders: state.folders.map(folder => 
      folder.id === id 
        ? { ...folder, ...updates } 
        : folder
    )
  })),
  
  deleteFolder: (id) => set((state) => ({
    folders: state.folders.filter(folder => folder.id !== id),
    // Also remove tabs in this folder
    tabs: state.tabs.filter(tab => tab.folderId !== id)
  })),
  
  addTab: (tab) => set((state) => ({
    tabs: [
      ...state.tabs,
      {
        ...tab,
        createdAt: new Date().toISOString()
      }
    ]
  })),
  
  updateTab: (id, updates) => set((state) => ({
    tabs: state.tabs.map(tab => 
      tab.id === id 
        ? { ...tab, ...updates } 
        : tab
    )
  })),
  
  deleteTab: (id) => set((state) => ({
    tabs: state.tabs.filter(tab => tab.id !== id)
  })),
  
  moveTab: (tabId, newFolderId) => set((state) => ({
    tabs: state.tabs.map(tab => 
      tab.id === tabId 
        ? { ...tab, folderId: newFolderId } 
        : tab
    )
  })),
  
  addTask: (task) => set((state) => ({
    tasks: [
      ...state.tasks,
      {
        ...task,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  })),
  
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(task => 
      task.id === id 
        ? { ...task, ...updates, updatedAt: new Date().toISOString() } 
        : task
    )
  })),
  
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter(task => task.id !== id)
  })),
  
  addNote: (note) => set((state) => ({
    notes: [
      ...state.notes,
      {
        ...note,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  })),
  
  updateNote: (id, updates) => set((state) => ({
    notes: state.notes.map(note => 
      note.id === id 
        ? { ...note, ...updates, updatedAt: new Date().toISOString() } 
        : note
    )
  })),
  
  deleteNote: (id) => set((state) => ({
    notes: state.notes.filter(note => note.id !== id)
  })),
  
  addSession: (session) => set((state) => ({
    sessions: [
      ...state.sessions,
      {
        ...session,
        createdAt: new Date().toISOString()
      }
    ]
  })),
  
  updateSession: (id, updates) => set((state) => ({
    sessions: state.sessions.map(session => 
      session.id === id 
        ? { ...session, ...updates } 
        : session
    )
  })),
  
  deleteSession: (id) => set((state) => ({
    sessions: state.sessions.filter(session => session.id !== id)
  }))
}));