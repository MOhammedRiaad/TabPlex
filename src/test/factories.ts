// Small builders for domain objects used across tests
import { Board, Folder, Note, Session, Tab, Task, TaskContext } from '../types';

const iso = (offsetMs = 0) => new Date(Date.UTC(2026, 9, 3, 12) + offsetMs).toISOString();

export const makeBoard = (overrides: Partial<Board> = {}): Board => ({
    id: 'board_1',
    name: 'Work',
    createdAt: iso(),
    updatedAt: iso(),
    ...overrides,
});

export const makeFolder = (overrides: Partial<Folder> = {}): Folder => ({
    id: 'folder_1',
    name: 'Inbox',
    boardId: 'board_1',
    color: '#3b82f6',
    order: 0,
    createdAt: iso(),
    ...overrides,
});

export const makeTab = (overrides: Partial<Tab> = {}): Tab => ({
    id: 'tab_1',
    title: 'Example',
    url: 'https://example.com/',
    folderId: 'folder_1',
    tabId: null,
    lastAccessed: iso(),
    status: 'closed',
    createdAt: iso(),
    ...overrides,
});

export const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task_1',
    title: 'Write pricing page',
    status: 'todo',
    priority: 'medium',
    createdAt: iso(),
    updatedAt: iso(),
    ...overrides,
});

export const makeContext = (overrides: Partial<TaskContext> = {}): TaskContext => ({
    tabs: [
        { url: 'https://a.example/', title: 'A' },
        { url: 'https://b.example/', title: 'B' },
    ],
    state: 'parked',
    parkedAt: iso(-3600_000),
    ...overrides,
});

export const makeNote = (overrides: Partial<Note> = {}): Note => ({
    id: 'note_1',
    title: 'Note',
    content: 'Hello',
    format: 'markdown',
    createdAt: iso(),
    updatedAt: iso(),
    ...overrides,
});

export const makeSession = (overrides: Partial<Session> = {}): Session => ({
    id: 'session_1',
    name: 'Morning',
    tabIds: [],
    startTime: iso(-7200_000),
    createdAt: iso(),
    ...overrides,
});

export { iso };
