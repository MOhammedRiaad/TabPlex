import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, seedTask, siteOn, storedTask, test } from './fixtures';
import type { Task } from '../src/types';

const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));

async function openPages(context: BrowserContext, urls: string[]) {
    for (const url of urls) {
        const page = await context.newPage();
        await page.goto(url);
    }
}

const DOCS = [siteOn('docs.test', 'a'), siteOn('docs.test', 'b'), siteOn('docs.test', 'c')];

/** The background's copy of the task with this title */
function storedTaskByTitle(serviceWorker: Worker, title: string) {
    return serviceWorker.evaluate(async t => {
        const { tabboard_tasks } = await chrome.storage.local.get('tabboard_tasks');
        return (tabboard_tasks as Task[] | undefined)?.find(task => task.title === t);
    }, title);
}

/** Open docs.test tabs in the browser */
function docsTabs(serviceWorker: Worker) {
    return serviceWorker.evaluate(async () =>
        (await chrome.tabs.query({})).filter(t => (t.url ?? '').startsWith('https://docs.test/'))
    );
}

/** Chrome tab groups: title → number of tabs */
function groups(serviceWorker: Worker) {
    return serviceWorker.evaluate(async () => {
        const out: Record<string, number> = {};
        for (const g of await chrome.tabGroups.query({})) {
            out[g.title ?? ''] = (await chrome.tabs.query({ groupId: g.id })).length;
        }
        return out;
    });
}

async function openDialog(app: Page) {
    await openView(app, 'tasks');
    await app.bringToFront();
    await app.getByRole('button', { name: '✨ Task from tabs' }).click();
    const dialog = app.getByRole('dialog', { name: 'New task from tabs' });
    await expect(dialog).toBeVisible();
    return dialog;
}

test.describe('New task from tabs', () => {
    test('drafts a title without AI and creates the task with the checked tabs', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await openPages(context, DOCS);
        const dialog = await openDialog(app);
        // Headless Chromium has no built-in AI, so the fallback draft is used
        const title = dialog.getByRole('textbox', { name: 'Task title' });
        await expect(title).toHaveValue('Research docs.test');
        await expect(dialog.getByText('Tabs (3 of 3)')).toBeVisible();
        await expect(dialog.getByRole('button', { name: /Draft again/ })).toHaveCount(0);

        await dialog.getByRole('checkbox', { name: 'Include Page c' }).uncheck();
        await dialog.getByRole('radio', { name: 'High' }).check();
        await dialog.getByRole('button', { name: '+ Add step' }).click();
        await dialog.getByRole('textbox', { name: 'Step 1' }).fill('Read the overview');
        await dialog.getByRole('button', { name: 'Create task' }).click();

        await expect(app.getByText('Created “Research docs.test” with 2 tabs')).toBeVisible();
        await expect(dialog).toHaveCount(0);
        const task = await storedTaskByTitle(serviceWorker, 'Research docs.test');
        expect(task).toMatchObject({ priority: 'high', status: 'todo' });
        expect(task?.checklist?.map(i => i.text)).toEqual(['Read the overview']);
        expect(task?.context?.tabs.map(t => t.url)).toEqual(DOCS.slice(0, 2));
        expect(task?.context?.state ?? 'idle').toBe('idle');
        expect(await docsTabs(serviceWorker)).toHaveLength(3); // nothing closed
    });

    test('Create & start groups the open tabs in place, without opening duplicates', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await openPages(context, DOCS);
        const dialog = await openDialog(app);
        await dialog.getByRole('textbox', { name: 'Task title' }).fill('Read the docs');
        await dialog.getByRole('button', { name: '▶ Create & start' }).click();

        await expect(app.getByText(/Started “Read the docs” · 3 tabs grouped/)).toBeVisible();
        const task = await storedTaskByTitle(serviceWorker, 'Read the docs');
        expect(task).toMatchObject({ status: 'doing', context: { state: 'active' } });
        await expect.poll(() => groups(serviceWorker)).toEqual({ 'Read the docs': 3 });
        expect(await docsTabs(serviceWorker)).toHaveLength(3);
    });

    test('warns that Create & start parks the active task, then parks it', async ({ app, context, serviceWorker }) => {
        const OTHER = { id: 'task_other', title: 'Plan offsite' };
        await seedTask(app, OTHER);
        const work = await context.newPage();
        await work.goto(siteOn('work.test', '1'));
        await app.bringToFront();
        const card = app.locator('.task-card', { hasText: OTHER.title }).first();
        await card.locator('.task-context-btn', { hasText: 'Add current tabs' }).click();
        await expect.poll(async () => (await storedTask(serviceWorker, OTHER.id))?.context?.tabs.length).toBe(1);
        await work.close(); // Start reopens the task's tabs in its group
        await card.locator('.task-context-btn-primary').click();
        await expect.poll(async () => (await storedTask(serviceWorker, OTHER.id))?.context?.state).toBe('active');

        // New tabs would join the active task; keep these ones loose
        await serviceWorker.evaluate(() =>
            chrome.storage.local.set({ tabplex_park_resume_settings: { autoAddNewTabs: false } })
        );
        await openPages(context, DOCS);
        const dialog = await openDialog(app);
        await expect(dialog.getByText('ⓘ Starting this task will park “Plan offsite”.')).toBeVisible();
        await dialog.getByRole('button', { name: '▶ Create & start' }).click();

        await expect(app.getByText(/· Parked “Plan offsite”/)).toBeVisible();
        await expect.poll(async () => (await storedTask(serviceWorker, OTHER.id))?.context?.state).toBe('parked');
        expect((await storedTaskByTitle(serviceWorker, 'Research docs.test'))?.context?.state).toBe('active');
    });

    test('Create & park saves the tabs to a parked task and closes them, leaving the active task alone', async ({
        app,
        context,
        serviceWorker,
    }) => {
        const OTHER = { id: 'task_busy', title: 'Current work' };
        await seedTask(app, OTHER);
        const work = await context.newPage();
        await work.goto(siteOn('work.test', '1'));
        await app.bringToFront();
        const card = app.locator('.task-card', { hasText: OTHER.title }).first();
        await card.locator('.task-context-btn', { hasText: 'Add current tabs' }).click();
        await expect.poll(async () => (await storedTask(serviceWorker, OTHER.id))?.context?.tabs.length).toBe(1);
        await work.close();
        await card.locator('.task-context-btn-primary').click();
        await expect.poll(async () => (await storedTask(serviceWorker, OTHER.id))?.context?.state).toBe('active');
        await serviceWorker.evaluate(() =>
            chrome.storage.local.set({ tabplex_park_resume_settings: { autoAddNewTabs: false } })
        );

        await openPages(context, DOCS);
        const dialog = await openDialog(app);
        await dialog.getByRole('checkbox', { name: 'Include Page c' }).uncheck();
        await dialog.getByRole('button', { name: '⏸ Create & park' }).click();

        await expect(app.getByText('Parked “Research docs.test” · 2 tabs saved and closed')).toBeVisible();
        const parked = await storedTaskByTitle(serviceWorker, 'Research docs.test');
        expect(parked?.context?.state).toBe('parked');
        expect(parked?.context?.tabs.map(t => t.url)).toEqual(DOCS.slice(0, 2));
        // Only the unchecked page is still open, and the other task kept going
        await expect.poll(async () => (await docsTabs(serviceWorker)).map(t => t.url)).toEqual([DOCS[2]]);
        expect((await storedTask(serviceWorker, OTHER.id))?.context?.state).toBe('active');
    });

    test('makes a task from a group created by Organize tabs', async ({ app, context, serviceWorker }) => {
        await openPages(context, [...DOCS, siteOn('shop.test', 'a'), siteOn('shop.test', 'b')]);
        await openView(app, 'today');
        await app.bringToFront();
        await app.getByRole('button', { name: /Organize tabs/ }).click();
        await app.getByRole('button', { name: 'Create 2 groups' }).click();
        await expect.poll(() => groups(serviceWorker)).toEqual({ 'docs.test': 3, 'shop.test': 2 });

        await app.getByRole('button', { name: 'Make a task from docs.test' }).click();
        const dialog = app.getByRole('dialog', { name: 'New task from tabs' });
        await expect(dialog.getByText('Tabs (3 of 3)')).toBeVisible();
        await expect(dialog.getByRole('textbox', { name: 'Task title' })).toHaveValue('Research docs.test');
        await dialog.getByRole('button', { name: '▶ Create & start' }).click();

        await expect(app.getByText(/Started “Research docs.test” · 3 tabs grouped/)).toBeVisible();
        // The tabs moved into the task's group; Chrome dropped the emptied organize group
        await expect.poll(() => groups(serviceWorker)).toEqual({ 'Research docs.test': 3, 'shop.test': 2 });
        const task = await storedTaskByTitle(serviceWorker, 'Research docs.test');
        expect(task?.context?.state).toBe('active');
        expect(await docsTabs(serviceWorker)).toHaveLength(3);
    });

    test('drafts with on-device AI when available (stubbed model)', async ({ app, context, serviceWorker }) => {
        await openPages(context, DOCS);
        // Stand-in for Chrome's built-in model, installed in the TabPlex page before it loads
        await app.addInitScript(() => {
            (self as unknown as { LanguageModel: unknown }).LanguageModel = {
                availability: async () => 'available',
                create: async () => ({
                    contextWindow: 100_000,
                    measureContextUsage: async (s: string) => s.length,
                    prompt: async () =>
                        JSON.stringify({
                            title: 'Compare Stripe and Paddle pricing',
                            description: 'Decide which payment provider to use.',
                            priority: 'medium',
                            steps: [
                                'Compare transaction fees',
                                'Check VAT handling for EU',
                                'Write up a recommendation',
                            ],
                        }),
                    destroy() {},
                }),
            };
        });
        await app.reload();
        const dialog = await openDialog(app);
        await expect(dialog.getByText('✨ Drafted on your device')).toBeVisible();
        await expect(dialog.getByRole('textbox', { name: 'Task title' })).toHaveValue(
            'Compare Stripe and Paddle pricing'
        );
        await expect(dialog.getByRole('textbox', { name: /^Step \d$/ })).toHaveCount(3);
        await expect(dialog.getByRole('button', { name: '↻ Draft again' })).toBeVisible();

        await dialog.getByRole('button', { name: 'Create task' }).click();
        await expect(app.getByText('Created “Compare Stripe and Paddle pricing” with 3 tabs')).toBeVisible();
        const task = await storedTaskByTitle(serviceWorker, 'Compare Stripe and Paddle pricing');
        expect(task?.checklist).toHaveLength(3);
        expect(task?.description).toBe('Decide which payment provider to use.');
    });
});
