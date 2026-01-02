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
  tags?: string[];
  pinned?: boolean;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  checklist?: TaskChecklistItem[];
  completedSessions?: number; // Track pomodoro sessions
  status: 'todo' | 'doing' | 'done';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  boardId?: string;
  folderId?: string;
  tabIds?: string[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  pinned?: boolean;
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
  tags?: string[];
  pinned?: boolean;
}

export interface Session {
  id: string;
  name: string;
  tabIds: string[];
  startTime: string;
  endTime?: string;
  summary?: string;
  createdAt: string;
  duration?: number; // Duration in milliseconds
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

// Analytics types
export interface AnalyticsData {
  totalTabs: number;
  totalTasks: number;
  totalNotes: number;
  totalSessions: number;
  completedTasks: number;
  pendingTasks: number;
  averageSessionDuration: number;
  mostVisitedDomains: DomainStat[];
  taskCompletionRate: number;
  activityByDay: DayActivity[];
  topFocusedTasks: { id: string; title: string; sessions: number; timeString: string; }[];
  maxTaskSessions: number;
}

export interface DomainStat {
  domain: string;
  count: number;
  percentage: number;
}

export interface DayActivity {
  date: string;
  tabsOpened: number;
  tasksCompleted: number;
  sessionsStarted: number;
}

// Search types
export interface SearchResult {
  id: string;
  type: 'tab' | 'task' | 'note' | 'folder' | 'session';
  title: string;
  subtitle?: string;
  url?: string;
  tags?: string[];
}

// Command palette types
export interface Command {
  id: string;
  name: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
  category: 'navigation' | 'creation' | 'action' | 'settings';
}