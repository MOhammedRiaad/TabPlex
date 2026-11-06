import { expect, site, test } from './fixtures';

test.describe('Security and background upkeep', () => {
    test('a website cannot load or detect TabPlex pages', async ({ context, extensionId }) => {
        const page = await context.newPage();
        await page.goto(site('plain'));
        const outcome = await page.evaluate(async id => {
            const load = (path: string) =>
                fetch(`chrome-extension://${id}/${path}`).then(
                    response => `loaded ${response.status}`,
                    () => 'blocked'
                );
            return { app: await load('index.html'), onboarding: await load('onboarding.html') };
        }, extensionId);
        expect(outcome).toEqual({ app: 'blocked', onboarding: 'blocked' });
    });

    test('the daily cleanup is scheduled as an alarm that survives the worker sleeping', async ({ serviceWorker }) => {
        const alarm = await serviceWorker.evaluate(() => chrome.alarms.get('tabplex-cleanup'));
        expect(alarm).toMatchObject({ name: 'tabplex-cleanup', periodInMinutes: 1440 });
    });

    test('a new install does not record the pages it browses until the user opts in', async ({
        context,
        serviceWorker,
    }) => {
        const stored = () => serviceWorker.evaluate(() => chrome.storage.local.get(['tabplex_track_all_tabs']));
        await expect.poll(stored).toEqual({ tabplex_track_all_tabs: false });

        const tracked = () =>
            serviceWorker.evaluate(async () => {
                const { tabboard_tabs } = await chrome.storage.local.get(['tabboard_tabs']);
                return ((tabboard_tabs ?? []) as { url: string }[]).map(t => t.url);
            });

        const page = await context.newPage();
        await page.goto(site('private-page'));
        await page.waitForLoadState('load');
        expect(await tracked()).not.toContain(site('private-page'));

        await serviceWorker.evaluate(() => chrome.storage.local.set({ tabplex_track_all_tabs: true }));
        await page.goto(site('recorded-page'));
        await expect.poll(tracked).toContain(site('recorded-page'));
    });
});
