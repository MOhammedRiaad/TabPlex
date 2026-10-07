import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStorageSync } from '../useStorageSync';
import { useBoardStore } from '../../store/boardStore';
import * as db from '../../utils/storage';
import { fakeChrome } from '../../test/chromeMock';
import { makeBoard, makeContext, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../test/factories';
import { markImportInThisTab } from '../../utils/exportImport';

const state = () => useBoardStore.getState();

/** Deliver a message the way the background broadcasts it */
const broadcast = (message: unknown) =>
    act(() => {
        for (const listener of [...fakeChrome().runtime.onMessage.listeners]) listener(message, {}, () => undefined);
    });

describe('useStorageSync', () => {
    beforeEach(async () => {
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] });
        await db.clearAllData();
    });

    it('hydrates the store from IndexedDB without resetting timestamps or messaging the background', async () => {
        const task = makeTask({ createdAt: '2020-01-01T00:00:00.000Z' });
        // IndexedDB returns boards by id; the store keeps them in creation order
        await db.addBoard(makeBoard({ id: 'default_board', createdAt: '2020-01-01T00:00:00.000Z' }));
        await db.addBoard(makeBoard({ id: 'board_2', createdAt: '2021-01-01T00:00:00.000Z' }));
        await db.addFolder(makeFolder());
        await db.addTab(makeTab({ id: 'b', order: 1 }));
        await db.addTab(makeTab({ id: 'a', order: 0 }));
        await db.addTab(makeTab({ id: 'z' }));
        await db.addTask(task);
        await db.addNote(makeNote());
        await db.addSession(makeSession());

        renderHook(() => useStorageSync());
        await waitFor(() => expect(state().tasks).toHaveLength(1));
        expect(state().tasks[0].createdAt).toBe('2020-01-01T00:00:00.000Z');
        expect(state().tabs.map(t => t.id)).toEqual(['a', 'b', 'z']);
        expect(state().boards.map(b => b.id)).toEqual(['default_board', 'board_2']);
        expect(state().notes).toHaveLength(1);
        expect(state().sessions).toHaveLength(1);
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('registers its message listener once, however often it re-renders', async () => {
        const addListener = vi.spyOn(chrome.runtime.onMessage, 'addListener');
        const { rerender, unmount } = renderHook(() => useStorageSync());
        // Store updates re-render the hook; the listener must not be re-added
        act(() => useBoardStore.setState({ tasks: [makeTask()] }));
        rerender();
        rerender();
        expect(addListener).toHaveBeenCalledTimes(1);
        const removeListener = vi.spyOn(chrome.runtime.onMessage, 'removeListener');
        unmount();
        expect(removeListener).toHaveBeenCalledTimes(1);
    });

    it('takes newer task fields and the background-owned context from chrome.storage', async () => {
        await db.addTask(makeTask({ id: 'a', title: 'local', updatedAt: '2026-10-03T10:00:00Z' }));
        await db.addTask(makeTask({ id: 'b', title: 'local newer', updatedAt: '2026-10-03T12:00:00Z' }));
        await db.addTask(makeTask({ id: 'c', title: 'only local' }));
        await chrome.storage.local.set({
            tabboard_tasks: [
                makeTask({ id: 'a', title: 'remote', updatedAt: '2026-10-03T11:00:00Z', context: makeContext() }),
                makeTask({
                    id: 'b',
                    title: 'remote older',
                    updatedAt: '2026-10-03T09:00:00Z',
                    context: makeContext({ state: 'active' }),
                }),
            ],
        });
        renderHook(() => useStorageSync());
        await waitFor(() => expect(state().tasks).toHaveLength(3));
        const byId = Object.fromEntries(state().tasks.map(t => [t.id, t]));
        expect(byId.a).toMatchObject({ title: 'remote', context: { state: 'parked' } });
        expect(byId.b).toMatchObject({ title: 'local newer', context: { state: 'active' } });
        expect(byId.c.title).toBe('only local');
    });

    it('keeps local tasks when chrome.storage cannot be read', async () => {
        await db.addTask(makeTask());
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('nope'));
        renderHook(() => useStorageSync());
        await waitFor(() => expect(state().tasks).toHaveLength(1));
    });

    it('writes store changes back to IndexedDB, including deletions', async () => {
        await db.addTask(makeTask({ id: 'gone' }));
        renderHook(() => useStorageSync());
        await waitFor(() => expect(state().tasks).toHaveLength(1));

        act(() =>
            useBoardStore.setState({
                boards: [makeBoard({ id: 'b2' })],
                folders: [makeFolder({ id: 'f2' })],
                tabs: [makeTab({ id: 't2' })],
                tasks: [makeTask({ id: 'new' })],
                notes: [makeNote({ id: 'n2' })],
                sessions: [makeSession({ id: 's2' })],
            })
        );
        await waitFor(async () => expect((await db.getAllTasks()).map(t => t.id)).toEqual(['new']));
        await waitFor(async () => {
            expect((await db.getAllBoards()).map(b => b.id)).toEqual(['b2']);
            expect((await db.getAllFolders()).map(f => f.id)).toEqual(['f2']);
            expect((await db.getAllTabs()).map(t => t.id)).toEqual(['t2']);
            expect((await db.getAllNotes()).map(n => n.id)).toEqual(['n2']);
            expect((await db.getAllSessions()).map(s => s.id)).toEqual(['s2']);
        });

        act(() => useBoardStore.setState({ boards: [], folders: [], tabs: [], notes: [], sessions: [] }));
        await waitFor(async () => {
            expect(await db.getAllBoards()).toEqual([]);
            expect(await db.getAllFolders()).toEqual([]);
            expect(await db.getAllTabs()).toEqual([]);
            expect(await db.getAllNotes()).toEqual([]);
            expect(await db.getAllSessions()).toEqual([]);
        });
    });

    it('applies background broadcasts silently (no echo back)', async () => {
        renderHook(() => useStorageSync());
        await waitFor(() => expect(fakeChrome().runtime.onMessage.listeners.size).toBeGreaterThan(0));

        broadcast({ type: 'STORAGE_BOARD_ADDED', payload: makeBoard() });
        broadcast({ type: 'STORAGE_BOARD_UPDATED', payload: { id: 'board_1', name: 'Renamed' } });
        broadcast({ type: 'STORAGE_FOLDER_ADDED', payload: makeFolder() });
        broadcast({ type: 'STORAGE_FOLDER_UPDATED', payload: { id: 'folder_1', name: 'F' } });
        broadcast({ type: 'STORAGE_TAB_ADDED', payload: makeTab() });
        broadcast({ type: 'STORAGE_TAB_ADDED', payload: makeTab({ title: 'Again' }) });
        broadcast({ type: 'STORAGE_TAB_UPDATED', payload: { id: 'tab_1', title: 'Updated' } });
        broadcast({ type: 'STORAGE_TASK_ADDED', payload: makeTask() });
        broadcast({ type: 'STORAGE_TASK_UPDATED', payload: makeTask({ title: 'Changed' }) });
        broadcast({ type: 'STORAGE_NOTE_ADDED', payload: makeNote() });
        broadcast({ type: 'STORAGE_NOTE_UPDATED', payload: makeNote({ content: 'Changed' }) });
        broadcast({ type: 'STORAGE_SESSION_ADDED', payload: makeSession() });
        broadcast({ type: 'STORAGE_SESSION_UPDATED', payload: makeSession({ name: 'Changed' }) });

        expect(state().boards[0].name).toBe('Renamed');
        expect(state().folders[0].name).toBe('F');
        expect(state().tabs).toHaveLength(1);
        expect(state().tabs[0].title).toBe('Updated');
        // Partial updates keep the fields they don't mention
        expect(state().boards[0].createdAt).toBe(makeBoard().createdAt);
        expect(state().folders[0].boardId).toBe(makeFolder().boardId);
        expect(state().tabs[0].url).toBe(makeTab().url);
        expect(state().tasks[0].title).toBe('Changed');
        expect(state().notes[0].content).toBe('Changed');
        expect(state().sessions[0].name).toBe('Changed');

        broadcast({ type: 'STORAGE_TAB_DELETED', payload: { id: 'tab_1' } });
        broadcast({ type: 'STORAGE_TASK_DELETED', payload: { id: 'task_1' } });
        broadcast({ type: 'STORAGE_NOTE_DELETED', payload: { id: 'note_1' } });
        broadcast({ type: 'STORAGE_FOLDER_DELETED', payload: { id: 'folder_1' } });
        broadcast({ type: 'STORAGE_SESSION_DELETED', payload: { id: 'session_1' } });
        broadcast({ type: 'STORAGE_BOARD_DELETED', payload: { id: 'board_1' } });
        broadcast({ type: 'SOMETHING_ELSE' });
        broadcast(null);
        expect(state()).toMatchObject({ tabs: [], tasks: [], notes: [], folders: [], sessions: [], boards: [] });

        const sent = fakeChrome().runtime.sendMessage.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);
        expect(sent.filter((t: string) => t.startsWith('UPDATE_') || t.startsWith('ADD_'))).toEqual([]);
    });

    it('also listens to window messages, reloads after an import and cleans up', async () => {
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
        const { unmount } = renderHook(() => useStorageSync());
        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', { data: { type: 'STORAGE_NOTE_ADDED', payload: makeNote({ id: 'w' }) } })
            );
        });
        expect(state().notes.map(n => n.id)).toEqual(['w']);
        broadcast({ type: 'STORAGE_DATA_IMPORTED' });
        expect(reload).toHaveBeenCalled();
        unmount();
        expect(fakeChrome().runtime.onMessage.listeners.size).toBe(0);
    });

    it("ignores tab updates for tabs this page doesn't have (the background tracks every browser tab)", async () => {
        renderHook(() => useStorageSync());
        await waitFor(() => expect(fakeChrome().runtime.onMessage.listeners.size).toBeGreaterThan(0));
        broadcast({ type: 'STORAGE_TAB_ADDED', payload: makeTab({ id: 'saved', title: 'Saved' }) });

        // A browsing tab the background recorded on activation: must not appear in Boards
        broadcast({ type: 'STORAGE_TAB_UPDATED', payload: makeTab({ id: 'tab_browsed', title: 'Some site' }) });
        expect(state().tabs.map(t => t.id)).toEqual(['saved']);

        // An edit to a tab this page has still applies
        broadcast({ type: 'STORAGE_TAB_UPDATED', payload: { id: 'saved', title: 'Renamed' } });
        expect(state().tabs).toEqual([expect.objectContaining({ id: 'saved', title: 'Renamed' })]);
    });

    it('lets the importing tab reload on its own, after showing its toast', async () => {
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
        const { unmount } = renderHook(() => useStorageSync());

        markImportInThisTab(true);
        broadcast({ type: 'STORAGE_DATA_IMPORTED' });
        expect(reload).not.toHaveBeenCalled();

        markImportInThisTab(false);
        broadcast({ type: 'STORAGE_DATA_IMPORTED' });
        expect(reload).toHaveBeenCalledTimes(1);
        unmount();
    });
});
