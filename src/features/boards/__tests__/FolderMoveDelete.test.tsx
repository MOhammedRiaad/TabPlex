/* eslint-disable @typescript-eslint/no-explicit-any */
// "Move tabs to another folder" in the folder delete dialog (T1 of docs/specs/PRE_RELEASE_REVIEW_FIXES.md): one
// DELETE_FOLDER { moveTabs: true, targetFolderId }, and the UI, IndexedDB, the background copy and a second tab agree.
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BoardView from '../BoardView';
import { useStorageSync } from '../../../hooks/useStorageSync';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import * as db from '../../../utils/storage';
import { fakeChrome } from '../../../test/chromeMock';
import { makeBoard, makeFolder, makeTab } from '../../../test/factories';

const state = () => useBoardStore.getState();
const board = makeBoard({ id: 'b1', name: 'Work' });
const folders = [
    makeFolder({ id: 'f1', name: 'Research', boardId: 'b1' }),
    makeFolder({ id: 'f3', name: 'Archive', boardId: 'b1' }),
];
const tabs = [
    makeTab({ id: 't1', title: 'One', folderId: 'f1', order: 0 }),
    makeTab({ id: 't2', title: 'Two', folderId: 'f1', order: 1 }),
    makeTab({ id: 't3', title: 'Kept', folderId: 'f3', order: 0 }),
];

const sentOfType = (type: string) =>
    fakeChrome()
        .runtime.sendMessage.mock.calls.map((c: unknown[]) => c[0] as { type: string; payload?: any })
        .filter(m => m.type === type);
const folderOf = (list: { id: string; folderId?: string }[]) => Object.fromEntries(list.map(t => [t.id, t.folderId]));

describe('folder delete dialog: move the tabs', () => {
    beforeEach(async () => {
        await db.clearAllData();
        useBoardStore.setState({ boards: [board], folders, tabs, tasks: [], notes: [], sessions: [], history: [] });
        useUIStore.setState({ activeBoardId: 'b1' });
        await db.addBoard(board);
        for (const f of folders) await db.addFolder(f);
        for (const t of tabs) await db.addTab(t);
        await chrome.storage.local.set({ tabboard_tabs: tabs, tabboard_folders: folders });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    async function moveAndDelete() {
        render(<BoardView />);
        fireEvent.click(within(screen.getByLabelText('Folder: Research')).getByLabelText('Delete folder'));
        const dialog = screen.getByText('Delete Folder').closest('.board-modal-content') as HTMLElement;
        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'f3' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Move & Delete Folder' }));
    }

    it('sends one DELETE_FOLDER with moveTabs and the target, and no per-tab updates', async () => {
        fakeChrome().runtime.sendMessage.mockClear();
        await moveAndDelete();

        expect(sentOfType('DELETE_FOLDER')).toEqual([
            { type: 'DELETE_FOLDER', payload: { id: 'f1', moveTabs: true, targetFolderId: 'f3' } },
        ]);
        expect(sentOfType('UPDATE_TAB')).toEqual([]);
        expect(state().folders.map(f => f.id)).toEqual(['f3']);
        expect(folderOf(state().tabs)).toEqual({ t1: 'f3', t2: 'f3', t3: 'f3' });
    });

    it('ends with the tabs in the target in IndexedDB, the background copy and a second tab', async () => {
        vi.resetModules();
        await import('../../../background/message-handler');
        const mock = (await import('../../../test/chromeMock')).fakeChrome();
        fakeChrome().runtime.sendMessage.mockClear();

        await moveAndDelete();

        // IndexedDB (what every tab hydrates from)
        await waitFor(async () => expect(folderOf(await db.getAllTabs())).toEqual({ t1: 'f3', t2: 'f3', t3: 'f3' }));
        expect((await db.getAllFolders()).map(f => f.id)).toEqual(['f3']);

        // The background copy, fed with the message the UI really sent
        const [deleteMessage] = sentOfType('DELETE_FOLDER');
        const sendResponse = vi.fn();
        await act(async () => {
            for (const listener of [...mock.runtime.onMessage.listeners]) listener(deleteMessage, {}, sendResponse);
            await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
        });
        const stored = (await chrome.storage.local.get('tabboard_tabs')).tabboard_tabs as typeof tabs;
        expect(folderOf(stored)).toEqual({ t1: 'f3', t2: 'f3', t3: 'f3' });

        // A second TabPlex tab that still shows the folder gets the broadcast and moves the tabs too
        const [broadcast] = sentOfType('STORAGE_FOLDER_DELETED');
        expect(broadcast.payload).toEqual({ id: 'f1', moveTabs: true, targetFolderId: 'f3' });
        const second = renderHook(() => useStorageSync());
        await waitFor(() => expect(state().folders.map(f => f.id)).toEqual(['f3']));
        useBoardStore.setState({ folders, tabs });
        fakeChrome().runtime.sendMessage.mockClear();
        act(() => {
            for (const listener of [...mock.runtime.onMessage.listeners]) listener(broadcast, {}, () => undefined);
        });
        expect(state().folders.map(f => f.id)).toEqual(['f3']);
        expect(folderOf(state().tabs)).toEqual({ t1: 'f3', t2: 'f3', t3: 'f3' });
        expect(await db.getAllTabs()).toHaveLength(3);
        expect(sentOfType('DELETE_FOLDER')).toEqual([]); // no echo
        second.unmount();
    });
});
