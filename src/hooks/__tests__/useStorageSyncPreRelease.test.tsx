// Written from docs/specs/PRE_RELEASE_REVIEW_FIXES.md (AC1 receiver, AC5 undated boards), as a black box.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStorageSync } from '../useStorageSync';
import { useBoardStore } from '../../store/boardStore';
import * as db from '../../utils/storage';
import { fakeChrome } from '../../test/chromeMock';
import { makeBoard, makeFolder, makeTab } from '../../test/factories';

const state = () => useBoardStore.getState();
const deliver = (message: unknown) =>
    act(() => {
        for (const listener of [...fakeChrome().runtime.onMessage.listeners]) listener(message, {}, () => undefined);
    });
const sentTypes = () =>
    fakeChrome().runtime.sendMessage.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type);

async function mountWithTabsIn(folderId: string) {
    await db.addFolder(makeFolder({ id: 'A' }));
    await db.addFolder(makeFolder({ id: 'B' }));
    await db.addTab(makeTab({ id: 't1', folderId }));
    await db.addTab(makeTab({ id: 't2', folderId }));
    await db.addTab(makeTab({ id: 'other', folderId: 'B' }));
    const hook = renderHook(() => useStorageSync());
    await waitFor(() => expect(state().tabs).toHaveLength(3));
    fakeChrome().runtime.sendMessage.mockClear();
    return hook;
}

const folderIdsInDb = async () => Object.fromEntries((await db.getAllTabs()).map(t => [t.id, t.folderId]));

describe('STORAGE_FOLDER_DELETED receiver', () => {
    beforeEach(async () => {
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] });
        await db.clearAllData();
    });

    it('moves the tabs into the target in the store and in IndexedDB, also after a reload', async () => {
        const { unmount } = await mountWithTabsIn('A');
        deliver({ type: 'STORAGE_FOLDER_DELETED', payload: { id: 'A', moveTabs: true, targetFolderId: 'B' } });

        expect(state().folders.map(f => f.id)).toEqual(['B']);
        expect(Object.fromEntries(state().tabs.map(t => [t.id, t.folderId]))).toEqual({ t1: 'B', t2: 'B', other: 'B' });
        await waitFor(async () => expect(await folderIdsInDb()).toEqual({ t1: 'B', t2: 'B', other: 'B' }));
        expect((await db.getAllFolders()).map(f => f.id)).toEqual(['B']);
        // No echo
        expect(sentTypes().filter(t => !t.startsWith('GET_'))).toEqual([]);
        unmount();

        // "Reload": a new tab hydrates from IndexedDB
        useBoardStore.setState({ folders: [], tabs: [] });
        renderHook(() => useStorageSync());
        await waitFor(() => expect(state().tabs).toHaveLength(3));
        expect(state().tabs.map(t => t.folderId)).toEqual(['B', 'B', 'B']);
    });

    it.each([
        ['omitted', { id: 'A', moveTabs: true }],
        ['empty text', { id: 'A', moveTabs: true, targetFolderId: '' }],
        ['a number', { id: 'A', moveTabs: true, targetFolderId: 7 }],
        ['null', { id: 'A', moveTabs: true, targetFolderId: null }],
    ])('moveTabs with a target that is %s: the tabs become unfiled and survive', async (_l, payload) => {
        const { unmount } = await mountWithTabsIn('A');
        deliver({ type: 'STORAGE_FOLDER_DELETED', payload });
        expect(
            state()
                .tabs.filter(t => t.id !== 'other')
                .map(t => t.folderId)
        ).toEqual(['', '']);
        await waitFor(async () => expect(await folderIdsInDb()).toMatchObject({ t1: '', t2: '' }));
        unmount();
    });

    it.each([
        ['absent', { id: 'A', targetFolderId: 'B' }],
        ['false', { id: 'A', moveTabs: false, targetFolderId: 'B' }],
        ['the text "true"', { id: 'A', moveTabs: 'true', targetFolderId: 'B' }],
        ['1', { id: 'A', moveTabs: 1, targetFolderId: 'B' }],
    ])('moveTabs %s: the folder tabs are dropped, other folders keep theirs', async (_l, payload) => {
        const { unmount } = await mountWithTabsIn('A');
        deliver({ type: 'STORAGE_FOLDER_DELETED', payload });
        expect(state().tabs.map(t => t.id)).toEqual(['other']);
        await waitFor(async () => expect(await folderIdsInDb()).toEqual({ other: 'B' }));
        unmount();
    });

    it('deleting a folder that is the target itself leaves a dangling id and keeps the tabs', async () => {
        const { unmount } = await mountWithTabsIn('A');
        deliver({ type: 'STORAGE_FOLDER_DELETED', payload: { id: 'A', moveTabs: true, targetFolderId: 'A' } });
        expect(
            state()
                .tabs.map(t => t.id)
                .sort()
        ).toEqual(['other', 't1', 't2']);
        unmount();
    });

    it('a second delivery (the initiating tab also receives it) changes nothing', async () => {
        const { unmount } = await mountWithTabsIn('A');
        const message = { type: 'STORAGE_FOLDER_DELETED', payload: { id: 'A', moveTabs: true, targetFolderId: 'B' } };
        deliver(message);
        const once = JSON.stringify(state().tabs);
        deliver(message);
        expect(JSON.stringify(state().tabs)).toBe(once);
        unmount();
    });
});

describe('boards without a creation date in IndexedDB (AC5)', () => {
    beforeEach(async () => {
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [] });
        await db.clearAllData();
    });

    it('loads, lists every board and puts the undated ones first', async () => {
        await db.addBoard(makeBoard({ id: 'dated', createdAt: '2021-01-01T00:00:00.000Z' }));
        await db.addBoard({ ...makeBoard({ id: 'undated' }), createdAt: undefined } as never);
        await db.addBoard({ ...makeBoard({ id: 'nulled' }), createdAt: null } as never);
        const { unmount } = renderHook(() => useStorageSync());
        await waitFor(() => expect(state().boards).toHaveLength(3));
        expect(state().boards[2].id).toBe('dated');
        expect(
            state()
                .boards.slice(0, 2)
                .map(b => b.id)
                .sort()
        ).toEqual(['nulled', 'undated']);
        unmount();
    });
});
