// Generates the landing-page and Chrome Web Store screenshots from the real built extension with demo data.
// Run: npm run build && npm run screenshots  (not part of `npm run test:e2e`)
// Output: store-assets/screenshots/*.png (1280×800) and landing-page/images/*.png
// Needs a network connection: tabs that TabPlex reopens itself (Resume) bypass Playwright's request interception,
// so the Park dialog shows the real sites' page titles.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STORE_DIR = path.join(ROOT, 'store-assets', 'screenshots');
const LANDING_DIR = path.join(ROOT, 'landing-page', 'images');
const SIZE = { width: 1280, height: 800 };

/** Demo web pages, served locally (no network): URL → page title */
const PAGES: Record<string, string> = {
    'https://stripe.com/pricing': 'Pricing & fees | Stripe',
    'https://www.paddle.com/pricing': 'Pricing | Paddle',
    'https://docs.stripe.com/tax': 'Stripe Tax | Stripe Documentation',
    'https://react.dev/reference/react/useEffect': 'useEffect – React',
    'https://react.dev/learn/you-might-not-need-an-effect': 'You Might Not Need an Effect – React',
    'https://www.google.com/travel/flights/lisbon': 'Flights to Lisbon – Google Flights',
    'https://www.booking.com/city/pt/lisbon.html': 'Hotels in Lisbon | Booking.com',
    'https://github.com/acme/web/pull/42': 'Add pricing page by alex · Pull Request #42',
};

const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

async function serveDemoPages(context: BrowserContext) {
    // Registered after the fixture's route, so it takes precedence for these hosts
    await context.route(/^https:\/\/(www\.|docs\.)?(stripe|paddle|react|google|booking|github)\.(com|dev)\//, route => {
        const url = route.request().url();
        const title = PAGES[url] ?? new URL(url).hostname;
        return route.fulfill({
            contentType: 'text/html; charset=utf-8',
            body: `<!doctype html><meta charset="utf-8"><title>${title}</title><h1>${title}</h1>`,
        });
    });
}

/** Put records straight into TabPlex's IndexedDB, and tasks into the background copy too */
async function seed(app: Page, data: Record<string, unknown[]>) {
    await app.evaluate(async records => {
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('TabPlexDB');
            request.onsuccess = () => {
                const stores = Object.keys(records);
                const tx = request.result.transaction(stores, 'readwrite');
                for (const store of stores) for (const item of records[store]) tx.objectStore(store).put(item);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            request.onerror = () => reject(request.error);
        });
        for (const task of records.tasks ?? []) await chrome.runtime.sendMessage({ type: 'ADD_TASK', payload: task });
        localStorage.setItem('tabplex_display_name', 'Alex');
    }, data);
    // Reload at once: the running app mirrors its (empty) store into IndexedDB and would delete these records
    await app.reload();
}

const contextTab = (url: string) => ({ url, title: PAGES[url] });

function demoData() {
    const t = now();
    return {
        tasks: [
            {
                id: 'demo_pricing',
                title: 'Write the Q4 pricing page',
                description: 'Compare payment providers and draft the copy.',
                status: 'doing',
                priority: 'high',
                dueDate: t.slice(0, 10),
                createdAt: daysAgo(3),
                updatedAt: daysAgo(1),
                context: {
                    state: 'parked',
                    tabs: [
                        'https://stripe.com/pricing',
                        'https://www.paddle.com/pricing',
                        'https://docs.stripe.com/tax',
                    ].map(contextTab),
                    parkedAt: daysAgo(1),
                    resumeNote: 'Comparing Stripe vs Paddle fees, stopped at EU VAT',
                    aiSummary: 'You were comparing Stripe and Paddle pricing, focusing on fees and EU VAT handling.',
                    parkCount: 2,
                    resumeCount: 1,
                    events: [],
                },
            },
            {
                id: 'demo_review',
                title: 'Review the pricing page PR',
                status: 'todo',
                priority: 'medium',
                dueDate: t.slice(0, 10),
                createdAt: daysAgo(1),
                updatedAt: daysAgo(1),
                context: { state: 'idle', tabs: [contextTab('https://github.com/acme/web/pull/42')] },
            },
            {
                id: 'demo_hooks',
                title: 'Refactor the checkout effects',
                status: 'todo',
                priority: 'low',
                createdAt: daysAgo(2),
                updatedAt: daysAgo(2),
                checklist: [
                    { id: 'c1', text: 'Read "You might not need an effect"', completed: true },
                    { id: 'c2', text: 'Move fetching into the loader', completed: false },
                ],
            },
            {
                id: 'demo_done',
                title: 'Send the invoice to Acme',
                status: 'done',
                priority: 'medium',
                createdAt: daysAgo(2),
                updatedAt: t,
                completedAt: t,
                completedSessions: 3,
            },
        ],
        notes: [
            {
                id: 'demo_note',
                title: 'Pricing ideas',
                content: '# Pricing ideas\n- Annual plan: 2 months free\n- **Team** tier from 5 seats',
                format: 'markdown',
                createdAt: t,
                updatedAt: t,
            },
        ],
        boards: [{ id: 'default_board', name: 'My Board', color: '#3b82f6', createdAt: t, updatedAt: t }],
        folders: [
            { id: 'f_research', name: 'Research', boardId: 'default_board', color: '#3b82f6', order: 0, createdAt: t },
            { id: 'f_trip', name: 'Lisbon trip', boardId: 'default_board', color: '#22c55e', order: 1, createdAt: t },
        ],
        tabs: [
            ['t1', 'f_research', 'https://react.dev/reference/react/useEffect'],
            ['t2', 'f_research', 'https://react.dev/learn/you-might-not-need-an-effect'],
            ['t3', 'f_trip', 'https://www.google.com/travel/flights/lisbon'],
            ['t4', 'f_trip', 'https://www.booking.com/city/pt/lisbon.html'],
        ].map(([id, folderId, url], order) => ({
            id,
            folderId,
            url,
            title: PAGES[url],
            tabId: null,
            status: 'closed',
            lastAccessed: t,
            createdAt: t,
            order,
        })),
    };
}

/** Store screenshot: exactly 1280×800 at 1× (the Web Store requires that size) */
async function shoot(page: Page, name: string) {
    await page.waitForTimeout(400); // let animations settle
    await page.screenshot({ path: path.join(STORE_DIR, `${name}.png`) });
}

/**
 * Landing-page image at 2× pixel density, cropped to what the section is about, so it stays sharp on high-DPI
 * screens and readable in a ~500px column. `target` is an element, or a region of the 1280×800 window.
 */
async function landingShot(
    page: Page,
    name: string,
    target: Locator | { x: number; y: number; width: number; height: number }
) {
    const box = 'screenshot' in target ? await target.boundingBox() : target;
    if (!box) throw new Error(`${name}: nothing to capture`);
    // Capture through CDP: Playwright's screenshot() would reset the device scale factor to the context's 1×
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...SIZE, deviceScaleFactor: 2, mobile: false });
    await page.waitForTimeout(400);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 1 } });
    await writeFile(path.join(LANDING_DIR, `${name}.png`), Buffer.from(data, 'base64'));
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await cdp.detach();
    await page.setViewportSize(SIZE);
}

const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
    await mkdir(STORE_DIR, { recursive: true });
});

for (const scheme of ['light', 'dark'] as const) {
    test(`store screenshots (${scheme})`, async ({ app, context, serviceWorker }) => {
        const suffix = scheme === 'dark' ? '-dark' : '';
        await serveDemoPages(context);
        await app.setViewportSize(SIZE);
        await app.emulateMedia({ colorScheme: scheme });
        await serviceWorker.evaluate(async () => {
            await chrome.bookmarks.create({
                parentId: '1',
                title: 'Stripe Dashboard',
                url: 'https://dashboard.stripe.com/',
            });
            await chrome.bookmarks.create({ parentId: '1', title: 'React docs', url: 'https://react.dev/' });
            await chrome.bookmarks.create({ parentId: '1', title: 'GitHub', url: 'https://github.com/' });
        });
        const { boards, folders, tabs, ...work } = demoData();
        await seed(app, work);

        // 1. Today: parked work, today's tasks, notes, quick links
        await openView(app, 'today');
        await app.reload();
        await expect(app.getByText('Pick up where you left off')).toBeVisible();
        await shoot(app, `1-today${suffix}`);
        if (scheme === 'light') await landingShot(app, '1-today', { x: 0, y: 0, ...SIZE });

        // 2. Park & Resume: resume the parked task, then open the Park dialog
        await openView(app, 'tasks');
        const card = app.locator('.task-card', { hasText: 'Write the Q4 pricing page' }).first();
        await card.locator('.task-context-btn-primary').click(); // Resume: tabs reopen in a group
        await expect(app.locator('.active-context-pill')).toBeVisible();
        // Wait for the reopened tabs to load (the dialog lists their titles) and the toast to go
        await expect
            .poll(() =>
                serviceWorker.evaluate(
                    async () =>
                        (await chrome.tabs.query({})).filter(
                            tab =>
                                tab.groupId !== -1 && tab.status === 'complete' && !!tab.title && tab.title !== tab.url
                        ).length
                )
            )
            .toBeGreaterThan(1);
        await app.bringToFront();
        await expect(app.locator('.board-toast-message')).toHaveCount(0, { timeout: 10_000 });
        await app.locator('.active-context-park').click();
        await app.getByLabel('Where did you leave off?').fill('Comparing Stripe vs Paddle fees, stopped at EU VAT');
        await shoot(app, `2-park-resume${suffix}`);
        if (scheme === 'light') await landingShot(app, '2-park-resume', app.locator('.park-dialog'));
        // Park it for real: otherwise the next pages would join the active task's group
        await app.getByLabel('Where did you leave off?').press('Enter');
        await expect(app.locator('.active-context-pill')).toHaveCount(0);

        // 3. Organize tabs (example AI answer: Chrome's built-in model isn't available in automated browsers)
        await app.addInitScript(() => {
            // Summarizer too, so Settings shows one consistent state
            (self as unknown as { Summarizer: unknown }).Summarizer = { availability: async () => 'available' };
            (self as unknown as { LanguageModel: unknown }).LanguageModel = {
                availability: async () => 'available',
                create: async () => ({
                    contextWindow: 100_000,
                    measureContextUsage: async (s: string) => s.length,
                    prompt: async () =>
                        JSON.stringify({
                            groups: [
                                { name: 'React Effects', color: 'blue', tabs: [1, 2] },
                                { name: 'Lisbon Trip', color: 'green', tabs: [3, 4] },
                            ],
                        }),
                    destroy() {},
                }),
            };
        });
        for (const url of [
            'https://react.dev/reference/react/useEffect',
            'https://react.dev/learn/you-might-not-need-an-effect',
            'https://www.google.com/travel/flights/lisbon',
            'https://www.booking.com/city/pt/lisbon.html',
        ]) {
            const page = await context.newPage();
            await page.goto(url);
        }
        await openView(app, 'today');
        await app.reload();
        await app.bringToFront();
        await app.getByRole('button', { name: /Organize tabs/ }).click();
        await expect(app.getByText('✨ Suggested by on-device AI')).toBeVisible();
        await shoot(app, `3-organize-tabs${suffix}`);
        if (scheme === 'light') await landingShot(app, '3-organize-tabs', app.locator('.organize-dialog'));
        await app.keyboard.press('Escape');

        // 4. Boards
        await seed(app, { boards, folders, tabs });
        await openView(app, 'boards');
        await app.getByRole('button', { name: 'Folder: Research' }).click();
        await app.getByRole('button', { name: 'Folder: Lisbon trip' }).click();
        await shoot(app, `4-boards${suffix}`);
        // One folder column with its tabs: readable at the landing page's column width
        if (scheme === 'light') await landingShot(app, '4-boards', { x: 32, y: 316, width: 616, height: 296 });

        // 5. Settings: on-device AI and local data
        await openView(app, 'settings');
        await app.getByRole('heading', { level: 3, name: /On-device AI$/ }).scrollIntoViewIfNeeded();
        await shoot(app, `5-settings-ai${suffix}`);
    });
}
