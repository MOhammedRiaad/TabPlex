import type { Page, Worker } from '@playwright/test';
import { expect, seedTask, site, test } from './fixtures';
import type { Board, Folder, Tab } from '../src/types';

/** Write items the way the UI persists them (IndexedDB + ADD_* message), without reloading */
async function seed(page: Page, items: { boards?: Board[]; folders?: Folder[]; tabs?: Tab[] }) {
    await page.evaluate(async data => {
        const types = { boards: 'ADD_BOARD', folders: 'ADD_FOLDER', tabs: 'ADD_TAB' } as const;
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('TabPlexDB');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        for (const store of ['boards', 'folders', 'tabs'] as const) {
            for (const item of data[store] ?? []) {
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(store, 'readwrite');
                    tx.objectStore(store).put(item);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                });
                await chrome.runtime.sendMessage({ type: types[store], payload: item });
            }
        }
        db.close();
    }, items);
}

/** All items of one IndexedDB store, read from an app page */
function idbAll<T>(page: Page, store: string): Promise<T[]> {
    return page.evaluate(
        name =>
            new Promise<T[]>((resolve, reject) => {
                const request = indexedDB.open('TabPlexDB');
                request.onsuccess = () => {
                    const db = request.result;
                    const get = db.transaction(name, 'readonly').objectStore(name).getAll();
                    get.onsuccess = () => {
                        db.close();
                        resolve(get.result as T[]);
                    };
                    get.onerror = () => reject(get.error);
                };
                request.onerror = () => reject(request.error);
            }),
        store
    );
}

/** A key of the background's copy (chrome.storage.local) */
function stored<T>(serviceWorker: Worker, key: string): Promise<T | undefined> {
    return serviceWorker.evaluate(async k => (await chrome.storage.local.get(k))[k], key) as Promise<T | undefined>;
}

const now = () => new Date().toISOString();

test.describe('across TabPlex tabs', () => {
    test('folder delete keeps moved tabs', async ({ app, context, extensionId, serviceWorker }) => {
        const t = now();
        const board: Board = { id: 'default_board', name: 'My Board', createdAt: t, updatedAt: t };
        const folderA: Folder = {
            id: 'folder_a',
            name: 'Folder Alpha',
            boardId: board.id,
            color: '#3b82f6',
            order: 0,
            createdAt: t,
        };
        const folderB: Folder = {
            id: 'folder_b',
            name: 'Folder Beta',
            boardId: board.id,
            color: '#10b981',
            order: 1,
            createdAt: t,
        };
        const tab: Tab = {
            id: 'tab_moved',
            title: 'Moved Tab Title',
            url: 'https://e2e.test/moved',
            folderId: folderA.id,
            tabId: null,
            lastAccessed: t,
            status: 'closed',
            createdAt: t,
        };
        await seed(app, { boards: [board], folders: [folderA, folderB], tabs: [tab] });

        const boardsUrl = `chrome-extension://${extensionId}/index.html#/boards`;
        await app.goto(boardsUrl);
        await app.reload();
        const second = await context.newPage();
        await second.goto(boardsUrl);
        await expect(second.getByText('Folder Alpha').first()).toBeVisible();
        // Folders show their tab count; Beta is empty and Alpha holds the tab
        const betaFolder = second.getByRole('button', { name: 'Folder: Folder Beta' });
        await expect(second.getByRole('button', { name: 'Folder: Folder Alpha' })).toContainText('1');
        await expect(betaFolder).not.toContainText('1');

        await app.evaluate(() =>
            chrome.runtime.sendMessage({
                type: 'DELETE_FOLDER',
                payload: { id: 'folder_a', moveTabs: true, targetFolderId: 'folder_b' },
            })
        );

        await expect(second.getByText('Folder Alpha')).toHaveCount(0);
        await expect(betaFolder).toContainText('1');
        // Let the second page's sync effects write to IndexedDB, then reload it: the tab must survive
        await second.waitForTimeout(1000);
        await second.reload();
        await expect(second.getByRole('button', { name: 'Folder: Folder Beta' })).toContainText('1');

        const [inIdb] = (await idbAll<Tab>(second, 'tabs')).filter(x => x.id === tab.id);
        expect(inIdb?.folderId).toBe(folderB.id);
        const inBackground = (await stored<Tab[]>(serviceWorker, 'tabboard_tabs'))?.find(x => x.id === tab.id);
        expect(inBackground?.folderId).toBe(folderB.id);
    });

    test('clear all data across tabs', async ({ app, context, extensionId, serviceWorker }) => {
        await seedTask(app, { id: 'task_to_clear', title: 'Task to clear' });
        // Recording on, as for a user who opted in: Clear All Data must turn it off
        await serviceWorker.evaluate(() => chrome.storage.local.set({ tabplex_track_all_tabs: true }));

        const other = await context.newPage();
        await other.goto(`chrome-extension://${extensionId}/index.html#/boards`);
        await other.evaluate(() => {
            (window as unknown as { marker: string }).marker = 'before-clear';
        });
        await app.goto(`chrome-extension://${extensionId}/index.html#/settings`);
        app.on('dialog', dialog => dialog.accept());
        await app.getByRole('button', { name: /Clear Data/ }).click();

        // The other tab reloads (the marker on its window is gone) within 2 s
        // (evaluate throws while the page is navigating: that counts as reloading)
        await expect
            .poll(
                () => other.evaluate(() => (window as unknown as { marker?: string }).marker).catch(() => 'navigating'),
                { timeout: 2000 }
            )
            .not.toBe('before-clear');
        await other.waitForLoadState('load');
        expect(await other.evaluate(() => (window as unknown as { marker?: string }).marker)).toBeUndefined();

        // Wait for both reloads and for BoardView to create its default board
        await app.waitForTimeout(3000);
        expect(await idbAll(other, 'tasks')).toEqual([]);
        expect(((await stored<unknown[]>(serviceWorker, 'tabboard_tasks')) ?? []).length).toBe(0);
        const boards = await idbAll<Board>(other, 'boards');
        expect(boards.length).toBeLessThanOrEqual(1);
        for (const board of boards) expect(board.id).toBe('default_board');
        expect(await stored<boolean>(serviceWorker, 'tabplex_track_all_tabs')).toBe(false);

        // A page loaded after the clear is not recorded
        const before = (await stored<Tab[]>(serviceWorker, 'tabboard_tabs')) ?? [];
        const page = await context.newPage();
        await page.goto(site('after-clear'));
        await page.waitForTimeout(1000);
        const after = (await stored<Tab[]>(serviceWorker, 'tabboard_tabs')) ?? [];
        expect(after.length).toBe(before.length);
    });
});
