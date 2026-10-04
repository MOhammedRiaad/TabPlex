/* eslint-disable @typescript-eslint/no-explicit-any */
// An in-memory fake of the chrome.* APIs TabPlex uses: storage, runtime messaging, tabs, tab groups,
// windows, bookmarks, history, sessions and action. It keeps real state (tabs live in
// windows, groups disappear when empty, events fire) so background services can be tested end to end.
import { vi } from 'vitest';

type Listener = (...args: any[]) => any;

export class FakeEvent<T extends Listener = Listener> {
    readonly listeners = new Set<T>();
    addListener = (listener: T) => {
        this.listeners.add(listener);
    };
    removeListener = (listener: T) => {
        this.listeners.delete(listener);
    };
    hasListener = (listener: T) => this.listeners.has(listener);
    hasListeners = () => this.listeners.size > 0;
    emit(...args: Parameters<T>): unknown[] {
        return [...this.listeners].map(listener => listener(...args));
    }
}

export interface FakeTab {
    id: number;
    windowId: number;
    index: number;
    url?: string;
    pendingUrl?: string;
    title?: string;
    favIconUrl?: string;
    pinned: boolean;
    active: boolean;
    groupId: number;
    status?: string;
}

export interface FakeGroup {
    id: number;
    windowId: number;
    title?: string;
    color: string;
    collapsed: boolean;
}

export const EXTENSION_ID = 'test-extension-id';
export const EXTENSION_BASE = `chrome-extension://${EXTENSION_ID}/`;

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

export function createChromeMock() {
    const store: Record<string, unknown> = {};
    const tabs = new Map<number, FakeTab>();
    const groups = new Map<number, FakeGroup>();
    const windows = new Set<number>([1]);
    let lastFocusedWindow = 1;
    let nextTabId = 100;
    let nextGroupId = 500;
    let nextWindowId = 2;

    const events = {
        runtimeMessage: new FakeEvent(),
        installed: new FakeEvent(),
        startup: new FakeEvent(),
        storageChanged: new FakeEvent(),
        tabCreated: new FakeEvent(),
        tabUpdated: new FakeEvent(),
        tabRemoved: new FakeEvent(),
        tabActivated: new FakeEvent(),
        tabMoved: new FakeEvent(),
        groupRemoved: new FakeEvent(),
        groupUpdated: new FakeEvent(),
        actionClicked: new FakeEvent(),
        bookmarkChanged: new FakeEvent(),
        bookmarkCreated: new FakeEvent(),
        bookmarkRemoved: new FakeEvent(),
        bookmarkMoved: new FakeEvent(),
    };

    // ----- storage -----------------------------------------------------------------------------
    const resolveKeys = (keys?: string | string[] | Record<string, unknown> | null) => {
        if (keys === undefined || keys === null) return { names: Object.keys(store), defaults: {} };
        if (typeof keys === 'string') return { names: [keys], defaults: {} };
        if (Array.isArray(keys)) return { names: keys, defaults: {} };
        return { names: Object.keys(keys), defaults: keys };
    };

    const local = {
        get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
            const { names, defaults } = resolveKeys(keys);
            const result: Record<string, unknown> = {};
            for (const name of names) {
                if (name in store) result[name] = clone(store[name]);
                else if (name in defaults) result[name] = (defaults as Record<string, unknown>)[name];
            }
            return result;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
            const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
            for (const [key, value] of Object.entries(items)) {
                changes[key] = { oldValue: clone(store[key]), newValue: clone(value) };
                store[key] = clone(value);
            }
            events.storageChanged.emit(changes, 'local');
        }),
        remove: vi.fn(async (keys: string | string[]) => {
            const changes: Record<string, { oldValue?: unknown }> = {};
            for (const key of Array.isArray(keys) ? keys : [keys]) {
                if (key in store) changes[key] = { oldValue: clone(store[key]) };
                delete store[key];
            }
            events.storageChanged.emit(changes, 'local');
        }),
        clear: vi.fn(async () => {
            for (const key of Object.keys(store)) delete store[key];
        }),
    };

    // ----- runtime messaging -----------------------------------------------------------------
    /**
     * Delivers a message to every runtime.onMessage listener (like Chrome does across extension pages)
     * and resolves with the first response. Listeners returning `true` may answer asynchronously.
     */
    const sendMessage = vi.fn((message: unknown, callback?: (response: unknown) => void) => {
        const promise = new Promise<unknown>(resolve => {
            let settled = false;
            let keepOpen = false;
            const sendResponse = (response: unknown) => {
                if (settled) return;
                settled = true;
                resolve(response);
            };
            for (const listener of [...events.runtimeMessage.listeners]) {
                const result = listener(message, { id: EXTENSION_ID }, sendResponse);
                if (result === true) keepOpen = true;
            }
            if (!keepOpen && !settled) {
                settled = true;
                resolve(undefined);
            }
        });
        if (callback) promise.then(callback);
        return promise;
    });

    // ----- tabs & groups -----------------------------------------------------------------------
    const tabsInWindow = (windowId: number) =>
        [...tabs.values()].filter(t => t.windowId === windowId).sort((a, b) => a.index - b.index);

    const reindex = (windowId: number) => tabsInWindow(windowId).forEach((t, i) => (t.index = i));

    const dropEmptyGroups = () => {
        for (const group of [...groups.values()]) {
            if (![...tabs.values()].some(t => t.groupId === group.id)) {
                groups.delete(group.id);
                events.groupRemoved.emit(clone(group));
            }
        }
    };

    const getTabOrThrow = (id: number) => {
        const tab = tabs.get(id);
        if (!tab) throw new Error(`No tab with id: ${id}.`);
        return tab;
    };

    const createTab = async (props: Partial<FakeTab> & { url?: string }): Promise<FakeTab> => {
        const windowId = props.windowId ?? lastFocusedWindow;
        if (!windows.has(windowId)) throw new Error(`No window with id: ${windowId}.`);
        const tab: FakeTab = {
            id: nextTabId++,
            windowId,
            index: tabsInWindow(windowId).length,
            url: props.url ?? 'chrome://newtab/',
            title: props.url,
            pinned: props.pinned ?? false,
            active: props.active ?? true,
            groupId: -1,
            status: 'complete',
        };
        tabs.set(tab.id, tab);
        events.tabCreated.emit(clone(tab));
        return clone(tab);
    };

    const tabsApi = {
        TAB_ID_NONE: -1,
        create: vi.fn((props: Partial<FakeTab> & { url?: string }, callback?: (tab: FakeTab) => void) => {
            const created = createTab(props);
            if (callback) created.then(callback);
            return created;
        }),
        get: vi.fn(async (id: number) => clone(getTabOrThrow(id))),
        query: vi.fn(async (query: Record<string, any> = {}) => {
            return [...tabs.values()]
                .filter(t => query.groupId === undefined || t.groupId === query.groupId)
                .filter(t => query.windowId === undefined || t.windowId === query.windowId)
                .filter(t => !query.currentWindow || t.windowId === lastFocusedWindow)
                .filter(t => query.active === undefined || t.active === query.active)
                .filter(t => query.pinned === undefined || t.pinned === query.pinned)
                .filter(t => {
                    if (!query.url) return true;
                    // Like Chrome, fragment identifiers are not matched
                    const urls = Array.isArray(query.url) ? query.url : [query.url];
                    return urls.includes((t.url ?? '').split('#')[0]);
                })
                .sort((a, b) => a.windowId - b.windowId || a.index - b.index)
                .map(clone);
        }),
        update: vi.fn(async (id: number, props: Partial<FakeTab>) => {
            const tab = getTabOrThrow(id);
            Object.assign(tab, props);
            events.tabUpdated.emit(id, props, clone(tab));
            return clone(tab);
        }),
        remove: vi.fn(async (ids: number | number[]) => {
            for (const id of Array.isArray(ids) ? ids : [ids]) {
                const tab = getTabOrThrow(id);
                tabs.delete(id);
                reindex(tab.windowId);
                events.tabRemoved.emit(id, { windowId: tab.windowId, isWindowClosing: false });
            }
            dropEmptyGroups();
        }),
        group: vi.fn(
            async (options: {
                tabIds: number | number[];
                groupId?: number;
                createProperties?: { windowId?: number };
            }) => {
                const ids = Array.isArray(options.tabIds) ? options.tabIds : [options.tabIds];
                if (ids.length === 0) throw new Error('tabIds must not be empty');
                let groupId = options.groupId;
                if (groupId === undefined) {
                    const windowId = options.createProperties?.windowId ?? getTabOrThrow(ids[0]).windowId;
                    groupId = nextGroupId++;
                    groups.set(groupId, { id: groupId, windowId, color: 'grey', collapsed: false });
                } else if (!groups.has(groupId)) {
                    throw new Error(`No group with id: ${groupId}.`);
                }
                for (const id of ids) {
                    const tab = getTabOrThrow(id);
                    tab.groupId = groupId;
                    events.tabUpdated.emit(id, { groupId }, clone(tab));
                }
                dropEmptyGroups();
                return groupId;
            }
        ),
        ungroup: vi.fn(async (ids: number | number[]) => {
            for (const id of Array.isArray(ids) ? ids : [ids]) {
                const tab = getTabOrThrow(id);
                tab.groupId = -1;
                events.tabUpdated.emit(id, { groupId: -1 }, clone(tab));
            }
            dropEmptyGroups();
        }),
        onCreated: events.tabCreated,
        onUpdated: events.tabUpdated,
        onRemoved: events.tabRemoved,
        onActivated: events.tabActivated,
        onMoved: events.tabMoved,
    };

    const tabGroupsApi = {
        TAB_GROUP_ID_NONE: -1,
        get: vi.fn(async (id: number) => {
            const group = groups.get(id);
            if (!group) throw new Error(`No group with id: ${id}.`);
            return clone(group);
        }),
        query: vi.fn(async (query: { title?: string; windowId?: number } = {}) =>
            [...groups.values()]
                .filter(g => query.title === undefined || g.title === query.title)
                .filter(g => query.windowId === undefined || g.windowId === query.windowId)
                .map(clone)
        ),
        update: vi.fn(async (id: number, props: Partial<FakeGroup>) => {
            const group = groups.get(id);
            if (!group) throw new Error(`No group with id: ${id}.`);
            Object.assign(group, props);
            events.groupUpdated.emit(clone(group));
            return clone(group);
        }),
        onRemoved: events.groupRemoved,
        onUpdated: events.groupUpdated,
    };

    const windowsApi = {
        WINDOW_ID_CURRENT: -2,
        get: vi.fn(async (id: number) => {
            if (!windows.has(id)) throw new Error(`No window with id: ${id}.`);
            return { id, focused: id === lastFocusedWindow, type: 'normal' };
        }),
        getCurrent: vi.fn(async () => ({ id: lastFocusedWindow, focused: true, type: 'normal' })),
        getLastFocused: vi.fn(async () => ({ id: lastFocusedWindow, focused: true, type: 'normal' })),
        update: vi.fn(async (id: number, props: { focused?: boolean }) => {
            if (!windows.has(id)) throw new Error(`No window with id: ${id}.`);
            if (props.focused) lastFocusedWindow = id;
            return { id };
        }),
    };

    const chrome = {
        runtime: {
            id: EXTENSION_ID,
            lastError: undefined as { message: string } | undefined,
            getURL: vi.fn((path: string) => `${EXTENSION_BASE}${path.replace(/^\//, '')}`),
            sendMessage,
            onMessage: events.runtimeMessage,
            onInstalled: events.installed,
            onStartup: events.startup,
        },
        storage: { local, onChanged: events.storageChanged },
        tabs: tabsApi,
        tabGroups: tabGroupsApi,
        windows: windowsApi,
        action: { onClicked: events.actionClicked },
        history: {
            search: vi.fn(async () => [] as unknown[]),
        },
        sessions: {
            getRecentlyClosed: vi.fn(async () => [] as unknown[]),
        },
        notifications: {
            create: vi.fn(),
        },
        bookmarks: {
            getTree: vi.fn(async () => [] as unknown[]),
            get: vi.fn(async () => [] as unknown[]),
            getChildren: vi.fn(async () => [] as unknown[]),
            search: vi.fn(async () => [] as unknown[]),
            create: vi.fn(async (props: Record<string, unknown>) => ({ id: 'bm-new', ...props })),
            update: vi.fn(async (id: string, changes: Record<string, unknown>) => ({ id, ...changes })),
            move: vi.fn(async (id: string, destination: Record<string, unknown>) => ({ id, ...destination })),
            remove: vi.fn(async () => undefined),
            removeTree: vi.fn(async () => undefined),
            onChanged: events.bookmarkChanged,
            onCreated: events.bookmarkCreated,
            onRemoved: events.bookmarkRemoved,
            onMoved: events.bookmarkMoved,
        },
    };

    /** Test helpers to arrange browser state directly */
    const browser = {
        store,
        tabs,
        groups,
        events,
        get lastFocusedWindow() {
            return lastFocusedWindow;
        },
        openWindow(): number {
            const id = nextWindowId++;
            windows.add(id);
            lastFocusedWindow = id;
            return id;
        },
        closeWindow(id: number) {
            windows.delete(id);
            for (const tab of tabsInWindow(id)) tabs.delete(tab.id);
            dropEmptyGroups();
        },
        /** Add a tab without firing onCreated (pre-existing state) */
        addTab(props: Partial<FakeTab> & { url: string }): FakeTab {
            const windowId = props.windowId ?? lastFocusedWindow;
            windows.add(windowId);
            const tab: FakeTab = {
                id: nextTabId++,
                index: tabsInWindow(windowId).length,
                title: props.url,
                pinned: false,
                active: false,
                groupId: -1,
                status: 'complete',
                ...props,
                windowId,
            };
            tabs.set(tab.id, tab);
            return tab;
        },
        addGroup(props: Partial<FakeGroup> & { tabIds: number[] }): FakeGroup {
            const id = nextGroupId++;
            const windowId = props.windowId ?? getTabOrThrow(props.tabIds[0]).windowId;
            const group: FakeGroup = { id, windowId, color: 'grey', collapsed: false, title: props.title };
            groups.set(id, group);
            for (const tabId of props.tabIds) getTabOrThrow(tabId).groupId = id;
            return group;
        },
        groupTabs(groupId: number): FakeTab[] {
            return [...tabs.values()].filter(t => t.groupId === groupId);
        },
    };

    return { chrome, browser };
}

export type ChromeMock = ReturnType<typeof createChromeMock>;

/** Install a fresh fake as `globalThis.chrome` and return its helpers */
export function installChromeMock(): ChromeMock {
    const mock = createChromeMock();
    (globalThis as any).chrome = mock.chrome;
    return mock;
}

/** Let pending promise callbacks and zero-delay timers run */
export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Answer runtime messages in a test, as a background script would. Return `undefined` to not respond.
 * Returns the list of messages received.
 */
export function respondToMessages(handler: (message: any) => unknown = () => undefined) {
    const received: any[] = [];
    chrome.runtime.onMessage.addListener(((message: any, _sender: unknown, sendResponse: (r: unknown) => void) => {
        received.push(message);
        const response = handler(message);
        if (response instanceof Error) throw response;
        if (response !== undefined) sendResponse(response);
        return false;
    }) as any);
    return received;
}

export type MockChrome = ReturnType<typeof createChromeMock>['chrome'];

/** The installed fake, typed as the mock (vi.fn) rather than the real chrome.* signatures */
export const fakeChrome = (): MockChrome => (globalThis as any).chrome;
