import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Page, Worker } from '@playwright/test';
import { expect, seedTask, site, test } from './fixtures';
import type { Board, Folder, Tab } from '../src/types';

/** Real-extension checks for docs/specs/PRE_RELEASE_REVIEW_FIXES.md: Clear All Data, import of old files, no background inference */

const appUrl = (extensionId: string, route: string) => `chrome-extension://${extensionId}/index.html#/${route}`;

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

const now = () => new Date().toISOString();

test.describe('Clear All Data in the real extension', () => {
    for (const before of [true, false, undefined] as const) {
        test(`recording ends off and nothing comes back (was ${before === undefined ? 'missing' : before})`, async ({
            app,
            context,
            extensionId,
            serviceWorker,
        }) => {
            await seedTask(app, { id: 'task_gone', title: 'Task that must not return' });
            await serviceWorker.evaluate(async value => {
                await chrome.storage.local.set({
                    history_items: [
                        { id: 'h1', url: 'https://e2e.test/h', title: 'H', visitedAt: new Date().toISOString() },
                    ],
                    tabplex_active_context_task_id: 'task_gone',
                });
                if (value === undefined) await chrome.storage.local.remove('tabplex_track_all_tabs');
                else await chrome.storage.local.set({ tabplex_track_all_tabs: value });
            }, before);
            await expect.poll(() => stored<unknown[]>(serviceWorker, 'tabboard_tasks')).toHaveLength(1);

            // A second TabPlex tab holds the old data in memory
            const other = await context.newPage();
            await other.goto(appUrl(extensionId, 'tasks'));
            await expect(other.getByText('Task that must not return')).toBeVisible();
            await other.evaluate(() => {
                (window as unknown as { marker?: string }).marker = 'before-clear';
            });

            await app.goto(appUrl(extensionId, 'settings'));
            app.once('dialog', dialog => dialog.accept());
            await app.getByRole('button', { name: /Clear Data/ }).click();
            await expect(app.getByText('All data cleared. Reloading...')).toBeVisible();

            // The settings tab reloads itself after 1.5 s
            await app.waitForEvent('load');
            // The other tab reloaded as well: its window marker is gone and the old task is not shown
            await expect
                .poll(() => other.evaluate(() => (window as unknown as { marker?: string }).marker).catch(() => 'busy'))
                .toBeUndefined();

            // The reloaded tabs only ever create the default board
            await expect
                .poll(async () =>
                    (await idbAll<Board>(other, 'boards')).map(b => b.id).filter(id => id !== 'default_board')
                )
                .toEqual([]);
            expect(await idbAll(other, 'tasks')).toEqual([]);

            const everything = await serviceWorker.evaluate(() => chrome.storage.local.get(null));
            expect(everything.tabplex_track_all_tabs).toBe(false);
            expect(everything).not.toHaveProperty('history_items');
            expect(everything).not.toHaveProperty('tabplex_active_context_task_id');
            expect((everything.tabboard_tasks as unknown[] | undefined) ?? []).toEqual([]);

            // Reload both tabs once more: old data must not reappear from a stale in-memory copy
            await Promise.all([app.reload(), other.reload()]);
            await app.goto(appUrl(extensionId, 'tasks'));
            await expect(app.getByText('Task that must not return')).toHaveCount(0);
            await expect(other.getByText('Task that must not return')).toHaveCount(0);
            expect(await idbAll(other, 'tasks')).toEqual([]);
            expect((await stored<unknown[]>(serviceWorker, 'tabboard_tasks')) ?? []).toEqual([]);
            expect(await stored<boolean>(serviceWorker, 'tabplex_track_all_tabs')).toBe(false);

            // The settings page shows recording off
            await app.goto(appUrl(extensionId, 'settings'));
            await expect(app.getByRole('checkbox', { name: /Record every page I open/ })).not.toBeChecked();

            // A page opened now is not recorded
            const page = await context.newPage();
            await page.goto(site('after-clear'));
            await expect(page.getByRole('heading', { name: 'after-clear' })).toBeVisible();
            const recorded = await serviceWorker.evaluate(async () => {
                const { tabboard_tabs } = await chrome.storage.local.get('tabboard_tabs');
                return ((tabboard_tabs as Tab[] | undefined) ?? []).filter(t => t.url.includes('after-clear'));
            });
            expect(recorded).toEqual([]);
        });
    }
});

test.describe('background session inference is gone', () => {
    test('no tabplex-infer-sessions alarm exists after the worker started', async ({ serviceWorker }) => {
        const names = await serviceWorker.evaluate(async () => (await chrome.alarms.getAll()).map(a => a.name));
        expect(names).not.toContain('tabplex-infer-sessions');
    });

    test('an alarm left by an older build is cleared when the worker restarts', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await serviceWorker.evaluate(() => chrome.alarms.create('tabplex-infer-sessions', { periodInMinutes: 30 }));
        const created = await serviceWorker.evaluate(async () => (await chrome.alarms.getAll()).map(a => a.name));
        expect(created).toContain('tabplex-infer-sessions');

        // Stop the worker; the next message wakes a fresh one, which runs the startup code again
        const cdp = await context.newCDPSession(app);
        await cdp.send('ServiceWorker.enable');
        const stopped = serviceWorker.evaluate(() => new Promise(() => {})).catch(() => 'stopped');
        await cdp.send('ServiceWorker.stopAllWorkers');
        expect(await stopped).toBe('stopped');

        // The message wakes a fresh worker; its startup code removes the legacy alarm. The extension page can read
        // the alarms itself, so this does not depend on Playwright re-attaching to the new worker.
        await app.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }));
        await expect
            .poll(() => app.evaluate(async () => (await chrome.alarms.getAll()).map(a => a.name)))
            .not.toContain('tabplex-infer-sessions');
    });

    test('Infer Sessions from History still works on demand', async ({ app, context, extensionId, serviceWorker }) => {
        // Three visits to one site, minutes apart, are what Infer groups into a session
        for (const name of ['infer-a', 'infer-b', 'infer-c']) {
            const page = await context.newPage();
            await page.goto(site(name));
            await expect(page.getByRole('heading', { name })).toBeVisible();
            await page.close();
        }
        await expect
            .poll(() => serviceWorker.evaluate(async () => (await chrome.history.search({ text: 'e2e.test' })).length))
            .toBeGreaterThanOrEqual(3);

        await app.goto(appUrl(extensionId, 'sessions'));
        expect(await idbAll(app, 'sessions')).toEqual([]);
        await app.getByRole('button', { name: 'Infer Sessions from History' }).click();
        await expect(app.getByText(/^e2e\.test - /).first()).toBeVisible();
    });
});

test.describe('import of an old-format file', () => {
    for (const recording of [false, true]) {
        test(`loads, attaches the orphan folder to the default board and keeps recording ${recording}`, async ({
            app,
            extensionId,
            serviceWorker,
        }) => {
            await serviceWorker.evaluate(
                value => chrome.storage.local.set({ tabplex_track_all_tabs: value }),
                recording
            );

            // v1.3.0 style: a board and a task without createdAt, a folder whose board is not in the file, no
            // recording setting
            const file = {
                version: '2.0.0',
                timestamp: now(),
                data: {
                    boards: [{ id: 'old_board', name: 'Old Board' }],
                    folders: [
                        {
                            id: 'orphan_folder',
                            name: 'Orphan Folder',
                            boardId: 'missing_board',
                            color: '#3b82f6',
                            order: 0,
                        },
                    ],
                    tabs: [
                        {
                            id: 'tab_in_orphan',
                            title: 'Tab in orphan folder',
                            url: 'https://e2e.test/orphan',
                            folderId: 'orphan_folder',
                            tabId: null,
                            status: 'closed',
                            lastAccessed: now(),
                        },
                    ],
                    tasks: [{ id: 'old_task', title: 'Old task', status: 'todo', priority: 'medium' }],
                    notes: [],
                    sessions: [],
                    history: [],
                    canvases: [],
                    canvasSettings: null,
                },
                settings: { extension: {}, page: {}, timer: {} },
            };
            const filePath = path.join(os.tmpdir(), `tabplex-old-format-${Date.now()}.json`);
            await writeFile(filePath, JSON.stringify(file));

            await app.goto(appUrl(extensionId, 'settings'));
            await app.locator('input[type="file"]').setInputFiles(filePath);
            const dialog = app.getByRole('dialog', { name: 'Replace your data with this file?' });
            await expect(dialog.getByText(/had no creation date/).first()).toBeVisible();
            await expect(dialog.getByText(/1 folder without a board was moved to/)).toBeVisible();
            const reloaded = app.waitForEvent('load');
            await dialog.getByRole('button', { name: 'Replace my data' }).click();
            await expect(app.getByText('Data imported successfully! Reloading...')).toBeVisible();
            await reloaded;

            // The app loads from the repaired data
            await app.goto(appUrl(extensionId, 'boards'));
            await expect
                .poll(async () => (await idbAll<Folder>(app, 'folders')).map(f => f.boardId))
                .toEqual(['default_board']);
            const boards = await idbAll<Board>(app, 'boards');
            expect(boards.map(b => b.id).sort()).toEqual(['default_board', 'old_board']);
            for (const board of boards) expect(typeof board.createdAt).toBe('string');
            expect(boards.find(b => b.id === 'old_board')?.createdAt).toBe(new Date(0).toISOString());
            // The tab is not re-parented
            const [tab] = await idbAll<Tab>(app, 'tabs');
            expect(tab.folderId).toBe('orphan_folder');
            // The background has the same repaired folder
            const bgFolders = (await stored<Folder[]>(serviceWorker, 'tabboard_folders')) ?? [];
            expect(bgFolders.map(f => f.boardId)).toEqual(['default_board']);

            await expect(app.getByRole('navigation').first()).toBeVisible();
            await app.goto(appUrl(extensionId, 'tasks'));
            await expect(app.getByText('Old task')).toBeVisible();

            // The recording choice is what it was before the import
            expect(await stored<boolean>(serviceWorker, 'tabplex_track_all_tabs')).toBe(recording);
        });
    }
});

test.describe('folder delete broadcast', () => {
    test('without a target folder the moved tabs become unfiled in every tab', async ({
        app,
        context,
        extensionId,
        serviceWorker,
    }) => {
        const t = now();
        const board: Board = { id: 'default_board', name: 'My Board', createdAt: t, updatedAt: t };
        const folder: Folder = {
            id: 'folder_x',
            name: 'Folder Xray',
            boardId: board.id,
            color: '#3b82f6',
            order: 0,
            createdAt: t,
        };
        const tab: Tab = {
            id: 'tab_unfiled',
            title: 'Unfiled Tab Title',
            url: 'https://e2e.test/unfiled',
            folderId: folder.id,
            tabId: null,
            lastAccessed: t,
            status: 'closed',
            createdAt: t,
        };
        await seed(app, { boards: [board], folders: [folder], tabs: [tab] });

        await app.goto(appUrl(extensionId, 'boards'));
        const second = await context.newPage();
        await second.goto(appUrl(extensionId, 'boards'));
        await expect(second.getByRole('button', { name: 'Folder: Folder Xray' })).toContainText('1');

        await app.evaluate(() =>
            chrome.runtime.sendMessage({ type: 'DELETE_FOLDER', payload: { id: 'folder_x', moveTabs: true } })
        );

        await expect(second.getByText('Folder Xray')).toHaveCount(0);
        // The second tab's sync effect writes the tab to the shared IndexedDB; wait on that, then reload
        await expect
            .poll(async () => (await idbAll<Tab>(second, 'tabs')).find(x => x.id === tab.id)?.folderId)
            .toBe('');
        await second.reload();
        await expect(second.getByText('Folder Xray')).toHaveCount(0);
        expect((await idbAll<Tab>(second, 'tabs')).find(x => x.id === tab.id)?.folderId).toBe('');
        expect(((await stored<Tab[]>(serviceWorker, 'tabboard_tabs')) ?? []).find(x => x.id === tab.id)?.folderId).toBe(
            ''
        );
    });
});

test.describe('folder delete dialog with two TabPlex tabs', () => {
    const t = now();
    const board: Board = { id: 'default_board', name: 'My Board', createdAt: t, updatedAt: t };
    const folder = (id: string, name: string, order: number): Folder => ({
        id,
        name,
        boardId: board.id,
        color: '#3b82f6',
        order,
        createdAt: t,
    });
    const tabIn = (id: string, folderId: string): Tab => ({
        id,
        title: `Title ${id}`,
        url: `https://e2e.test/${id}`,
        folderId,
        tabId: null,
        lastAccessed: t,
        status: 'closed',
        createdAt: t,
    });

    /** Folder A with two tabs and folder B with one, shown in two TabPlex tabs on Boards */
    async function openTwoTabs(app: Page, context: import('@playwright/test').BrowserContext, extensionId: string) {
        await seed(app, {
            boards: [board],
            folders: [folder('folder_a', 'Folder Alpha', 0), folder('folder_b', 'Folder Beta', 1)],
            tabs: [tabIn('tab_a1', 'folder_a'), tabIn('tab_a2', 'folder_a'), tabIn('tab_b1', 'folder_b')],
        });
        await app.goto(appUrl(extensionId, 'boards'));
        await app.reload();
        const second = await context.newPage();
        await second.goto(appUrl(extensionId, 'boards'));
        for (const page of [app, second]) {
            await expect(page.getByRole('button', { name: 'Folder: Folder Alpha' })).toContainText('2');
            await expect(page.getByRole('button', { name: 'Folder: Folder Beta' })).toContainText('1');
        }
        return second;
    }

    async function openDeleteDialog(page: Page) {
        const row = page.getByRole('button', { name: 'Folder: Folder Alpha' });
        await row.hover();
        await row.getByRole('button', { name: 'Delete folder' }).click();
        await expect(page.getByRole('heading', { name: 'Delete Folder' })).toBeVisible();
        return page.locator('.board-modal-content', { has: page.getByRole('heading', { name: 'Delete Folder' }) });
    }

    test('"Move tabs to another folder" keeps the tabs in the target folder everywhere', async ({
        app,
        context,
        extensionId,
        serviceWorker,
    }) => {
        const second = await openTwoTabs(app, context, extensionId);
        const dialog = await openDeleteDialog(app);
        await dialog.getByRole('combobox').selectOption({ label: 'Folder Beta' });
        await dialog.getByRole('button', { name: 'Move & Delete Folder' }).click();

        for (const page of [app, second]) {
            await expect(page.getByText('Folder Alpha')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Folder: Folder Beta' })).toContainText('3');
        }
        // Both pages settle their IndexedDB and the background copy; then everything survives a reload
        await expect
            .poll(async () => (await idbAll<Tab>(second, 'tabs')).map(x => `${x.id}:${x.folderId}`).sort())
            .toEqual(['tab_a1:folder_b', 'tab_a2:folder_b', 'tab_b1:folder_b']);
        await expect
            .poll(async () =>
                ((await stored<Tab[]>(serviceWorker, 'tabboard_tabs')) ?? []).map(x => `${x.id}:${x.folderId}`).sort()
            )
            .toEqual(['tab_a1:folder_b', 'tab_a2:folder_b', 'tab_b1:folder_b']);
        await Promise.all([app.reload(), second.reload()]);
        for (const page of [app, second]) {
            await expect(page.getByRole('button', { name: 'Folder: Folder Beta' })).toContainText('3');
            await expect(page.getByText('Folder Alpha')).toHaveCount(0);
        }
        expect((await idbAll<Folder>(second, 'folders')).map(f => f.id)).toEqual(['folder_b']);
    });

    test('"Delete folder and all tabs" removes the tabs from every copy and they do not return', async ({
        app,
        context,
        extensionId,
        serviceWorker,
    }) => {
        const second = await openTwoTabs(app, context, extensionId);
        const dialog = await openDeleteDialog(app);
        await dialog.getByText('Delete folder and all tabs').click();
        await dialog.getByRole('button', { name: 'Delete Everything' }).click();

        for (const page of [app, second]) {
            await expect(page.getByText('Folder Alpha')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Folder: Folder Beta' })).toContainText('1');
        }
        await expect.poll(async () => (await idbAll<Tab>(second, 'tabs')).map(x => x.id)).toEqual(['tab_b1']);
        await expect
            .poll(async () => ((await stored<Tab[]>(serviceWorker, 'tabboard_tabs')) ?? []).map(x => x.id))
            .toEqual(['tab_b1']);

        // After a reload of both pages the deleted tabs have not reappeared (for example as unfiled)
        await Promise.all([app.reload(), second.reload()]);
        for (const page of [app, second]) {
            await expect(page.getByRole('button', { name: 'Folder: Folder Beta' })).toContainText('1');
            await expect(page.getByText('Folder Alpha')).toHaveCount(0);
            await expect(page.getByText('Title tab_a1')).toHaveCount(0);
            await expect(page.getByText('Title tab_a2')).toHaveCount(0);
        }
        expect((await idbAll<Tab>(second, 'tabs')).map(x => x.id)).toEqual(['tab_b1']);
        expect(((await stored<Tab[]>(serviceWorker, 'tabboard_tabs')) ?? []).map(x => x.id)).toEqual(['tab_b1']);
    });
});
