// Park & Resume — task-bound tab contexts. See docs/specs/PARK_AND_RESUME.md
//
// The background is the source of truth for task contexts: all tab / tab-group operations happen here,
// because the TabPlex tab that asks for them may itself be in the window being changed.
import { getTask, updateTask } from './storage';
import { ContextTab, ExtensionMessage, ParkResumeSettings, Task, TaskContext } from '../types';
import {
    ACTIVE_CONTEXT_KEY,
    AddTabsPayload,
    CONTEXT_MESSAGES,
    ContextResponse,
    DEFAULT_PARK_RESUME_SETTINGS,
    PARK_RESUME_SETTINGS_KEY,
    ParkContextPayload,
    RemoveTabPayload,
    SetSummaryPayload,
    StartContextPayload,
    appendContextEvent,
    dedupeTabsByUrl,
    getContext,
    groupColorForPriority,
    groupTitleForTask,
    isCapturableUrl,
    sameTabs,
} from '../utils/taskContext';

const NO_GROUP = -1; // chrome.tabGroups.TAB_GROUP_ID_NONE
const SNAPSHOT_DEBOUNCE_MS = 1500;

/** True while we are creating / closing / grouping tabs ourselves, so our own listeners stay quiet */
let busy = 0;

async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
    busy++;
    try {
        return await fn();
    } finally {
        // Let the tab events we caused drain before listening again
        setTimeout(() => {
            busy = Math.max(0, busy - 1);
        }, 300);
    }
}

const extensionBaseUrl = () => chrome.runtime.getURL('');

type TabIdList = [number, ...number[]];
/** chrome.tabs.group/ungroup require a non-empty list — callers check length first */
const ids = (list: number[]): TabIdList => list as TabIdList;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function getSettings(): Promise<ParkResumeSettings> {
    const result = await chrome.storage.local.get([PARK_RESUME_SETTINGS_KEY]);
    return { ...DEFAULT_PARK_RESUME_SETTINGS, ...(result[PARK_RESUME_SETTINGS_KEY] as Partial<ParkResumeSettings>) };
}

async function getActiveTaskId(): Promise<string | null> {
    const result = await chrome.storage.local.get([ACTIVE_CONTEXT_KEY]);
    return (result[ACTIVE_CONTEXT_KEY] as string | undefined) ?? null;
}

async function setActiveTaskId(taskId: string | null): Promise<void> {
    if (taskId) {
        await chrome.storage.local.set({ [ACTIVE_CONTEXT_KEY]: taskId });
    } else {
        await chrome.storage.local.remove(ACTIVE_CONTEXT_KEY);
    }
}

/**
 * Merge the UI's copy (sent with the message) with the background's. Regular fields come from whichever
 * was updated last; `context` is owned by this service, so the stored context always wins.
 */
async function resolveTask(fromUi: Task): Promise<Task> {
    const stored = await getTask(fromUi.id);
    if (!stored) return fromUi;
    const newer = (stored.updatedAt ?? '') > (fromUi.updatedAt ?? '') ? stored : fromUi;
    return { ...newer, context: stored.context ?? fromUi.context };
}

async function saveTask(task: Task): Promise<Task> {
    const saved: Task = { ...task, updatedAt: new Date().toISOString() };
    await updateTask(saved);
    chrome.runtime.sendMessage({ type: 'STORAGE_TASK_UPDATED', payload: saved }).catch(() => {
        // No TabPlex tab open — it will reconcile from chrome.storage on next load
    });
    return saved;
}

// ---------------------------------------------------------------------------
// Chrome helpers
// ---------------------------------------------------------------------------

function toContextTab(tab: chrome.tabs.Tab): ContextTab | null {
    const url = tab.url || tab.pendingUrl;
    if (!isCapturableUrl(url, extensionBaseUrl())) return null;
    return { url, title: tab.title || url, favicon: tab.favIconUrl || undefined };
}

function snapshot(tabs: chrome.tabs.Tab[]): ContextTab[] {
    return dedupeTabsByUrl(tabs.map(toContextTab).filter((t): t is ContextTab => t !== null));
}

async function groupExists(groupId: number | null | undefined): Promise<boolean> {
    if (groupId === null || groupId === undefined || groupId === NO_GROUP) return false;
    try {
        await chrome.tabGroups.get(groupId);
        return true;
    } catch {
        return false;
    }
}

async function getGroupTabs(groupId: number): Promise<chrome.tabs.Tab[]> {
    try {
        return await chrome.tabs.query({ groupId });
    } catch {
        return [];
    }
}

async function resolveWindowId(preferred?: number | null): Promise<number> {
    if (preferred !== undefined && preferred !== null) {
        try {
            await chrome.windows.get(preferred);
            return preferred;
        } catch {
            // Window was closed — fall through
        }
    }
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    if (win.id === undefined) throw new Error('No browser window available');
    return win.id;
}

async function styleGroup(groupId: number, task: Task): Promise<void> {
    await chrome.tabGroups.update(groupId, {
        title: groupTitleForTask(task),
        color: groupColorForPriority(task.priority),
        collapsed: false,
    });
}

/** Closing every tab in a window closes the window; keep it alive with a TabPlex tab */
async function closeTabsSafely(windowId: number | null | undefined, tabIds: number[]): Promise<void> {
    if (tabIds.length === 0) return;
    if (windowId !== null && windowId !== undefined) {
        const remaining = await chrome.tabs.query({ windowId });
        if (remaining.every(tab => tab.id !== undefined && tabIds.includes(tab.id))) {
            await chrome.tabs.create({ windowId, url: chrome.runtime.getURL('index.html'), active: true });
        }
    }
    await chrome.tabs.remove(tabIds);
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

interface ParkOptions {
    note?: string;
    closeTabs: boolean;
    keepOpenUrls?: string[];
    /** Parked without the user asking (another task started, group closed, restart) */
    auto?: boolean;
}

async function parkTask(task: Task, options: ParkOptions): Promise<Task> {
    const ctx = getContext(task);
    let tabs = ctx.tabs;
    const closeIds: number[] = [];
    const detachIds: number[] = [];

    if (ctx.state === 'active' && (await groupExists(ctx.chromeGroupId))) {
        const live = await getGroupTabs(ctx.chromeGroupId as number);
        const keep = new Set(options.keepOpenUrls ?? []);
        const liveSnapshot = snapshot(live);
        // An empty live group never wipes a saved context
        if (liveSnapshot.length > 0 || ctx.tabs.length === 0) {
            tabs = liveSnapshot.filter(tab => !keep.has(tab.url));
        }
        for (const tab of live) {
            if (tab.id === undefined) continue;
            const url = tab.url || tab.pendingUrl || '';
            if (keep.has(url)) detachIds.push(tab.id);
            else closeIds.push(tab.id);
        }
    }

    const note = options.note === undefined ? ctx.resumeNote : options.note.trim() || undefined;
    const parkedAt = new Date().toISOString();
    const parked: Task = {
        ...task,
        context: {
            ...ctx,
            tabs,
            state: 'parked',
            chromeGroupId: null,
            parkedAt,
            resumeNote: note,
            // A new park describes different work; the UI may generate a fresh summary
            aiSummary: undefined,
            parkCount: (ctx.parkCount ?? 0) + 1,
            events: appendContextEvent(ctx, {
                type: 'park',
                at: parkedAt,
                tabCount: tabs.length,
                closedTabs: options.closeTabs ? closeIds.length : 0,
                auto: options.auto || undefined,
            }),
        },
    };

    // Persist first: the context must survive even if closing tabs fails
    if ((await getActiveTaskId()) === task.id) await setActiveTaskId(null);
    const saved = await saveTask(parked);

    await withBusy(async () => {
        try {
            if (detachIds.length) await chrome.tabs.ungroup(ids(detachIds));
            if (options.closeTabs) {
                await closeTabsSafely(ctx.windowId, closeIds);
            } else if (closeIds.length) {
                await chrome.tabs.ungroup(ids(closeIds));
            }
        } catch (error) {
            console.warn('Park: could not close/ungroup some tabs', error);
        }
    });

    return saved;
}

async function parkActiveIfOther(taskId: string): Promise<Task | undefined> {
    const activeId = await getActiveTaskId();
    if (!activeId || activeId === taskId) return undefined;
    const active = await getTask(activeId);
    if (!active || getContext(active).state !== 'active') {
        await setActiveTaskId(null);
        return undefined;
    }
    const settings = await getSettings();
    return parkTask(active, { closeTabs: settings.closeTabsOnPark, auto: true });
}

async function startTask(
    taskFromUi: Task,
    windowIdHint: number | undefined,
    isResume: boolean
): Promise<ContextResponse> {
    const task = await resolveTask(taskFromUi);
    const autoParked = await parkActiveIfOther(task.id);
    const ctx = getContext(task);

    // Already active with a live group: just focus it
    if (ctx.state === 'active' && (await groupExists(ctx.chromeGroupId))) {
        const [first] = await getGroupTabs(ctx.chromeGroupId as number);
        if (first?.id !== undefined) {
            await chrome.tabs.update(first.id, { active: true });
            if (first.windowId !== undefined) await chrome.windows.update(first.windowId, { focused: true });
        }
        await setActiveTaskId(task.id);
        return { success: true, task, autoParked };
    }

    const windowId = await resolveWindowId(windowIdHint);

    const groupId = await withBusy(async () => {
        const created: number[] = [];
        for (const [index, tab] of ctx.tabs.entries()) {
            const opened = await chrome.tabs.create({ windowId, url: tab.url, active: index === 0 });
            if (opened.id !== undefined) created.push(opened.id);
        }
        if (created.length === 0) return null;
        const id = await chrome.tabs.group({ tabIds: ids(created), createProperties: { windowId } });
        await styleGroup(id, task);
        return id;
    });

    const resumedAt = new Date().toISOString();
    const started: Task = {
        ...task,
        status: task.status === 'todo' ? 'doing' : task.status,
        context: {
            ...ctx,
            state: 'active',
            chromeGroupId: groupId,
            windowId,
            resumedAt,
            resumeCount: (ctx.resumeCount ?? 0) + (isResume ? 1 : 0),
            events: appendContextEvent(ctx, {
                type: isResume ? 'resume' : 'start',
                at: resumedAt,
                tabCount: ctx.tabs.length,
            }),
        },
    };

    await setActiveTaskId(task.id);
    return { success: true, task: await saveTask(started), autoParked };
}

async function addTabsToTask(payload: AddTabsPayload): Promise<ContextResponse> {
    const task = await resolveTask(payload.task);
    const ctx = getContext(task);

    let candidates: chrome.tabs.Tab[];
    if (payload.chromeTabIds?.length) {
        candidates = await Promise.all(payload.chromeTabIds.map(id => chrome.tabs.get(id)));
    } else {
        const windowId = await resolveWindowId(payload.windowId);
        candidates = await chrome.tabs.query({ windowId });
    }

    // Skip pinned tabs, TabPlex itself, and tabs that belong to some other group
    candidates = candidates.filter(
        tab =>
            !tab.pinned &&
            toContextTab(tab) !== null &&
            (tab.groupId === undefined || tab.groupId === NO_GROUP || tab.groupId === ctx.chromeGroupId)
    );

    if (candidates.length === 0) {
        return { success: true, task };
    }

    let next: TaskContext;
    if (ctx.state === 'active') {
        const tabIds = candidates.map(t => t.id).filter((id): id is number => id !== undefined);
        const groupId = await withBusy(async () => {
            if (await groupExists(ctx.chromeGroupId)) {
                await chrome.tabs.group({ groupId: ctx.chromeGroupId as number, tabIds: ids(tabIds) });
                return ctx.chromeGroupId as number;
            }
            const windowId = candidates[0].windowId;
            const id = await chrome.tabs.group({ tabIds: ids(tabIds), createProperties: { windowId } });
            await styleGroup(id, task);
            return id;
        });
        next = { ...ctx, chromeGroupId: groupId, tabs: snapshot(await getGroupTabs(groupId)) };
    } else {
        next = { ...ctx, tabs: dedupeTabsByUrl([...ctx.tabs, ...snapshot(candidates)]) };
    }

    return { success: true, task: await saveTask({ ...task, context: next }) };
}

async function removeTabFromTask(payload: RemoveTabPayload): Promise<ContextResponse> {
    const task = await resolveTask(payload.task);
    const ctx = getContext(task);

    if (ctx.state === 'active' && (await groupExists(ctx.chromeGroupId))) {
        const live = await getGroupTabs(ctx.chromeGroupId as number);
        const matching = live
            .filter(tab => (tab.url || tab.pendingUrl) === payload.url)
            .map(tab => tab.id)
            .filter((id): id is number => id !== undefined);
        if (matching.length) await withBusy(() => chrome.tabs.ungroup(ids(matching)));
    }

    const next: TaskContext = { ...ctx, tabs: ctx.tabs.filter(tab => tab.url !== payload.url) };
    return { success: true, task: await saveTask({ ...task, context: next }) };
}

async function setSummary(payload: SetSummaryPayload): Promise<ContextResponse> {
    const task = await getTask(payload.taskId);
    if (!task) return { error: 'Task not found' };
    const ctx = getContext(task);
    // Only attach it to the park it was generated for
    if (ctx.state !== 'parked' || ctx.parkedAt !== payload.parkedAt) return { success: true, task };
    const summary = payload.summary.trim().slice(0, 600);
    return { success: true, task: await saveTask({ ...task, context: { ...ctx, aiSummary: summary || undefined } }) };
}

/** Called when a task is deleted: release its tabs (never close them) */
export async function releaseContextForDeletedTask(taskId: string): Promise<void> {
    if ((await getActiveTaskId()) !== taskId) return;
    await setActiveTaskId(null);
    const task = await getTask(taskId);
    const groupId = task?.context?.chromeGroupId;
    if (await groupExists(groupId)) {
        const tabIds = (await getGroupTabs(groupId as number))
            .map(t => t.id)
            .filter((id): id is number => id !== undefined);
        if (tabIds.length) await withBusy(() => chrome.tabs.ungroup(ids(tabIds)));
    }
}

// ---------------------------------------------------------------------------
// Keep the active context in step with what the user does in the browser
// ---------------------------------------------------------------------------

let snapshotTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSnapshot() {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
        snapshotActiveContext().catch(error => console.warn('Context snapshot failed', error));
    }, SNAPSHOT_DEBOUNCE_MS);
}

async function getActiveTask(): Promise<Task | null> {
    const activeId = await getActiveTaskId();
    if (!activeId) return null;
    const task = await getTask(activeId);
    return task && getContext(task).state === 'active' ? task : null;
}

/** Mirror the live tab group into the saved context, so a crash never loses it */
async function snapshotActiveContext(): Promise<void> {
    if (busy) return scheduleSnapshot();
    const task = await getActiveTask();
    if (!task) return;
    const ctx = getContext(task);
    if (!(await groupExists(ctx.chromeGroupId))) return;
    const tabs = snapshot(await getGroupTabs(ctx.chromeGroupId as number));
    // The group is closing tab by tab; tabGroups.onRemoved will park with the last good snapshot
    if (tabs.length === 0) return;
    if (sameTabs(tabs, ctx.tabs)) return;
    await saveTask({ ...task, context: { ...ctx, tabs } });
}

/**
 * Re-bind the active context after a service-worker or browser restart. Group ids are only stable
 * within a browser session; Chrome may restore the group with a new id, so match it by title.
 */
async function reconcileActiveContext(): Promise<void> {
    const task = await getActiveTask();
    if (!task) return;
    const ctx = getContext(task);
    if (await groupExists(ctx.chromeGroupId)) return;

    const groups = await chrome.tabGroups.query({ title: groupTitleForTask(task) });
    if (groups.length > 0) {
        const group = groups[0];
        await saveTask({ ...task, context: { ...ctx, chromeGroupId: group.id, windowId: group.windowId } });
        return;
    }
    await parkTask(task, { closeTabs: false, auto: true });
}

chrome.tabs.onCreated.addListener(tab => {
    if (busy) return;
    (async () => {
        const settings = await getSettings();
        if (!settings.autoAddNewTabs || tab.pinned || tab.id === undefined) return;
        if ((tab.pendingUrl || tab.url || '').startsWith(extensionBaseUrl())) return;
        if (tab.groupId !== undefined && tab.groupId !== NO_GROUP) return;

        const task = await getActiveTask();
        if (!task) return;
        const ctx = getContext(task);
        if (ctx.windowId !== tab.windowId) return;
        // The group is gone (e.g. browser restart restoring tabs, window ids can repeat): don't regroup
        if (ctx.chromeGroupId !== null && ctx.chromeGroupId !== undefined && !(await groupExists(ctx.chromeGroupId))) {
            return;
        }

        await withBusy(async () => {
            if (await groupExists(ctx.chromeGroupId)) {
                await chrome.tabs.group({ groupId: ctx.chromeGroupId as number, tabIds: [tab.id as number] });
            } else {
                const groupId = await chrome.tabs.group({
                    tabIds: [tab.id as number],
                    createProperties: { windowId: tab.windowId },
                });
                await styleGroup(groupId, task);
                await saveTask({ ...task, context: { ...ctx, chromeGroupId: groupId } });
            }
        });
        scheduleSnapshot();
    })().catch(error => console.warn('Auto-add tab to context failed', error));
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.groupId !== undefined || changeInfo.title !== undefined) {
        scheduleSnapshot();
    }
});
chrome.tabs.onRemoved.addListener(() => scheduleSnapshot());
chrome.tabs.onMoved.addListener(() => scheduleSnapshot());

// The user closed or ungrouped the whole group by hand: park it, keeping the last snapshot
chrome.tabGroups.onRemoved.addListener(group => {
    if (busy) return;
    (async () => {
        const task = await getActiveTask();
        if (!task || getContext(task).chromeGroupId !== group.id) return;
        await parkTask(task, { closeTabs: false, auto: true });
    })().catch(error => console.warn('Auto-park failed', error));
});

// Give Chrome time to restore windows and tab groups before deciding the active group is gone
const RECONCILE_DELAY_MS = 5000;
const scheduleReconcile = () =>
    setTimeout(() => {
        reconcileActiveContext().catch(error => console.warn('Context reconcile failed', error));
    }, RECONCILE_DELAY_MS);

chrome.runtime.onStartup.addListener(scheduleReconcile);
// Service worker woke up mid-session
scheduleReconcile();

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

export const CONTEXT_MESSAGE_TYPES: string[] = Object.values(CONTEXT_MESSAGES);

export function handleContextMessage(message: ExtensionMessage, sendResponse: (response: ContextResponse) => void) {
    const run = async (): Promise<ContextResponse> => {
        switch (message.type) {
            case CONTEXT_MESSAGES.START: {
                const { task, windowId } = message.payload as StartContextPayload;
                return startTask(task, windowId, false);
            }
            case CONTEXT_MESSAGES.RESUME: {
                const { task, windowId } = message.payload as StartContextPayload;
                return startTask(task, windowId, true);
            }
            case CONTEXT_MESSAGES.PARK: {
                const payload = message.payload as ParkContextPayload;
                const settings = await getSettings();
                const task = await parkTask(await resolveTask(payload.task), {
                    note: payload.note,
                    closeTabs: payload.closeTabs ?? settings.closeTabsOnPark,
                    keepOpenUrls: payload.keepOpenUrls,
                });
                return { success: true, task };
            }
            case CONTEXT_MESSAGES.PARK_ACTIVE: {
                const active = await getActiveTask();
                if (!active) return { success: true };
                const settings = await getSettings();
                return { success: true, task: await parkTask(active, { closeTabs: settings.closeTabsOnPark }) };
            }
            case CONTEXT_MESSAGES.ADD_TABS:
                return addTabsToTask(message.payload as AddTabsPayload);
            case CONTEXT_MESSAGES.REMOVE_TAB:
                return removeTabFromTask(message.payload as RemoveTabPayload);
            case CONTEXT_MESSAGES.SET_SUMMARY:
                return setSummary(message.payload as SetSummaryPayload);
            default:
                return { error: `Unknown context message: ${message.type}` };
        }
    };

    run()
        .then(sendResponse)
        .catch((error: unknown) => {
            console.error('Task context error', error);
            try {
                sendResponse({ error: (error as Error).message });
            } catch {
                // Channel closed
            }
        });

    return true;
}
