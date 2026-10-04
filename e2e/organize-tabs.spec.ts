import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, seedTask, siteOn, storedTask, test } from './fixtures';

const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));

async function openPages(context: BrowserContext, urls: string[]) {
    for (const url of urls) {
        const page = await context.newPage();
        await page.goto(url);
    }
}

/** Chrome tab groups in the browser: title → number of tabs */
function groups(serviceWorker: Worker) {
    return serviceWorker.evaluate(async () => {
        const all = await chrome.tabGroups.query({});
        const out: Record<string, number> = {};
        for (const g of all) out[g.title ?? ''] = (await chrome.tabs.query({ groupId: g.id })).length;
        return out;
    });
}

async function startOrganizing(app: Page) {
    await openView(app, 'today');
    await app.bringToFront();
    await app.getByRole('button', { name: /Organize tabs/ }).click();
}

test.describe('Organize tabs', () => {
    test('groups by site without AI, creates the Chrome groups, and undoes them', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await openPages(context, [
            siteOn('news.test', 'a'),
            siteOn('news.test', 'b'),
            siteOn('shop.test', 'a'),
            siteOn('shop.test', 'b'),
            siteOn('blog.test', 'a'),
        ]);
        await startOrganizing(app);

        const dialog = app.getByRole('dialog', { name: /Organize \d+ tabs/ });
        await expect(dialog).toBeVisible();
        // Headless Chromium has no built-in AI, so the site path runs
        await expect(dialog.getByText('Grouped by site')).toBeVisible();
        const names = dialog.getByRole('textbox', { name: 'Group name' });
        await expect(names).toHaveCount(2);
        expect(await names.evaluateAll(els => els.map(e => (e as HTMLInputElement).value).sort())).toEqual([
            'news.test',
            'shop.test',
        ]);
        await expect(dialog.getByText('Not grouped (1)')).toBeVisible();

        await dialog.getByRole('button', { name: 'Create 2 groups' }).click();
        await expect(app.getByText('✓ Created 2 groups with 4 tabs.')).toBeVisible();
        await expect.poll(() => groups(serviceWorker)).toEqual({ 'news.test': 2, 'shop.test': 2 });

        await app.getByRole('button', { name: 'Undo' }).click();
        await expect(app.getByRole('dialog')).toHaveCount(0);
        await expect.poll(() => groups(serviceWorker)).toEqual({});
    });

    test("never touches the active Park & Resume task's group", async ({ app, context, serviceWorker }) => {
        const TASK = { id: 'task_org', title: 'Pricing work' };
        await seedTask(app, TASK);
        const workPages = await Promise.all([context.newPage(), context.newPage()]);
        await workPages[0].goto(siteOn('work.test', '1'));
        await workPages[1].goto(siteOn('work.test', '2'));
        await app.bringToFront();
        const card = app.locator('.task-card', { hasText: TASK.title }).first();
        await card.locator('.task-context-btn', { hasText: 'Add current tabs' }).click();
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.tabs.length).toBe(2);
        // Close the originals: Start reopens the task's tabs inside its group
        for (const page of workPages) await page.close();
        await card.locator('.task-context-btn-primary').click();
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('active');

        // Unrelated tabs to organize. With auto-add on, new tabs join the active task, so turn it off first.
        await serviceWorker.evaluate(() =>
            chrome.storage.local.set({ tabplex_park_resume_settings: { autoAddNewTabs: false } })
        );
        await openPages(context, [
            siteOn('news.test', 'a'),
            siteOn('news.test', 'b'),
            siteOn('shop.test', 'a'),
            siteOn('shop.test', 'b'),
        ]);
        await startOrganizing(app);
        await app.getByRole('button', { name: /^Create \d+ groups?$/ }).click();
        await expect(app.getByText(/✓ Created/)).toBeVisible();

        await expect.poll(() => groups(serviceWorker)).toEqual({ [TASK.title]: 2, 'news.test': 2, 'shop.test': 2 });
        expect((await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('active');
    });

    test('saves the created groups to Boards', async ({ app, context }) => {
        await openPages(context, [
            siteOn('docs.test', 'a'),
            siteOn('docs.test', 'b'),
            siteOn('tools.test', 'a'),
            siteOn('tools.test', 'b'),
        ]);
        await startOrganizing(app);
        await app.getByRole('button', { name: 'Create 2 groups' }).click();
        await app.getByRole('button', { name: 'Save to Boards' }).click();
        await expect(app.getByText('Saved 2 folders with 4 tabs to Boards')).toBeVisible();
        await app.getByRole('button', { name: 'Open Boards' }).click();
        await expect(app.getByRole('button', { name: 'Folder: docs.test' })).toBeVisible();
        await expect(app.getByRole('button', { name: 'Folder: tools.test' })).toBeVisible();
    });

    test('uses on-device AI when available (stubbed model)', async ({ app, context }) => {
        await openPages(context, [
            siteOn('a.test', '1'),
            siteOn('b.test', '1'),
            siteOn('c.test', '1'),
            siteOn('d.test', '1'),
        ]);
        // Stand-in for Chrome's built-in model, installed in the TabPlex page before it loads
        await app.addInitScript(() => {
            (self as unknown as { LanguageModel: unknown }).LanguageModel = {
                availability: async () => 'available',
                create: async () => ({
                    contextWindow: 100_000,
                    measureContextUsage: async (s: string) => s.length,
                    prompt: async () =>
                        JSON.stringify({
                            groups: [
                                { name: 'Reading', color: 'green', tabs: [1, 2] },
                                { name: 'Shopping', color: 'red', tabs: [3, 4] },
                            ],
                        }),
                    destroy() {},
                }),
            };
        });
        await app.reload();
        await startOrganizing(app);
        const dialog = app.getByRole('dialog', { name: /Organize 4 tabs/ });
        await expect(dialog.getByText('✨ Suggested by on-device AI')).toBeVisible();
        expect(
            await dialog
                .getByRole('textbox', { name: 'Group name' })
                .evaluateAll(els => els.map(e => (e as HTMLInputElement).value))
        ).toEqual(['Reading', 'Shopping']);
    });
});
