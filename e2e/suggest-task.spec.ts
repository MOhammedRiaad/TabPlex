import { expect, siteOn, storedTask, test } from './fixtures';

const TASK_ID = 'task_suggest';

test.describe('Suggest a task for a new tab', () => {
    test.beforeEach(async ({ serviceWorker }) => {
        // A parked task with two pages on docs.test, and the setting turned on
        await serviceWorker.evaluate(
            async ({ id, a, b }) => {
                const now = new Date().toISOString();
                await chrome.storage.local.set({
                    tabboard_tasks: [
                        {
                            id,
                            title: 'Read the API docs',
                            status: 'todo',
                            priority: 'medium',
                            createdAt: now,
                            updatedAt: now,
                            context: {
                                state: 'parked',
                                parkedAt: now,
                                tabs: [
                                    { url: a, title: 'A' },
                                    { url: b, title: 'B' },
                                ],
                            },
                        },
                    ],
                    tabplex_park_resume_settings: { suggestTasksForTabs: true },
                });
            },
            { id: TASK_ID, a: siteOn('docs.test', 'a'), b: siteOn('docs.test', 'b') }
        );
    });

    test('a page already in the task is left alone; a new page on its site gets a notification', async ({
        context,
        serviceWorker,
    }) => {
        const suggestions = async () =>
            Object.keys(await serviceWorker.evaluate(() => chrome.notifications.getAll())).filter(id =>
                id.startsWith('suggest:')
            );

        const saved = await context.newPage();
        await saved.goto(siteOn('docs.test', 'a'));
        const other = await context.newPage();
        await other.goto(siteOn('news.test', 'a'));
        await saved.waitForTimeout(1000);
        expect(await suggestions()).toEqual([]);

        const page = await context.newPage();
        await page.goto(siteOn('docs.test', 'c'));
        await expect.poll(suggestions).toEqual([expect.stringMatching(new RegExp(`^suggest:\\d+:${TASK_ID}$`))]);
        // Chrome's notification buttons can't be clicked from a test; "Add to task" is covered by the unit tests
        expect((await storedTask(serviceWorker, TASK_ID))?.context?.tabs).toHaveLength(2);
    });
});
