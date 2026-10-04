import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import type { Task } from '../src/types';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSION_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/** Pages served for tests (no network needed): https://e2e.test/<name> */
export const site = (name: string) => `https://e2e.test/${name}`;

/** A page on another fake site: any *.test host is served, e.g. siteOn('news.test', 'a') */
export const siteOn = (host: string, path: string) => `https://${host}/${path}`;

type Fixtures = {
    context: BrowserContext;
    serviceWorker: Worker;
    extensionId: string;
    app: Page;
};

export const test = base.extend<Fixtures>({
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring form
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext('', {
            channel: 'chromium', // new headless mode supports extensions
            // Use a preinstalled Chromium when the matching Playwright build isn't installed
            executablePath: process.env.PW_CHROMIUM_PATH || undefined,
            args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
        });
        await context.route(/^https:\/\/[a-z0-9.-]+\.test\//, route => {
            const name = new URL(route.request().url()).pathname.slice(1);
            return route.fulfill({
                contentType: 'text/html',
                body: `<!doctype html><title>Page ${name}</title><h1>${name}</h1>`,
            });
        });
        await use(context);
        await context.close();
    },

    serviceWorker: async ({ context }, use) => {
        const [existing] = context.serviceWorkers();
        await use(existing ?? (await context.waitForEvent('serviceworker')));
    },

    extensionId: async ({ serviceWorker }, use) => {
        await use(new URL(serviceWorker.url()).host);
    },

    app: async ({ context, extensionId }, use) => {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`chrome-extension://${extensionId}/index.html#/tasks`);
        await use(page);
        if (errors.length) throw new Error(`Uncaught page errors:\n${errors.join('\n')}`);
    },
});

export const expect = test.expect;

/** Read a task from the background's copy (chrome.storage.local) */
export function storedTask(serviceWorker: Worker, id: string) {
    return serviceWorker.evaluate(async taskId => {
        const { tabboard_tasks } = await chrome.storage.local.get('tabboard_tasks');
        return (tabboard_tasks as Task[] | undefined)?.find(t => t.id === taskId);
    }, id);
}

/** Create a task the way the UI persists it (IndexedDB + ADD_TASK), then reload */
export async function seedTask(app: Page, task: { id: string; title: string; priority?: string; status?: string }) {
    await app.evaluate(async t => {
        const now = new Date().toISOString();
        const full = { status: 'todo', priority: 'medium', createdAt: now, updatedAt: now, ...t };
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('TabPlexDB');
            request.onsuccess = () => {
                const tx = request.result.transaction('tasks', 'readwrite');
                tx.objectStore('tasks').put(full);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
            request.onerror = () => reject(request.error);
        });
        await chrome.runtime.sendMessage({ type: 'ADD_TASK', payload: full });
    }, task);
    await app.reload();
}

/** URLs of the open web tabs (test pages) */
export function openWebTabs(serviceWorker: Worker) {
    return serviceWorker.evaluate(async () =>
        (await chrome.tabs.query({})).map(t => t.url ?? '').filter(url => url.startsWith('https://e2e.test/'))
    );
}
