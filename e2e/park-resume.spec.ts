import { expect, openWebTabs, seedTask, site, storedTask, test } from './fixtures';

const TASK = { id: 'task_e2e', title: 'Write Q4 pricing page', priority: 'high' };

test.describe('Park & Resume', () => {
    test.beforeEach(async ({ app }) => {
        await seedTask(app, TASK);
    });

    test('add tabs, start, auto-add, park with a note, resume', async ({ app, context, serviceWorker }) => {
        const card = app.locator('.task-card', { hasText: TASK.title }).first();
        await expect(card).toBeVisible();

        // Open three pages, then attach them to the task
        const pages = [];
        for (const name of ['alpha', 'beta', 'gamma']) {
            const page = await context.newPage();
            await page.goto(site(name));
            pages.push(page);
        }
        await app.bringToFront();
        await card.locator('.task-context-btn', { hasText: 'Add current tabs' }).click();
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.tabs.length).toBe(3);
        await expect(card.locator('.task-context-meta')).toContainText('3 tabs');
        for (const page of pages) await page.close();

        // Start: tabs reopen in a titled, red group
        await card.locator('.task-context-btn-primary').click();
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('active');
        const task = await storedTask(serviceWorker, TASK.id);
        expect(task?.status).toBe('doing');
        const group = await serviceWorker.evaluate(async id => {
            const g = await chrome.tabGroups.get(id);
            return { title: g.title, color: g.color, tabs: (await chrome.tabs.query({ groupId: id })).length };
        }, task!.context!.chromeGroupId as number);
        expect(group).toEqual({ title: TASK.title, color: 'red', tabs: 3 });
        await expect(app.locator('.active-context-pill')).toBeVisible();

        // A tab opened while the task is active joins it
        const extra = await context.newPage();
        await extra.goto(site('delta'));
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.tabs.length).toBe(4);

        // Park from the header with a note: tabs close, context is saved
        await app.bringToFront();
        await app.locator('.active-context-park').click();
        await app.getByLabel('Where did you leave off?').fill('Comparing fees, stopped at VAT');
        await app.getByLabel('Where did you leave off?').press('Enter');
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('parked');
        const parked = await storedTask(serviceWorker, TASK.id);
        expect(parked?.context?.resumeNote).toBe('Comparing fees, stopped at VAT');
        expect(parked?.context?.tabs).toHaveLength(4);
        await expect.poll(() => openWebTabs(serviceWorker)).toEqual([]);
        await expect(card.locator('.task-context-note')).toContainText('stopped at VAT');

        // Today shows the parked task; resume from there
        await app.goto(app.url().replace('#/tasks', '#/today'));
        const row = app.locator('.parked-context', { hasText: TASK.title });
        await expect(row).toBeVisible();
        await row.locator('.parked-context-resume').click();
        await expect.poll(async () => (await openWebTabs(serviceWorker)).length).toBe(4);
        const resumed = await storedTask(serviceWorker, TASK.id);
        expect(resumed?.context).toMatchObject({ state: 'active', resumeCount: 1 });

        // Closing the group by hand parks the task without losing tabs
        await serviceWorker.evaluate(async id => {
            const ids = (await chrome.tabs.query({ groupId: id })).map(t => t.id!);
            await chrome.tabs.remove(ids);
        }, resumed!.context!.chromeGroupId as number);
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('parked');
        expect((await storedTask(serviceWorker, TASK.id))?.context?.tabs).toHaveLength(4);
    });

    test('starting another task parks the active one', async ({ app, serviceWorker }) => {
        await seedTask(app, { id: 'task_other', title: 'Plan offsite' });
        await app.locator('.task-card', { hasText: TASK.title }).locator('.task-context-btn-primary').click();
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('active');
        await app.bringToFront();
        await app.locator('.task-card', { hasText: 'Plan offsite' }).locator('.task-context-btn-primary').click();
        await expect.poll(async () => (await storedTask(serviceWorker, 'task_other'))?.context?.state).toBe('active');
        expect((await storedTask(serviceWorker, TASK.id))?.context?.state).toBe('parked');
    });

    test('task edits sync to the background and other TabPlex tabs', async ({
        app,
        context,
        extensionId,
        serviceWorker,
    }) => {
        const second = await context.newPage();
        await second.goto(`chrome-extension://${extensionId}/index.html#/tasks`);
        await app.bringToFront();
        await app.locator('.task-card', { hasText: TASK.title }).getByTitle('Doing').click();
        await expect.poll(async () => (await storedTask(serviceWorker, TASK.id))?.status).toBe('doing');
        await expect(
            second.locator('.task-card', { hasText: TASK.title }).locator('.status-btn.active[title="Doing"]')
        ).toBeVisible();
    });

    test('keyboard shortcut and command palette', async ({ app }) => {
        await app.locator('.task-card', { hasText: TASK.title }).locator('.task-context-btn-primary').click();
        await app.bringToFront();
        await app.locator('body').click();
        await app.keyboard.press('Alt+Shift+KeyP');
        await expect(app.getByRole('dialog')).toBeVisible();
        await app.keyboard.press('Escape');
        await app.keyboard.press('Control+k');
        await expect(app.getByText(`Park "${TASK.title}"`)).toBeVisible();
    });
});

test('every view renders without errors', async ({ app }) => {
    for (const route of [
        'today',
        'boards',
        'sessions',
        'analytics',
        'bookmarks',
        'notes',
        'tasks',
        'pomodoro',
        'history',
        'settings',
        'canvas',
    ]) {
        await app.goto(app.url().replace(/#\/.*$/, `#/${route}`));
        await expect(app.locator('.app-main')).toBeVisible();
        if (route === 'analytics') {
            await expect(app.getByRole('heading', { name: /Park & Resume/ })).toBeVisible();
        }
    }
});
