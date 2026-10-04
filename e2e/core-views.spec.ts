import { readFile } from 'node:fs/promises';
import type { Page, Worker } from '@playwright/test';
import type { Folder, Note, Tab, Task } from '../src/types';
import { expect, seedTask, storedTask, test } from './fixtures';

/** Open a TabPlex view in the same tab (the fixture starts on #/tasks) */
const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));

/** The background's copy of a collection (chrome.storage.local) */
function stored<T>(serviceWorker: Worker, key: string) {
    return serviceWorker.evaluate(async k => ((await chrome.storage.local.get(k))[k] as T[] | undefined) ?? [], key);
}

/** The page's copy of a collection (IndexedDB) */
function inPage<T>(page: Page, store: string) {
    return page.evaluate(
        name =>
            new Promise<T[]>((resolve, reject) => {
                const request = indexedDB.open('TabPlexDB');
                request.onsuccess = () => {
                    const all = request.result.transaction(name).objectStore(name).getAll();
                    all.onsuccess = () => resolve(all.result as T[]);
                    all.onerror = () => reject(all.error);
                };
                request.onerror = () => reject(request.error);
            }),
        store
    );
}

test.describe('Boards', () => {
    test('create a folder and a tab in it; both survive a reload', async ({ app, serviceWorker }) => {
        await openView(app, 'boards');

        await app.getByRole('button', { name: 'Create folder' }).click();
        await app.locator('#board-folder-name').fill('Research');
        await app.getByRole('button', { name: 'Create', exact: true }).click();
        await expect(app.getByText('Research').first()).toBeVisible();

        // The header button (each folder also has its own "Add tab")
        await app.locator('.board-action-btn-primary', { hasText: /add tab/i }).click();
        await app.locator('#board-tab-title').fill('Stripe pricing');
        await app.locator('#board-tab-url').fill('stripe.com/pricing');
        await app.locator('#board-tab-folder').selectOption({ label: 'Research' });
        await app.getByRole('button', { name: 'Create', exact: true }).click();
        // Folders start collapsed: the count shows the new tab, expanding shows it
        const folderRow = app.getByRole('button', { name: 'Folder: Research' });
        await expect(folderRow).toContainText('1');
        await folderRow.click();
        await expect(app.getByText('Stripe pricing').first()).toBeVisible();

        // Saved for the background too
        await expect
            .poll(async () => (await stored<Folder>(serviceWorker, 'tabboard_folders')).map(f => f.name))
            .toContain('Research');
        const folder = (await stored<Folder>(serviceWorker, 'tabboard_folders')).find(f => f.name === 'Research')!;
        await expect
            .poll(async () =>
                (await stored<Tab>(serviceWorker, 'tabboard_tabs')).find(t => t.title === 'Stripe pricing')
            )
            .toMatchObject({ url: 'https://stripe.com/pricing', folderId: folder.id });

        await app.reload();
        await app.getByRole('button', { name: 'Folder: Research' }).click();
        await expect(app.getByText('Stripe pricing').first()).toBeVisible();
    });
});

test.describe('Boards sync', () => {
    test('renaming a folder and a tab reaches the background and other TabPlex tabs', async ({
        app,
        context,
        extensionId,
        serviceWorker,
    }) => {
        await openView(app, 'boards');
        await app.getByRole('button', { name: 'Create folder' }).click();
        await app.locator('#board-folder-name').fill('Drafts');
        await app.getByRole('button', { name: 'Create', exact: true }).click();
        await app.locator('.board-action-btn-primary', { hasText: /add tab/i }).click();
        await app.locator('#board-tab-title').fill('Old title');
        await app.locator('#board-tab-url').fill('example.com/page');
        await app.locator('#board-tab-folder').selectOption({ label: 'Drafts' });
        await app.getByRole('button', { name: 'Create', exact: true }).click();

        const other = await context.newPage();
        await other.goto(`chrome-extension://${extensionId}/index.html#/boards`);
        await expect(other.getByRole('button', { name: 'Folder: Drafts' })).toBeVisible();
        await other.getByRole('button', { name: 'Folder: Drafts' }).click(); // expand to see its tab
        await app.bringToFront();

        // Rename the folder
        const folderRow = app.getByRole('button', { name: 'Folder: Drafts' });
        await folderRow.getByRole('button', { name: 'Edit folder' }).click();
        await app.locator('#board-folder-name').fill('Published');
        await app.getByRole('button', { name: 'Save', exact: true }).click();

        // Rename the tab
        await app.getByRole('button', { name: 'Folder: Published' }).click();
        await app.getByRole('button', { name: 'Edit tab' }).first().click();
        await app.locator('#board-tab-title').fill('New title');
        await app.getByRole('button', { name: 'Save', exact: true }).click();

        // (the background also keeps its own Inbox folder and tracks open browser tabs)
        await expect
            .poll(async () => (await stored<Folder>(serviceWorker, 'tabboard_folders')).map(f => f.name))
            .toEqual(expect.arrayContaining(['Published']));
        expect((await stored<Folder>(serviceWorker, 'tabboard_folders')).map(f => f.name)).not.toContain('Drafts');
        await expect
            .poll(async () => (await stored<Tab>(serviceWorker, 'tabboard_tabs')).map(t => t.title))
            .toEqual(expect.arrayContaining(['New title']));
        expect((await stored<Tab>(serviceWorker, 'tabboard_tabs')).map(t => t.title)).not.toContain('Old title');
        // The other TabPlex tab shows both edits without a reload
        await expect(other.getByRole('button', { name: 'Folder: Published' })).toBeVisible();
        await expect(other.getByText('New title')).toBeVisible();
    });
});

test.describe('Notes', () => {
    test('create and edit a note; the edit reaches the background and other TabPlex tabs', async ({
        app,
        context,
        extensionId,
        serviceWorker,
    }) => {
        await openView(app, 'notes');
        const other = await context.newPage();
        await other.goto(`chrome-extension://${extensionId}/index.html#/notes`);
        await app.bringToFront();

        await app.locator('.expand-note-btn').first().click();
        await app.getByPlaceholder('Write your note in markdown...').first().fill('# Launch plan\nShip v1');
        await app.locator('.add-note-btn').first().click();
        await expect(app.locator('.note-markdown', { hasText: 'Launch plan' })).toBeVisible();

        await expect
            .poll(async () => (await stored<Note>(serviceWorker, 'tabboard_notes')).map(n => n.title))
            .toEqual(['Launch plan']);

        await app.getByRole('button', { name: 'Edit note' }).first().click();
        await app
            .getByPlaceholder('Write your note in markdown...')
            .first()
            .fill('# Launch checklist\nShip v1 on Monday');
        await app.locator('.save-btn').first().click();

        // Saved in the page, in the background, with the title following the first line…
        await expect
            .poll(async () => (await inPage<Note>(app, 'notes'))[0])
            .toMatchObject({ title: 'Launch checklist', content: '# Launch checklist\nShip v1 on Monday' });
        await expect
            .poll(async () => (await stored<Note>(serviceWorker, 'tabboard_notes'))[0])
            .toMatchObject({ title: 'Launch checklist', content: '# Launch checklist\nShip v1 on Monday' });
        // …and shown in the other open TabPlex tab without a reload
        await expect(other.locator('.note-markdown', { hasText: 'Ship v1 on Monday' })).toBeVisible();
    });
});

test.describe('Bookmarks', () => {
    test('lists the browser bookmarks', async ({ app, serviceWorker }) => {
        await serviceWorker.evaluate(() =>
            chrome.bookmarks.create({ parentId: '1', title: 'E2E Docs', url: 'https://docs.e2e.test/' })
        );
        await openView(app, 'bookmarks');
        // Bookmarks bar items are listed at the top level
        await expect(app.getByLabel('Bookmark: E2E Docs')).toBeVisible();
    });
});

test.describe('Settings', () => {
    test('export then import restores the data in the page and in the background', async ({ app, serviceWorker }) => {
        await seedTask(app, { id: 'task_keep', title: 'Exported task' });
        await expect.poll(async () => (await storedTask(serviceWorker, 'task_keep'))?.title).toBe('Exported task');

        await openView(app, 'settings');
        const [download] = await Promise.all([
            app.waitForEvent('download'),
            app.locator('.setting-action-btn', { hasText: 'Export' }).click(),
        ]);
        const file = await download.path();
        const exported = JSON.parse(await readFile(file, 'utf8'));
        expect(exported.data.tasks.map((t: Task) => t.id)).toContain('task_keep');

        // Work done after the export…
        await seedTask(app, { id: 'task_later', title: 'Made after export' });
        await expect.poll(async () => (await storedTask(serviceWorker, 'task_later'))?.title).toBe('Made after export');

        // …is replaced by the backup, in both copies
        await openView(app, 'settings');
        await app.locator('input[type="file"]').setInputFiles(file);
        await expect
            .poll(async () => (await inPage<Task>(app, 'tasks')).map(t => t.id).sort(), { timeout: 15_000 })
            .toEqual(['task_keep']);
        await expect
            .poll(async () => (await stored<Task>(serviceWorker, 'tabboard_tasks')).map(t => t.id).sort())
            .toEqual(['task_keep']);

        // The importing tab shows its toast, then reloads exactly once; the restored task is what it shows
        const reloaded = app.waitForEvent('load');
        await expect(app.getByText('Data imported successfully! Reloading...')).toBeVisible();
        await reloaded;
        await openView(app, 'tasks');
        await expect(app.locator('.task-card', { hasText: 'Exported task' })).toBeVisible();
        await expect(app.locator('.task-card', { hasText: 'Made after export' })).toHaveCount(0);
    });
});
