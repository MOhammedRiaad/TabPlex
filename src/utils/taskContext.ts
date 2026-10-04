// Shared helpers for Park & Resume (task contexts).
// Used by both the UI and the background service worker — keep this file free of DOM and React.
import { ContextEvent, ContextTab, ParkResumeSettings, Task, TaskContext } from '../types';

/** Messages sent from the UI to the background */
export const CONTEXT_MESSAGES = {
    START: 'TASK_CONTEXT_START',
    PARK: 'TASK_CONTEXT_PARK',
    RESUME: 'TASK_CONTEXT_RESUME',
    ADD_TABS: 'TASK_CONTEXT_ADD_TABS',
    REMOVE_TAB: 'TASK_CONTEXT_REMOVE_TAB',
    PARK_ACTIVE: 'TASK_CONTEXT_PARK_ACTIVE',
    SET_SUMMARY: 'TASK_CONTEXT_SET_SUMMARY',
} as const;

export type ContextMessageType = (typeof CONTEXT_MESSAGES)[keyof typeof CONTEXT_MESSAGES];

export interface StartContextPayload {
    task: Task;
    windowId?: number;
}

export interface ParkContextPayload {
    task: Task;
    note?: string;
    closeTabs?: boolean;
    /** URLs the user chose to leave open; they are detached from the context */
    keepOpenUrls?: string[];
    /**
     * Browser tabs to close when the task isn't active (Create & park). Only tabs whose URL is saved in the
     * context are closed. Ignored for an active task, whose group is closed instead.
     */
    chromeTabIds?: number[];
}

export interface AddTabsPayload {
    task: Task;
    windowId?: number;
    /** Specific browser tab ids; defaults to every capturable tab in the window */
    chromeTabIds?: number[];
}

export interface RemoveTabPayload {
    task: Task;
    url: string;
}

export interface SetSummaryPayload {
    taskId: string;
    summary: string;
    /** The park this summary describes; ignored if the task was parked again or resumed since */
    parkedAt: string;
}

export interface ContextResponse {
    success?: boolean;
    error?: string;
    task?: Task;
    /** Task that was parked automatically because another task was started */
    autoParked?: Task;
}

/** chrome.storage.local keys */
/** The background's copy of all tasks (read by the UI to reconcile) */
export const BACKGROUND_TASKS_KEY = 'tabboard_tasks';
export const ACTIVE_CONTEXT_KEY = 'tabplex_active_context_task_id';
export const PARK_RESUME_SETTINGS_KEY = 'tabplex_park_resume_settings';

export const DEFAULT_PARK_RESUME_SETTINGS: ParkResumeSettings = {
    closeTabsOnPark: true,
    autoAddNewTabs: true,
    startPomodoroOnStart: false,
    aiSummaries: false,
};

export const RESUME_NOTE_MAX_LENGTH = 280;
/** Ask before reopening more tabs than this */
export const LARGE_CONTEXT_THRESHOLD = 25;

export const emptyContext = (): TaskContext => ({ tabs: [], state: 'idle' });

/** Keep the per-task event log small: it is stored on the task in two places */
export const MAX_CONTEXT_EVENTS = 50;

export function appendContextEvent(ctx: TaskContext, event: ContextEvent): ContextEvent[] {
    return [...(ctx.events ?? []), event].slice(-MAX_CONTEXT_EVENTS);
}

export const getContext = (task: Task): TaskContext => task.context ?? emptyContext();

export const isContextActive = (task: Task): boolean => task.context?.state === 'active';
export const isContextParked = (task: Task): boolean => task.context?.state === 'parked';

/** Only real web pages can be captured and reopened */
export function isCapturableUrl(url: string | undefined, extensionBaseUrl?: string): url is string {
    if (!url) return false;
    if (extensionBaseUrl && url.startsWith(extensionBaseUrl)) return false;
    return /^(https?|file|ftp):/i.test(url);
}

export function dedupeTabsByUrl(tabs: ContextTab[]): ContextTab[] {
    const seen = new Set<string>();
    return tabs.filter(tab => {
        if (seen.has(tab.url)) return false;
        seen.add(tab.url);
        return true;
    });
}

export function sameTabs(a: ContextTab[], b: ContextTab[]): boolean {
    return a.length === b.length && a.every((tab, i) => tab.url === b[i].url && tab.title === b[i].title);
}

/** Chrome tab group title for a task (Chrome truncates long titles visually) */
export function groupTitleForTask(task: Pick<Task, 'title'>): string {
    const title = task.title.trim() || 'Task';
    return title.length > 30 ? `${title.slice(0, 29)}…` : title;
}

export function groupColorForPriority(priority: Task['priority']): `${chrome.tabGroups.Color}` {
    switch (priority) {
        case 'high':
            return 'red';
        case 'medium':
            return 'yellow';
        default:
            return 'blue';
    }
}
