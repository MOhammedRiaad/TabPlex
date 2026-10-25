import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEverything } from '../utils/clearEverything';
import { useBoardStore } from '../../../store/boardStore';
import { useTimerStore } from '../../../store/timerStore';
import { useStorageSync } from '../../../hooks/useStorageSync';
import * as db from '../../../utils/storage';
import { fakeChrome } from '../../../test/chromeMock';
import { makeBoard, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../../test/factories';
import { TRACK_ALL_TABS_KEY } from '../../../utils/tabTracking';

const reload = vi.fn();

async function seedEverything() {
    const items = {
        boards: [makeBoard()],
        folders: [makeFolder()],
        tabs: [makeTab()],
        tasks: [makeTask()],
        notes: [makeNote()],
        sessions: [makeSession()],
    };
    await db.addBoard(items.boards[0]);
    await db.addFolder(items.folders[0]);
    await db.addTab(items.tabs[0]);
    await db.addTask(items.tasks[0]);
    await db.addNote(items.notes[0]);
    await db.addSession(items.sessions[0]);
    useBoardStore.setState(items);
    await chrome.storage.local.set({
        tabboard_tabs: items.tabs,
        history_items: [{ id: 'h1' }],
        tabplex_active_context_task_id: 'task_1',
        tabplex_import_backup: '{}',
        tabplex_import_backup_at: 'now',
    });
    localStorage.setItem('theme', 'dark');
}

describe('clearEverything', () => {
    beforeEach(() => {
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] });
        reload.mockClear();
        Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
    });

    it.each([
        ['on', true],
        ['off', false],
        ['missing', undefined],
    ])('leaves recording off and nothing else when it was %s', async (_label, before) => {
        await seedEverything();
        if (before !== undefined) await chrome.storage.local.set({ [TRACK_ALL_TABS_KEY]: before });

        await clearEverything();

        expect(await chrome.storage.local.get(null)).toEqual({ [TRACK_ALL_TABS_KEY]: false });
        expect(localStorage.length).toBe(0);
        expect(await db.getAllBoards()).toEqual([]);
        expect(await db.getAllFolders()).toEqual([]);
        expect(await db.getAllTabs()).toEqual([]);
        expect(await db.getAllTasks()).toEqual([]);
        expect(await db.getAllNotes()).toEqual([]);
        expect(await db.getAllSessions()).toEqual([]);
    });

    it('writes the recording key before removing anything, so it is never missing', async () => {
        await seedEverything();
        await clearEverything();
        const local = fakeChrome().storage.local;
        expect(local.clear).not.toHaveBeenCalled();
        expect(local.set.mock.invocationCallOrder[0]).toBeLessThan(local.remove.mock.invocationCallOrder[0]);
        const removed = local.remove.mock.calls.flatMap((call: unknown[]) => call[0] as string[]);
        expect(removed).toContain('history_items');
        expect(removed).not.toContain(TRACK_ALL_TABS_KEY);
    });

    it('removes what a background write put back during the IndexedDB step', async () => {
        await seedEverything();
        const realClear = db.clearAllData;
        vi.spyOn(db, 'clearAllData').mockImplementation(async () => {
            await realClear();
            await chrome.storage.local.set({ tabboard_tabs: [makeTab({ id: 'late' })] });
        });
        await clearEverything();
        expect(await chrome.storage.local.get(null)).toEqual({ [TRACK_ALL_TABS_KEY]: false });
    });

    it('empties the store and sends STORAGE_DATA_CLEARED after the storage steps', async () => {
        await seedEverything();
        await clearEverything();
        expect(useBoardStore.getState()).toMatchObject({
            boards: [],
            folders: [],
            tabs: [],
            tasks: [],
            notes: [],
            sessions: [],
        });
        const calls = fakeChrome().runtime.sendMessage.mock.calls.map(
            (c: unknown[]) => (c[0] as { type: string }).type
        );
        expect(calls).toEqual(['STORAGE_DATA_CLEARED']);
        const sendOrder = fakeChrome().runtime.sendMessage.mock.invocationCallOrder[0];
        const removeOrders: number[] = fakeChrome().storage.local.remove.mock.invocationCallOrder;
        expect(Math.max(...removeOrders)).toBeLessThan(sendOrder);
    });

    it('still resolves when nobody can receive STORAGE_DATA_CLEARED', async () => {
        fakeChrome().runtime.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
        await expect(clearEverything()).resolves.toBeUndefined();
    });

    it('stops a running Pomodoro and drops what it stored', async () => {
        useTimerStore.getState().updateSettings({ workDuration: 50 });
        useTimerStore.getState().setLinkedTaskId('task_1');
        useTimerStore.getState().setIsRunning(true);
        expect(localStorage.getItem('pomodoro-storage')).toContain('task_1');

        await clearEverything();

        expect(useTimerStore.getState()).toMatchObject({ isRunning: false, linkedTaskId: null });
        expect(useTimerStore.getState().settings.workDuration).toBe(25);
        expect(localStorage.getItem('pomodoro-storage')).toBeNull();
    });

    it('does not let this tab write the old data back when another item arrives', async () => {
        await seedEverything();
        renderHook(() => useStorageSync());
        await waitFor(() => expect(useBoardStore.getState().boards).toHaveLength(1));

        await clearEverything();
        act(() => {
            for (const listener of [...fakeChrome().runtime.onMessage.listeners]) {
                listener(
                    { type: 'STORAGE_BOARD_ADDED', payload: makeBoard({ id: 'default_board' }) },
                    {},
                    () => undefined
                );
            }
        });

        await waitFor(async () => expect((await db.getAllBoards()).map(b => b.id)).toEqual(['default_board']));
        expect(await db.getAllTasks()).toEqual([]);
        expect(await db.getAllTabs()).toEqual([]);
        expect(await db.getAllFolders()).toEqual([]);
    });

    it('leaves the store as it was when a storage step fails, and sends nothing', async () => {
        await seedEverything();
        fakeChrome().storage.local.remove.mockRejectedValueOnce(new Error('quota'));
        await expect(clearEverything()).rejects.toThrow('quota');
        expect(useBoardStore.getState().tasks).toHaveLength(1);
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalled();
    });
});
