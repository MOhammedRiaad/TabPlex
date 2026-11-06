/* eslint-disable @typescript-eslint/no-explicit-any */
// Regression guards for T1 (docs/specs/PRE_RELEASE_REVIEW_FIXES.md, Revision 2): deleting a folder through the dialog
// must keep the moved tabs everywhere. The REAL background handler is registered, so the UI's own sendMessage reaches it
// and its broadcast reaches the second tab, exactly as in Chrome.
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
    makeFolder({ id: 'src', name: 'Source', boardId: 'b1' }),
    makeFolder({ id: 'dst', name: 'Target', boardId: 'b1' }),
    makeFolder({ id: 'oth', name: 'Other', boardId: 'b1' }),
    makeFolder({ id: 'empty', name: 'Empty', boardId: 'b1' }),
];
const tabs = [
    makeTab({ id: 'a', title: 'A', folderId: 'src', order: 0 }),
    makeTab({ id: 'b', title: 'B', folderId: 'src', order: 1 }),
    makeTab({ id: 'c', title: 'C', folderId: 'dst', order: 0 }),
    makeTab({ id: 'd', title: 'D', folderId: 'oth', order: 0 }),
];

type Msg = { type: string; payload?: any };
const sent = (): Msg[] => fakeChrome().runtime.sendMessage.mock.calls.map((c: unknown[]) => c[0] as Msg);
const sentOfType = (type: string) => sent().filter(m => m.type === type);
const byId = (list: { id: string; folderId?: string }[]) => Object.fromEntries(list.map(t => [t.id, t.folderId]));
const bgTabs = async () => ((await chrome.storage.local.get('tabboard_tabs')).tabboard_tabs ?? []) as typeof tabs;

async function seed() {
    await db.clearAllData();
    useBoardStore.setState({ boards: [board], folders, tabs, tasks: [], notes: [], sessions: [], history: [] });
    useUIStore.setState({ activeBoardId: 'b1' });
    await db.addBoard(board);
    for (const f of folders) await db.addFolder(f);
    for (const t of tabs) await db.addTab(t);
    await chrome.storage.local.set({ tabboard_tabs: tabs, tabboard_folders: folders });
}

describe('T1 regression: folder delete dialog keeps moved tabs', () => {
    beforeEach(async () => {
        vi.resetModules();
        await import('../../../background/message-handler'); // the real handler answers the UI's messages
        await seed();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fakeChrome().runtime.sendMessage.mockClear();
    });

    function openDialog(folderName: string) {
        render(<BoardView />);
        fireEvent.click(within(screen.getByLabelText(`Folder: ${folderName}`)).getByLabelText('Delete folder'));
        return screen.getByText('Delete Folder').closest('.board-modal-content') as HTMLElement;
    }

    it('keeps the moved tabs in the target in the store, IndexedDB and tabboard_tabs; other tabs untouched', async () => {
        const dialog = openDialog('Source');
        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'dst' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Move & Delete Folder' }));

        await waitFor(async () => expect(byId(await bgTabs())).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' }));
        expect(byId(state().tabs)).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' });
        await waitFor(async () =>
            expect(byId(await db.getAllTabs())).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' })
        );
        expect((await db.getAllFolders()).map(f => f.id)).not.toContain('src');
        expect(state().folders.map(f => f.id)).not.toContain('src');
        // Order and titles survive the move
        expect(state().tabs.find(t => t.id === 'b')).toMatchObject({ title: 'B', order: 1 });

        expect(sentOfType('DELETE_FOLDER')).toEqual([
            { type: 'DELETE_FOLDER', payload: { id: 'src', moveTabs: true, targetFolderId: 'dst' } },
        ]);
        expect(sentOfType('UPDATE_TAB')).toHaveLength(0);
        expect(sentOfType('DELETE_TAB')).toHaveLength(0);
    });

    // U1: the store action must delete the tabs from IndexedDB too, not only from the page
    it('the plain "Delete folder and all tabs" path still deletes the tabs everywhere (U1)', async () => {
        const dialog = openDialog('Source');
        fireEvent.click(within(dialog).getByText('Delete folder and all tabs'));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Everything' }));

        await waitFor(async () => expect(byId(await bgTabs())).toEqual({ c: 'dst', d: 'oth' }));
        expect(byId(state().tabs)).toEqual({ c: 'dst', d: 'oth' });
        await waitFor(async () => expect(byId(await db.getAllTabs())).toEqual({ c: 'dst', d: 'oth' }));
        expect(sentOfType('DELETE_FOLDER')).toEqual([
            { type: 'DELETE_FOLDER', payload: { id: 'src', moveTabs: false, targetFolderId: '' } },
        ]);
        const broadcast = sentOfType('STORAGE_FOLDER_DELETED');
        expect(broadcast).toHaveLength(1);
        expect(broadcast[0].payload).toEqual({ id: 'src', moveTabs: false, targetFolderId: '' });
    });

    it('a folder with zero tabs is deleted after confirmation and no tab changes', async () => {
        render(<BoardView />);
        fireEvent.click(within(screen.getByLabelText('Folder: Empty')).getByLabelText('Delete folder'));
        expect(screen.queryByText('Delete Folder')).toBeNull(); // no dialog for an empty folder

        await waitFor(async () => expect((await db.getAllFolders()).map(f => f.id)).not.toContain('empty'));
        expect(byId(await bgTabs())).toEqual({ a: 'src', b: 'src', c: 'dst', d: 'oth' });
        expect(byId(state().tabs)).toEqual({ a: 'src', b: 'src', c: 'dst', d: 'oth' });
        expect(sentOfType('DELETE_FOLDER')[0].payload).toMatchObject({ id: 'empty', moveTabs: false });
    });

    it('cancelling the empty-folder confirm deletes nothing and sends nothing', () => {
        vi.mocked(window.confirm).mockReturnValue(false);
        render(<BoardView />);
        fireEvent.click(within(screen.getByLabelText('Folder: Empty')).getByLabelText('Delete folder'));
        expect(state().folders.map(f => f.id)).toContain('empty');
        expect(sentOfType('DELETE_FOLDER')).toHaveLength(0);
    });

    it('the move button stays disabled until a target is chosen (no DELETE_FOLDER without a target)', () => {
        const dialog = openDialog('Source');
        const button = within(dialog).getByRole('button', { name: 'Move & Delete Folder' });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(sentOfType('DELETE_FOLDER')).toHaveLength(0);
        expect(byId(state().tabs).a).toBe('src');
    });

    it.each([
        ['an omitted target', undefined],
        ['an empty target', ''],
    ])(
        '%s leaves the moved tabs unfiled (folderId "") in the background copy and the broadcast',
        async (_n, target) => {
            const payload: any = { id: 'src', moveTabs: true };
            if (target !== undefined) payload.targetFolderId = target;
            const response = await chrome.runtime.sendMessage({ type: 'DELETE_FOLDER', payload });

            expect(response).toEqual({ success: true });
            expect(byId(await bgTabs())).toEqual({ a: '', b: '', c: 'dst', d: 'oth' });
            const [broadcast] = sentOfType('STORAGE_FOLDER_DELETED');
            expect(broadcast.payload).toEqual({ id: 'src', moveTabs: true, targetFolderId: '' });
        }
    );

    it('the store action with moveTabs and no target also unfiles the tabs in the store and IndexedDB', async () => {
        act(() => state().deleteFolder('src', true));
        expect(byId(state().tabs)).toEqual({ a: '', b: '', c: 'dst', d: 'oth' });
        await waitFor(async () => expect(byId(await db.getAllTabs())).toEqual({ a: '', b: '', c: 'dst', d: 'oth' }));
        expect(sentOfType('UPDATE_TAB')).toHaveLength(0);
    });

    it('a second tab with stale state ends consistent, sends nothing, and a repeated broadcast changes nothing', async () => {
        const second = renderHook(() => useStorageSync());
        await waitFor(() => expect(state().folders).toHaveLength(4)); // hydrated
        const dialog = openDialog('Source');
        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'dst' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Move & Delete Folder' }));
        await waitFor(async () => expect(byId(await bgTabs())).toMatchObject({ a: 'dst', b: 'dst' }));

        const [broadcast] = sentOfType('STORAGE_FOLDER_DELETED');
        expect(broadcast.payload).toEqual({ id: 'src', moveTabs: true, targetFolderId: 'dst' });

        // The other tab still shows the old folder
        act(() => useBoardStore.setState({ folders, tabs }));
        const before = sent().length;
        const deliver = () =>
            act(() => {
                for (const l of [...fakeChrome().runtime.onMessage.listeners]) l(broadcast, {}, () => undefined);
            });
        deliver();
        expect(byId(state().tabs)).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' });
        expect(state().folders.map(f => f.id)).not.toContain('src');
        deliver(); // duplicate delivery
        expect(byId(state().tabs)).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' });
        await waitFor(async () =>
            expect(byId(await db.getAllTabs())).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' })
        );
        // Applying a remote change never sends anything back (no loop)
        expect(sent().slice(before)).toEqual([]);
        second.unmount();
    });

    it('after delete-all, a reload (hydrating from IndexedDB) does not bring the tabs back', async () => {
        const dialog = openDialog('Source');
        fireEvent.click(within(dialog).getByText('Delete folder and all tabs'));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Everything' }));
        await waitFor(async () => expect(byId(await db.getAllTabs())).toEqual({ c: 'dst', d: 'oth' }));

        // A fresh page: empty store, then the hook loads from IndexedDB
        act(() => useBoardStore.setState({ boards: [], folders: [], tabs: [] }));
        const fresh = renderHook(() => useStorageSync());
        await waitFor(() => expect(state().tabs.length).toBeGreaterThan(0));
        expect(
            state()
                .tabs.map(t => t.id)
                .sort()
        ).toEqual(['c', 'd']);
        expect(state().folders.map(f => f.id)).not.toContain('src');
        fresh.unmount();
    });

    it('deleteFolderSilently with a tab another window already deleted: no error, no messages, no loop', async () => {
        await db.deleteTab('a'); // the other window got there first
        fakeChrome().runtime.sendMessage.mockClear();
        (console.error as ReturnType<typeof vi.fn>).mockClear();

        act(() => state().deleteFolderSilently('src'));
        act(() => state().deleteFolderSilently('src')); // duplicate delivery
        expect(byId(state().tabs)).toEqual({ c: 'dst', d: 'oth' });
        await waitFor(async () => expect(byId(await db.getAllTabs())).toEqual({ c: 'dst', d: 'oth' }));
        expect((await db.getAllFolders()).map(f => f.id)).not.toContain('src');
        await Promise.resolve();
        expect(console.error).not.toHaveBeenCalled();
        expect(sent()).toEqual([]);
    });

    it('a rejected DELETE_FOLDER is logged, not thrown, and nothing is retried per tab', async () => {
        fakeChrome().runtime.sendMessage.mockImplementation((message: any) =>
            message.type === 'DELETE_FOLDER' ? Promise.reject(new Error('worker asleep')) : Promise.resolve({})
        );
        const dialog = openDialog('Source');
        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'dst' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Move & Delete Folder' }));

        await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'worker asleep' }))
        );
        expect(sentOfType('DELETE_FOLDER')).toHaveLength(1);
        expect(sentOfType('UPDATE_TAB')).toHaveLength(0);
        // The UI copy and IndexedDB (what the tab reloads from) still have the tabs in the target
        expect(byId(state().tabs)).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' });
        await waitFor(async () =>
            expect(byId(await db.getAllTabs())).toEqual({ a: 'dst', b: 'dst', c: 'dst', d: 'oth' })
        );
    });

    it('an error reply from the background does not throw in the UI and leaves the store as moved', async () => {
        fakeChrome().runtime.sendMessage.mockImplementation((message: any) =>
            Promise.resolve(message.type === 'DELETE_FOLDER' ? { error: 'boom' } : {})
        );
        const dialog = openDialog('Source');
        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'dst' } });
        expect(() =>
            fireEvent.click(within(dialog).getByRole('button', { name: 'Move & Delete Folder' }))
        ).not.toThrow();
        expect(byId(state().tabs)).toMatchObject({ a: 'dst', b: 'dst' });
    });
});
