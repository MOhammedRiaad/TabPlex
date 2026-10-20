/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, fakeChrome } from '../../test/chromeMock';
import { makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../test/factories';

type Handler = (message: { type: string; payload?: unknown }, sendResponse: (r: any) => void) => boolean;

let mock: ChromeMock;
let handlers: Record<string, Handler>;

function call(handler: Handler, type: string, payload?: unknown) {
    const sendResponse = vi.fn();
    const keepOpen = handler({ type, payload }, sendResponse);
    return { keepOpen, sendResponse };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

function deferred<T = unknown>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => (resolve = r));
    return { promise, resolve };
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'Date'] });
    mock = installChromeMock();
    vi.resetModules();
    handlers = {
        task: (await import('../task-service')).handleTaskMessage as Handler,
        note: (await import('../note-service')).handleNoteMessage as Handler,
        folder: (await import('../folder-service')).handleFolderMessage as Handler,
        session: (await import('../session-service')).handleSessionMessage as Handler,
        history: (await import('../history-service')).handleHistoryMessage as Handler,
        bookmark: (await import('../bookmark-service')).handleBookmarkMessage as Handler,
        data: (await import('../data-service')).handleDataMessage as Handler,
    };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => vi.useRealTimers());

/** Messages broadcast to other extension pages */
function broadcasts() {
    return vi
        .mocked(chrome.runtime.sendMessage)
        .mock.calls.map(c => (c[0] as unknown as { type: string }).type)
        .filter(t => t.startsWith('STORAGE_'));
}

const store = () => mock.browser.store;

interface Case {
    handler: string;
    type: string;
    payload?: unknown;
    arrange?: () => Promise<void> | void;
    expected: unknown;
    after?: () => void | Promise<void>;
    /** API that the handler waits on */
    api: () => any;
    timeoutMs: number;
    timeoutResponse?: unknown;
}

const storageGet = () => chrome.storage.local.get;

const cases: Case[] = [
    {
        handler: 'task',
        type: 'ADD_TASK',
        payload: makeTask(),
        expected: { success: true },
        after: () => expect(broadcasts()).toContain('STORAGE_TASK_ADDED'),
        api: storageGet,
        timeoutMs: 1000,
        timeoutResponse: { success: true },
    },
    {
        handler: 'task',
        type: 'DELETE_TASK',
        payload: { id: 'task_1' },
        arrange: () => chrome.storage.local.set({ tabboard_tasks: [makeTask()] }),
        expected: { success: true },
        after: () => {
            expect(store().tabboard_tasks).toEqual([]);
            expect(broadcasts()).toContain('STORAGE_TASK_DELETED');
        },
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'note',
        type: 'ADD_NOTE',
        payload: makeNote(),
        expected: { success: true },
        after: () => expect(broadcasts()).toContain('STORAGE_NOTE_ADDED'),
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'note',
        type: 'UPDATE_NOTE',
        payload: makeNote({ title: 'Edited', content: 'Edited' }),
        arrange: () => chrome.storage.local.set({ tabboard_notes: [makeNote()] }),
        expected: { success: true },
        after: () => {
            expect(store().tabboard_notes).toEqual([expect.objectContaining({ id: 'note_1', content: 'Edited' })]);
            expect(broadcasts()).toContain('STORAGE_NOTE_UPDATED');
        },
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'note',
        type: 'DELETE_NOTE',
        payload: { id: 'note_1' },
        arrange: () => chrome.storage.local.set({ tabboard_notes: [makeNote()] }),
        expected: { success: true },
        after: () => expect(broadcasts()).toContain('STORAGE_NOTE_DELETED'),
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'folder',
        type: 'ADD_FOLDER',
        payload: makeFolder(),
        expected: { success: true },
        after: () => expect(broadcasts()).toContain('STORAGE_FOLDER_ADDED'),
        api: storageGet,
        timeoutMs: 1000,
        timeoutResponse: { success: true },
    },
    {
        handler: 'folder',
        type: 'DELETE_FOLDER',
        payload: { id: 'folder_1' },
        arrange: () =>
            chrome.storage.local.set({
                tabboard_folders: [makeFolder()],
                tabboard_tabs: [makeTab({ id: 't1' }), makeTab({ id: 't2', folderId: 'keep' })],
            }),
        expected: { success: true },
        after: () => {
            expect(store().tabboard_folders).toEqual([]);
            expect((store().tabboard_tabs as any[]).map(t => t.id)).toEqual(['t2']);
        },
        api: storageGet,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Delete folder timed out' },
    },
    {
        handler: 'session',
        type: 'GET_SESSIONS',
        arrange: () => chrome.storage.local.set({ tabboard_sessions: [makeSession()] }),
        expected: [makeSession()],
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'session',
        type: 'ADD_SESSION',
        payload: makeSession(),
        expected: { success: true },
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'session',
        type: 'UPDATE_SESSION',
        payload: makeSession({ name: 'Renamed' }),
        expected: { success: true },
        after: () => expect((store().tabboard_sessions as any[])[0].name).toBe('Renamed'),
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'session',
        type: 'DELETE_SESSION',
        payload: { id: 'session_1' },
        expected: { success: true },
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'session',
        type: 'GET_SESSION',
        payload: { id: 'session_1' },
        arrange: () => chrome.storage.local.set({ tabboard_sessions: [makeSession()] }),
        expected: makeSession(),
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'history',
        type: 'GET_HISTORY',
        arrange: () => chrome.storage.local.set({ history_items: [{ id: 'h1' }] }),
        expected: [{ id: 'h1' }],
        api: storageGet,
        timeoutMs: 1000,
        timeoutResponse: { error: 'Timeout getting history' },
    },
    {
        handler: 'history',
        type: 'ADD_HISTORY',
        payload: { id: 'h1', url: 'u', title: 't' },
        expected: { success: true },
        api: storageGet,
        timeoutMs: 1000,
        timeoutResponse: { success: true },
    },
    {
        handler: 'history',
        type: 'UPDATE_HISTORY',
        payload: { id: 'h1', updates: { title: 'new' } },
        arrange: () => chrome.storage.local.set({ history_items: [{ id: 'h1', title: 'old', url: 'u' }] }),
        expected: { success: true },
        after: () => expect((store().history_items as any[])[0]).toEqual({ id: 'h1', title: 'new', url: 'u' }),
        api: storageGet,
        timeoutMs: 1000,
        timeoutResponse: { success: true },
    },
    {
        handler: 'history',
        type: 'DELETE_HISTORY',
        payload: { id: 'h1' },
        expected: { success: true },
        api: storageGet,
        timeoutMs: 1000,
        timeoutResponse: { success: true },
    },
    {
        handler: 'history',
        type: 'GET_HISTORY_ITEM',
        payload: { id: 'h1' },
        arrange: () => chrome.storage.local.set({ history_items: [{ id: 'h1' }] }),
        expected: { id: 'h1' },
        api: storageGet,
        timeoutMs: 1000,
    },
    {
        handler: 'history',
        type: 'GET_BROWSER_HISTORY',
        arrange: () => {
            vi.mocked(fakeChrome().history.search).mockResolvedValue([{ id: 'b1', url: 'https://x' }]);
        },
        expected: [{ id: 'b1', url: 'https://x' }],
        api: () => chrome.history.search,
        timeoutMs: 3000,
    },
    {
        handler: 'bookmark',
        type: 'GET_BOOKMARKS',
        arrange: () => {
            vi.mocked(fakeChrome().bookmarks.getTree).mockResolvedValue([
                { id: '0', title: '', children: [{ id: '1', title: 'Bar', parentId: '0', dateAdded: 5 }] },
            ]);
        },
        expected: [
            expect.objectContaining({
                id: '0',
                children: [expect.objectContaining({ id: '1', title: 'Bar', parentId: '0', dateAdded: 5 })],
            }),
        ],
        api: () => chrome.bookmarks.getTree,
        timeoutMs: 3000,
        timeoutResponse: { error: 'Timeout getting bookmarks' },
    },
    {
        handler: 'bookmark',
        type: 'GET_BOOKMARK',
        payload: { id: 'b' },
        arrange: () => {
            vi.mocked(fakeChrome().bookmarks.get).mockResolvedValue([{ id: 'b', title: 'B', parentId: 'p' }]);
        },
        expected: expect.objectContaining({ id: 'b', title: 'B', parentId: 'p' }),
        api: () => chrome.bookmarks.get,
        timeoutMs: 1000,
    },
    {
        handler: 'bookmark',
        type: 'CREATE_BOOKMARK',
        payload: { title: 'B', url: 'https://b' },
        expected: expect.objectContaining({ id: 'bm-new', title: 'B', url: 'https://b' }),
        api: () => chrome.bookmarks.create,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Timeout creating bookmark' },
    },
    {
        handler: 'bookmark',
        type: 'CREATE_BOOKMARK_FOLDER',
        payload: { title: 'Dir', parentId: '1' },
        expected: expect.objectContaining({ id: 'bm-new', title: 'Dir', parentId: '1' }),
        api: () => chrome.bookmarks.create,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Timeout creating bookmark folder' },
    },
    {
        handler: 'bookmark',
        type: 'UPDATE_BOOKMARK',
        payload: { id: 'b', changes: { title: 'New' } },
        expected: expect.objectContaining({ id: 'b', title: 'New' }),
        api: () => chrome.bookmarks.update,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Timeout updating bookmark' },
    },
    {
        handler: 'bookmark',
        type: 'MOVE_BOOKMARK',
        payload: { id: 'b', destination: { parentId: '2' } },
        expected: expect.objectContaining({ id: 'b', parentId: '2' }),
        api: () => chrome.bookmarks.move,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Timeout moving bookmark' },
    },
    {
        handler: 'bookmark',
        type: 'DELETE_BOOKMARK',
        payload: { id: 'b' },
        expected: { success: true },
        api: () => chrome.bookmarks.remove,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Timeout deleting bookmark' },
    },
    {
        handler: 'bookmark',
        type: 'DELETE_BOOKMARK_TREE',
        payload: { id: 'b' },
        expected: { success: true },
        api: () => chrome.bookmarks.removeTree,
        timeoutMs: 3000,
        timeoutResponse: { error: 'Timeout deleting bookmark tree' },
    },
    {
        handler: 'bookmark',
        type: 'SEARCH_BOOKMARKS',
        payload: { query: 'git' },
        arrange: () => {
            vi.mocked(fakeChrome().bookmarks.search).mockResolvedValue([{ id: 's', title: 'GitHub' }]);
        },
        expected: [expect.objectContaining({ id: 's', title: 'GitHub' })],
        api: () => chrome.bookmarks.search,
        timeoutMs: 3000,
        timeoutResponse: { error: 'Timeout searching bookmarks' },
    },
    {
        handler: 'bookmark',
        type: 'GET_BOOKMARK_CHILDREN',
        payload: { id: '1' },
        arrange: () => {
            vi.mocked(fakeChrome().bookmarks.getChildren).mockResolvedValue([{ id: 'c', title: 'Child' }]);
        },
        expected: [expect.objectContaining({ id: 'c' })],
        api: () => chrome.bookmarks.getChildren,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Timeout getting bookmark children' },
    },
    {
        handler: 'data',
        type: 'EXPORT_ALL_DATA',
        arrange: () => chrome.storage.local.set({ tabboard_tasks: [makeTask()], history_items: [{ id: 'h' }] }),
        expected: {
            boards: [],
            folders: [],
            tabs: [],
            tasks: [makeTask()],
            notes: [],
            sessions: [],
            history: [{ id: 'h' }],
        },
        api: storageGet,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Export timed out' },
    },
    {
        handler: 'data',
        type: 'IMPORT_ALL_DATA',
        payload: { tasks: [makeTask()], history: [{ id: 'h' }] },
        expected: { success: true },
        after: () => {
            expect(store().tabboard_tasks).toEqual([makeTask()]);
            expect(store().history_items).toEqual([{ id: 'h' }]);
            expect(store().tabboard_notes).toEqual([]);
            expect(broadcasts()).toContain('STORAGE_DATA_IMPORTED');
        },
        api: () => chrome.storage.local.set,
        timeoutMs: 2000,
        timeoutResponse: { error: 'Import timed out' },
    },
];

describe.each(cases)('$handler · $type', c => {
    it('responds with the result', async () => {
        await c.arrange?.();
        const { keepOpen, sendResponse } = call(handlers[c.handler], c.type, c.payload);
        expect(keepOpen).toBe(true);
        await flush();
        expect(sendResponse).toHaveBeenCalledTimes(1);
        expect(sendResponse).toHaveBeenCalledWith(c.expected);
        await c.after?.();
        // The timeout never sends a second response
        await vi.advanceTimersByTimeAsync(c.timeoutMs);
        expect(sendResponse).toHaveBeenCalledTimes(1);
    });

    it('reports errors', async () => {
        await c.arrange?.();
        vi.mocked(c.api()).mockRejectedValue(new Error('boom'));
        const { sendResponse } = call(handlers[c.handler], c.type, c.payload);
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'boom' });
        await vi.advanceTimersByTimeAsync(c.timeoutMs);
        expect(sendResponse).toHaveBeenCalledTimes(1);
    });

    it('times out', async () => {
        await c.arrange?.();
        const pending = deferred();
        vi.mocked(c.api()).mockReturnValue(pending.promise);
        const { sendResponse } = call(handlers[c.handler], c.type, c.payload);
        await vi.advanceTimersByTimeAsync(c.timeoutMs);
        if (c.timeoutResponse === undefined) expect(sendResponse).not.toHaveBeenCalled();
        else expect(sendResponse).toHaveBeenCalledWith(c.timeoutResponse);
        // A late result is ignored
        pending.resolve(c.api === storageGet ? {} : []);
        await flush();
        expect(sendResponse.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('survives a closed response channel', async () => {
        await c.arrange?.();
        const sendResponse = vi.fn(() => {
            throw new Error('closed');
        });
        handlers[c.handler]({ type: c.type, payload: c.payload }, sendResponse);
        await flush();
        await vi.advanceTimersByTimeAsync(c.timeoutMs);
        expect(console.warn).toHaveBeenCalledWith('Failed to send response:', expect.any(Error));
    });
});

describe('message validation', () => {
    it.each([
        ['task', 'ADD_TASK'],
        ['task', 'UPDATE_TASK'],
        ['task', 'DELETE_TASK'],
        ['note', 'ADD_NOTE'],
        ['note', 'UPDATE_NOTE'],
        ['note', 'DELETE_NOTE'],
        ['folder', 'ADD_FOLDER'],
        ['folder', 'DELETE_FOLDER'],
        ['session', 'ADD_SESSION'],
        ['session', 'UPDATE_SESSION'],
        ['session', 'DELETE_SESSION'],
        ['session', 'GET_SESSION'],
        ['history', 'ADD_HISTORY'],
        ['history', 'UPDATE_HISTORY'],
        ['history', 'DELETE_HISTORY'],
        ['history', 'GET_HISTORY_ITEM'],
        ['bookmark', 'GET_BOOKMARK'],
        ['bookmark', 'CREATE_BOOKMARK'],
        ['bookmark', 'CREATE_BOOKMARK_FOLDER'],
        ['bookmark', 'UPDATE_BOOKMARK'],
        ['bookmark', 'MOVE_BOOKMARK'],
        ['bookmark', 'DELETE_BOOKMARK'],
        ['bookmark', 'DELETE_BOOKMARK_TREE'],
        ['bookmark', 'SEARCH_BOOKMARKS'],
        ['bookmark', 'GET_BOOKMARK_CHILDREN'],
        ['data', 'IMPORT_ALL_DATA'],
        ['task', 'SOMETHING_ELSE'],
        ['note', 'SOMETHING_ELSE'],
        ['folder', 'SOMETHING_ELSE'],
        ['session', 'SOMETHING_ELSE'],
        ['history', 'SOMETHING_ELSE'],
        ['bookmark', 'SOMETHING_ELSE'],
        ['data', 'SOMETHING_ELSE'],
    ])('%s ignores %s without a payload', (handler, type) => {
        const { keepOpen, sendResponse } = call(handlers[handler], type);
        expect(keepOpen).toBe(false);
        expect(sendResponse).not.toHaveBeenCalled();
    });
});

describe('special cases', () => {
    it.each([
        ['clears the active task when the import no longer has it', 'gone', undefined],
        ['keeps the active task when the import still has it', 'kept', 'kept'],
    ])('IMPORT_ALL_DATA %s', async (_name, activeId, expected) => {
        await chrome.storage.local.set({ tabplex_active_context_task_id: activeId });
        const { sendResponse } = call(handlers.data, 'IMPORT_ALL_DATA', { tasks: [makeTask({ id: 'kept' })] });
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
        expect(store().tabplex_active_context_task_id).toBe(expected);
    });

    it('UPDATE_TASK keeps the stored context (owned by context-service)', async () => {
        const stored = makeTask({ context: { state: 'parked', tabs: [{ url: 'https://a', title: 'A' }] } });
        await chrome.storage.local.set({ tabboard_tasks: [stored] });
        const { sendResponse } = call(handlers.task, 'UPDATE_TASK', makeTask({ title: 'Edited', context: undefined }));
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
        expect((store().tabboard_tasks as any[])[0]).toMatchObject({ title: 'Edited', context: stored.context });
        expect(broadcasts()).toContain('STORAGE_TASK_UPDATED');
    });

    it('UPDATE_TASK upserts unknown tasks and reports errors', async () => {
        const { sendResponse } = call(handlers.task, 'UPDATE_TASK', makeTask({ id: 'new' }));
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
        vi.mocked(fakeChrome().storage.local.get).mockRejectedValueOnce(new Error('read failed'));
        const failed = call(handlers.task, 'UPDATE_TASK', makeTask());
        await flush();
        expect(failed.sendResponse).toHaveBeenCalledWith({ error: 'read failed' });
        const closed = vi.fn(() => {
            throw new Error('closed');
        });
        handlers.task({ type: 'UPDATE_TASK', payload: makeTask() }, closed);
        await flush();
        expect(console.warn).toHaveBeenCalled();
    });

    it('DELETE_TASK releases an active context first, even if that fails', async () => {
        await chrome.storage.local.set({ tabplex_active_context_task_id: 'task_1', tabboard_tasks: [makeTask()] });
        const { sendResponse } = call(handlers.task, 'DELETE_TASK', { id: 'task_1' });
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
        expect(store().tabplex_active_context_task_id).toBeUndefined();

        await chrome.storage.local.set({ tabplex_active_context_task_id: 'task_1', tabboard_tasks: [makeTask()] });
        vi.mocked(fakeChrome().storage.local.remove).mockRejectedValueOnce(new Error('cannot release'));
        const second = call(handlers.task, 'DELETE_TASK', { id: 'task_1' });
        await flush();
        expect(console.warn).toHaveBeenCalledWith('Could not release task context', expect.any(Error));
        expect(second.sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('DELETE_FOLDER can move tabs to another folder', async () => {
        await chrome.storage.local.set({ tabboard_tabs: [makeTab({ id: 't1' })] });
        call(handlers.folder, 'DELETE_FOLDER', { id: 'folder_1', moveTabs: true, targetFolderId: 'f2' });
        await flush();
        expect((store().tabboard_tabs as any[])[0].folderId).toBe('f2');
        call(handlers.folder, 'DELETE_FOLDER', { id: 'f2', moveTabs: true });
        await flush();
        expect((store().tabboard_tabs as any[])[0].folderId).toBe('');
    });

    it('UPDATE_HISTORY fails for unknown items', async () => {
        const { sendResponse } = call(handlers.history, 'UPDATE_HISTORY', { id: 'nope', updates: {} });
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'Item not found' });
    });

    it('GET_BOOKMARK reports a missing bookmark', async () => {
        const { sendResponse } = call(handlers.bookmark, 'GET_BOOKMARK', { id: 'x' });
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'Bookmark not found' });
    });

    it('logs session inference events', () => {
        expect(call(handlers.session, 'SESSION_INFERENCE_COMPLETE', {}).keepOpen).toBe(false);
        expect(console.log).toHaveBeenCalled();
    });
});

describe('session inference', () => {
    it('creates a session from tabs used in the last hour', async () => {
        const { inferSessions } = await import('../session-service');
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        await chrome.storage.local.set({
            tabboard_tabs: [
                makeTab({ id: 'recent', lastAccessed: '2026-10-03T11:30:00Z' }),
                makeTab({ id: 'old', lastAccessed: '2026-10-03T09:00:00Z' }),
            ],
        });
        await inferSessions();
        const [session] = store().tabboard_sessions as any[];
        expect(session.tabIds).toEqual(['recent']);
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'SESSION_INFERENCE_COMPLETE' })
        );
    });

    it('does nothing without recent tabs and logs failures', async () => {
        const { inferSessions } = await import('../session-service');
        await inferSessions();
        expect(store().tabboard_sessions).toBeUndefined();
        vi.mocked(fakeChrome().storage.local.get).mockRejectedValueOnce(new Error('x'));
        await inferSessions();
        expect(console.error).toHaveBeenCalledWith('Error inferring sessions:', expect.any(Error));
    });

    it('runs 5 seconds after startup', async () => {
        await chrome.storage.local.set({ tabboard_tabs: [makeTab({ lastAccessed: new Date().toISOString() })] });
        mock.browser.events.startup.emit();
        await vi.advanceTimersByTimeAsync(5000);
        expect((store().tabboard_sessions as any[]).length).toBe(1);
    });
});

describe('background storage', () => {
    it('serialises concurrent writes to the same key', async () => {
        const storage = await import('../storage');
        await Promise.all([1, 2, 3, 4, 5].map(i => storage.addTab(makeTab({ id: `t${i}` }))));
        expect((store().tabboard_tabs as any[]).map(t => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
        await Promise.all([
            storage.deleteTab('t1'),
            storage.updateTab(makeTab({ id: 't2', title: 'x' })),
            storage.deleteTab('t3'),
        ]);
        expect((store().tabboard_tabs as any[]).map(t => [t.id, t.title])).toEqual([
            ['t2', 'x'],
            ['t4', 'Example'],
            ['t5', 'Example'],
        ]);
    });

    it('keeps writing after a failed write', async () => {
        const storage = await import('../storage');
        vi.mocked(fakeChrome().storage.local.set).mockRejectedValueOnce(new Error('quota'));
        await expect(storage.addNote(makeNote({ id: 'a' }))).rejects.toThrow('quota');
        await storage.addNote(makeNote({ id: 'b' }));
        expect((store().tabboard_notes as any[]).map(n => n.id)).toEqual(['b']);
    });

    it('reads, writes and clears every collection', async () => {
        const s = await import('../storage');
        const pairs: [string, any][] = [
            ['Board', { id: 'b' }],
            ['Folder', makeFolder()],
            ['Tab', makeTab()],
            ['Task', makeTask()],
            ['Note', makeNote()],
            ['Session', makeSession()],
            ['History', { id: 'h' }],
        ];
        const api = s as any;
        for (const [name, item] of pairs) {
            await api[`add${name}`](item);
            expect(await api[`get${name}`](item.id)).toEqual(item);
            await api[`update${name}`]({ ...item, extra: 1 });
            const all = name === 'History' ? await api.getAllHistory() : await api[`getAll${name}s`]();
            expect(all).toEqual([{ ...item, extra: 1 }]);
            await api[`delete${name}`](item.id);
            expect(await api[`get${name}`](item.id)).toBeUndefined();
        }
        await s.addTask(makeTask());
        await s.clearAllData();
        expect(await s.getAllTasks()).toEqual([]);
    });
});
