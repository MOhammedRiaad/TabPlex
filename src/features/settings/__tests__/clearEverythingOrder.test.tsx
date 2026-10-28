// Written from docs/specs/PRE_RELEASE_REVIEW_FIXES.md (AC2, AC3, edge cases 5-9), as a black box.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEverything } from '../utils/clearEverything';
import { useBoardStore } from '../../../store/boardStore';
import { useTimerStore } from '../../../store/timerStore';
import { useStorageSync } from '../../../hooks/useStorageSync';
import * as db from '../../../utils/storage';
import { fakeChrome } from '../../../test/chromeMock';
import { makeBoard, makeNote, makeTask } from '../../../test/factories';
import { TRACK_ALL_TABS_KEY } from '../../../utils/tabTracking';

const KEY = TRACK_ALL_TABS_KEY;

/** Every call on the storage / messaging mocks, in order */
function recordCalls() {
    const calls: string[] = [];
    const local = fakeChrome().storage.local;
    for (const method of ['set', 'remove', 'get', 'clear'] as const) {
        const original = local[method].getMockImplementation()!;
        local[method].mockImplementation(((...args: unknown[]) => {
            calls.push(method === 'set' ? `set:${JSON.stringify(args[0])}` : method);
            return (original as (...a: unknown[]) => unknown)(...args);
        }) as never);
    }
    const send = fakeChrome().runtime.sendMessage;
    const originalSend = send.getMockImplementation()!;
    send.mockImplementation(((m: { type: string }, ...rest: unknown[]) => {
        calls.push(`send:${m.type}`);
        return (originalSend as (...a: unknown[]) => unknown)(m, ...rest);
    }) as never);
    return calls;
}

describe('clearEverything ordering and edge cases', () => {
    beforeEach(async () => {
        // The mock delivers a message to its own sender, so a mounted hook would reload the test page
        Object.defineProperty(window, 'location', {
            value: { ...window.location, reload: vi.fn() },
            configurable: true,
        });
        await db.clearAllData();
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] });
        useTimerStore.setState(useTimerStore.getInitialState(), true);
    });

    it('turns tracking off first, then removes, then clears IndexedDB, removes again, empties the store, then tells the others', async () => {
        await chrome.storage.local.set({ [KEY]: true, history_items: [{ id: 'h' }], other: 1 });
        await db.addTask(makeTask());
        useBoardStore.setState({ tasks: [makeTask()] });
        const calls = recordCalls();
        const clearIdb = vi.spyOn(db, 'clearAllData');
        let storeWhenTold: unknown;
        fakeChrome().runtime.sendMessage.mockImplementationOnce((async () => {
            storeWhenTold = useBoardStore.getState().tasks;
            calls.push('send:STORAGE_DATA_CLEARED');
        }) as never);

        await clearEverything();

        // set(false) is the very first storage call: no window in which the key is missing
        expect(calls[0]).toBe(`set:${JSON.stringify({ [KEY]: false })}`);
        const removes = calls.map((c, i) => (c === 'remove' ? i : -1)).filter(i => i >= 0);
        expect(removes).toHaveLength(2);
        expect(removes[0]).toBeGreaterThan(0);
        expect(clearIdb).toHaveBeenCalledTimes(1);
        // Never use chrome.storage.local.clear(): it would drop the key for a moment
        expect(calls).not.toContain('clear');
        expect(calls[calls.length - 1]).toBe('send:STORAGE_DATA_CLEARED');
        // The store was already empty when the message went out
        expect(storeWhenTold).toEqual([]);
        // The removed keys never include the tracking key
        for (const call of fakeChrome().storage.local.remove.mock.calls) expect(call[0]).not.toContain(KEY);
    });

    it('the second removal catches a key the background wrote while IndexedDB was being cleared', async () => {
        await chrome.storage.local.set({ [KEY]: false, tabboard_tabs: [{ id: 'old' }] });
        vi.spyOn(db, 'clearAllData').mockImplementationOnce(async () => {
            await chrome.storage.local.set({ tabboard_tabs: [{ id: 'late-write' }], history_items: [{ id: 'late' }] });
        });
        await clearEverything();
        expect(await chrome.storage.local.get(null)).toEqual({ [KEY]: false });
    });

    it('stops and resets a running pomodoro and drops what it stored', async () => {
        useTimerStore.setState({ isRunning: true, activeMode: 'work', timeLeft: 12, completedSessions: 3 });
        localStorage.setItem('pomodoro-storage', '{"state":{"completedSessions":3}}');
        await clearEverything();
        const timer = useTimerStore.getState();
        expect(timer.isRunning).toBe(false);
        expect(timer.completedSessions).toBe(0);
        expect(localStorage.getItem('pomodoro-storage')).toBeNull();
    });

    it('a failing first step changes nothing: no removal, store untouched, no broadcast', async () => {
        await chrome.storage.local.set({ keep: 1, [KEY]: true });
        useBoardStore.setState({ boards: [makeBoard()] });
        const clearIdb = vi.spyOn(db, 'clearAllData');
        fakeChrome().storage.local.set.mockRejectedValueOnce(new Error('quota'));
        fakeChrome().runtime.sendMessage.mockClear();

        await expect(clearEverything()).rejects.toThrow('quota');

        expect(fakeChrome().storage.local.remove).not.toHaveBeenCalled();
        expect(clearIdb).not.toHaveBeenCalled();
        expect(useBoardStore.getState().boards).toHaveLength(1);
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalled();
        expect(await chrome.storage.local.get('keep')).toEqual({ keep: 1 });
    });

    it('a failing IndexedDB clear leaves the store as it was and sends nothing', async () => {
        useBoardStore.setState({ boards: [makeBoard()] });
        vi.spyOn(db, 'clearAllData').mockRejectedValueOnce(new Error('blocked'));
        fakeChrome().runtime.sendMessage.mockClear();
        await expect(clearEverything()).rejects.toThrow('blocked');
        expect(useBoardStore.getState().boards).toHaveLength(1);
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('a failing second removal also sends nothing', async () => {
        fakeChrome().storage.local.remove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('late'));
        fakeChrome().runtime.sendMessage.mockClear();
        await expect(clearEverything()).rejects.toThrow('late');
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('resolves when nobody listens (sendMessage rejects) and when the worker answers nothing', async () => {
        fakeChrome().runtime.sendMessage.mockRejectedValueOnce(new Error('Could not establish connection.'));
        await expect(clearEverything()).resolves.toBeUndefined();
        await expect(clearEverything()).resolves.toBeUndefined();
    });

    it('with the key stored as a non-boolean, it still ends as exactly false', async () => {
        await chrome.storage.local.set({ [KEY]: 'yes' });
        await clearEverything();
        expect(await chrome.storage.local.get(null)).toEqual({ [KEY]: false });
    });

    it('while the tab waits for its reload, a store change cannot bring old data back into IndexedDB', async () => {
        await db.addBoard(makeBoard({ id: 'old' }));
        await db.addTask(makeTask({ id: 'old-task' }));
        await db.addNote(makeNote({ id: 'old-note' }));
        useBoardStore.setState({
            boards: [makeBoard({ id: 'old' })],
            tasks: [makeTask({ id: 'old-task' })],
            notes: [makeNote({ id: 'old-note' })],
        });
        const { unmount } = renderHook(() => useStorageSync());
        await waitFor(() => expect(useBoardStore.getState().boards).toHaveLength(1));
        await waitFor(() => expect(fakeChrome().runtime.onMessage.listeners.size).toBeGreaterThan(0));

        await clearEverything();
        // Every collection gets a new array, so every sync effect runs again against the (empty) store
        act(() =>
            useBoardStore.setState(s => ({
                boards: [...s.boards],
                folders: [...s.folders],
                tabs: [...s.tabs],
                tasks: [...s.tasks],
                notes: [...s.notes],
                sessions: [...s.sessions],
            }))
        );
        await new Promise(r => setTimeout(r, 50));

        expect(await db.getAllBoards()).toEqual([]);
        expect(await db.getAllTasks()).toEqual([]);
        expect(await db.getAllNotes()).toEqual([]);
        expect(await db.getAllFolders()).toEqual([]);
        expect(await db.getAllTabs()).toEqual([]);
        expect(await db.getAllSessions()).toEqual([]);
        unmount();
    });
});

describe('the other tabs: STORAGE_DATA_CLEARED', () => {
    const reload = vi.fn();
    beforeEach(() => {
        reload.mockClear();
        Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
    });

    it('reloads once per message and drops the stored timer first', async () => {
        const { unmount } = renderHook(() => useStorageSync());
        await waitFor(() => expect(fakeChrome().runtime.onMessage.listeners.size).toBeGreaterThan(0));
        localStorage.setItem('pomodoro-storage', '{"state":{}}');
        let timerAtReload: string | null = 'unset';
        reload.mockImplementationOnce(() => {
            timerAtReload = localStorage.getItem('pomodoro-storage');
        });

        act(() => {
            for (const l of [...fakeChrome().runtime.onMessage.listeners])
                l({ type: 'STORAGE_DATA_CLEARED' }, {}, () => {});
        });

        expect(reload).toHaveBeenCalledTimes(1);
        expect(timerAtReload).toBeNull();
        unmount();
    });

    it('does not reload for ordinary messages and does not answer or echo', async () => {
        const { unmount } = renderHook(() => useStorageSync());
        await waitFor(() => expect(fakeChrome().runtime.onMessage.listeners.size).toBeGreaterThan(0));
        fakeChrome().runtime.sendMessage.mockClear();
        const respond = vi.fn();
        act(() => {
            for (const l of [...fakeChrome().runtime.onMessage.listeners]) {
                l({ type: 'STORAGE_DATA_CLEARED' }, {}, respond);
                l({ type: 'STORAGE_TASK_ADDED', payload: makeTask({ id: 'new' }) }, {}, respond);
            }
        });
        expect(reload).toHaveBeenCalledTimes(1);
        expect(respond).not.toHaveBeenCalled();
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalled();
        unmount();
    });
});
