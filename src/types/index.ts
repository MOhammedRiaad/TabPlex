export interface Board {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  boardId: string;
  color: string;
  order: number;
  createdAt: string;
  rules?: FolderRule[];
}

export interface FolderRule {
  id: string;
  condition: string; // e.g., "domain", "url_pattern", "title_pattern"
  value: string;
  action: string; // e.g., "auto_add", "suggest_add"
}

export interface Tab {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  folderId: string;
  tabId: number | null; // Actual browser tab ID when open
  lastAccessed: string;
  status: 'open' | 'suspended' | 'closed';
  createdAt: string;
}

export interface Task {
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

export interface Note {
  id: string;
  content: string;
  boardId?: string;
  folderId?: string;
  tabId?: string;
  createdAt: string;
  updatedAt: string;
  format: 'markdown' | 'text';
}

export interface Session {
  id: string;
  name: string;
  tabIds: string[];
  startTime: string;
  endTime?: string;
  summary?: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  lastVisitTime?: string;
  visitCount?: number;
  typedCount?: number;
  favicon?: string;
  createdAt: string;
}