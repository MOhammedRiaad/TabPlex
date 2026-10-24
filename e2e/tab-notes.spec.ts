import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import type { Note } from '../src/types';
import { expect, siteOn, test } from './fixtures';

// "Summarize open tabs" (spec §16): the Combined review by default, and the By tab layout when it is chosen.

const DNS_CACHING = siteOn('dns-guide.test', 'dns-caching');
const DNS_TTL = siteOn('ttl-guide.test', 'dns-ttl');
const NEGATIVE = siteOn('resolver-notes.test', 'negative-caching');
const BREAD = siteOn('kitchen.test', 'sourdough-bread');
const PAGES = [DNS_CACHING, DNS_TTL, NEGATIVE, BREAD];

/** First sentence of e2e/pages/dns-caching.html: the model stand-in quotes it, so it passes the grounding checks */
const FIRST_SENTENCE =
    'DNS caching keeps the answers a resolver has already received so that a repeated lookup for the same name does not need another round trip across the internet.';

const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));

async function openPages(context: BrowserContext, urls: string[]) {
    for (const url of urls) {
        const page = await context.newPage();
        await page.goto(url);
    }
}

async function openSummarize(app: Page) {
    await openView(app, 'notes');
    await app.bringToFront();
    await app.getByRole('button', { name: '✨ Summarize open tabs' }).click();
    const dialog = app.getByRole('dialog', { name: 'Summarize open tabs' });
    await expect(dialog).toBeVisible();
    return dialog;
}

/** Every note in the page's IndexedDB (the notes store) */
function notesInDb(app: Page) {
    return app.evaluate(
        () =>
            new Promise<Note[]>((resolve, reject) => {
                const request = indexedDB.open('TabPlexDB');
                request.onsuccess = () => {
                    const db = request.result;
                    const req = db.transaction('notes', 'readonly').objectStore('notes').getAll();
                    req.onsuccess = () => {
                        db.close();
                        resolve(req.result as Note[]);
                    };
                    req.onerror = () => reject(req.error);
                };
                request.onerror = () => reject(request.error);
            })
    );
}

/** The background's copy of the notes (chrome.storage.local) */
function notesInBackground(serviceWorker: Worker) {
    return serviceWorker.evaluate(async () => {
        const { tabboard_notes } = await chrome.storage.local.get('tabboard_notes');
        return (tabboard_notes as Note[] | undefined) ?? [];
    });
}

/** How the stand-in answers the combine call of a shared topic (see stubModel) */
type CombineAnswer = 'merge' | 'unknown-label' | 'invented-number' | 'hang';

/**
 * Stand-in for Chrome's built-in model, installed in the TabPlex page before it loads. Every call is answered by its
 * schema: points by quoting the first sentences of the page (which pass the grounding checks), topic names with no
 * groups, and a combine call by merging the first two labelled points of the topic into one statement (`merge`).
 * `unknown-label` and `invented-number` give answers the checks must reject. With `hang` every call never answers, and
 * with `combine: 'hang'` only the combine calls don't: the run waits until it is cancelled.
 */
async function stubModel(app: Page, options: { hang?: boolean; combine?: CombineAnswer } = {}) {
    await app.addInitScript(
        ({ hang, combine }) => {
            const sentencesOf = (input: string) =>
                input
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line !== '' && !line.startsWith('#') && !line.startsWith('Page:'))
                    .flatMap(line => line.split(/(?<=\.)\s+/))
                    .filter(sentence => sentence.length >= 40 && sentence.length <= 200 && sentence.endsWith('.'))
                    .slice(0, 3);
            const never = (signal?: AbortSignal) =>
                new Promise<string>((_resolve, reject) =>
                    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
                );
            const combineAnswer = (input: string) => {
                // Combine input lines are "a (page 1): text". The pair from two pages that shares the most words is merged.
                const points = [...input.matchAll(/^([a-z]+) \(page (\d+)\): (.*)$/gm)].map(m => ({
                    label: m[1],
                    page: m[2],
                    text: m[3],
                }));
                const wordsOf = (text: string) => new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
                let best: { a: (typeof points)[number]; b: (typeof points)[number]; score: number } | null = null;
                for (const a of points) {
                    for (const b of points) {
                        if (a.page === b.page) continue;
                        const shared = [...wordsOf(a.text)].filter(word => wordsOf(b.text).has(word)).length;
                        const score = shared / Math.max(1, wordsOf(a.text).size);
                        if (!best || score > best.score) best = { a, b, score };
                    }
                }
                if (!best) return JSON.stringify({ heading: 'DNS caching', statements: [] });
                const { a, b } = best;
                if (combine === 'unknown-label') {
                    return JSON.stringify({
                        heading: 'DNS caching',
                        statements: [{ text: a.text, from: ['zz', 'yy'] }],
                    });
                }
                if (combine === 'invented-number') {
                    const text = `${a.text} The TTL is 3600 seconds.`;
                    return JSON.stringify({ heading: 'DNS caching', statements: [{ text, from: [a.label, b.label] }] });
                }
                return JSON.stringify({
                    heading: 'DNS caching',
                    statements: [{ text: a.text, from: [a.label, b.label] }],
                });
            };
            const session = (): unknown => ({
                contextWindow: 100_000,
                measureContextUsage: async (text: string) => text.length,
                clone: async () => session(),
                prompt: (input: string, promptOptions?: { signal?: AbortSignal; responseConstraint?: object }) => {
                    const schema = promptOptions?.responseConstraint as { properties?: object } | undefined;
                    const fields = Object.keys(schema?.properties ?? {});
                    if (hang) return never(promptOptions?.signal);
                    if (fields.includes('statements')) {
                        return combine === 'hang'
                            ? never(promptOptions?.signal)
                            : Promise.resolve(combineAnswer(input));
                    }
                    if (fields.includes('groups')) return Promise.resolve(JSON.stringify({ groups: [] }));
                    const points = sentencesOf(input).map(text => ({ text, topic: 'DNS caching' }));
                    return Promise.resolve(JSON.stringify({ points }));
                },
                destroy() {},
            });
            (self as unknown as { LanguageModel: unknown }).LanguageModel = {
                availability: async () => 'available',
                create: async () => session(),
            };
        },
        { hang: options.hang ?? false, combine: options.combine ?? 'merge' }
    );
    await app.reload();
}

test.describe('Summarize open tabs (page access on)', () => {
    test.use({ pageAccess: true });

    test('quick view reads the picked tabs into one note with a Sources list', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);
        await expect(dialog.getByText('4 of 4 selected, max 12')).toBeVisible();

        // The test browser has no model, so the quick view runs
        await dialog.getByRole('button', { name: 'Make quick view' }).click();
        await expect(dialog.getByText('quick view', { exact: true }).first()).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Create note' })).toBeEnabled();

        // Combined is the layout on screen: the DNS pages share a topic, the recipe is in its own section
        await expect(dialog.getByRole('radio', { name: 'Combined' })).toBeChecked();
        const leftover = dialog.getByRole('region', { name: 'Only in one source' });
        await expect(leftover).toBeVisible();
        await expect(
            leftover.getByRole('button', { name: 'Open source 4: Sourdough bread at home' }).first()
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Create note' }).click();

        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await notesInDb(app)).length).toBe(1);
        await expect.poll(async () => (await notesInBackground(serviceWorker)).length).toBe(1);

        const [inDb] = await notesInDb(app);
        const [inBackground] = await notesInBackground(serviceWorker);
        expect(inBackground).toMatchObject({ id: inDb.id, title: inDb.title, content: inDb.content });
        expect(inDb).toMatchObject({ format: 'markdown', tags: ['study'] });
        expect(inDb.title).toMatch(/^Study notes · /);
        expect(inDb.content).toContain('grouped by shared words');
        expect(inDb.content).not.toContain('built-in AI');

        // The DNS pages share a topic: the bullets of the shared topics, together, cite at least two of the three DNS pages.
        // The recipe is never cited there.
        const [topics, leftovers] = inDb.content.split('## Only in one source');
        const dnsPages = [DNS_CACHING, DNS_TTL, NEGATIVE];
        expect(dnsPages.filter(url => topics.includes(`](${url})`)).length).toBeGreaterThanOrEqual(2);
        expect(topics).not.toContain(`](${BREAD})`);
        expect(leftovers).toContain(`](${BREAD})`);

        // The Sources list still has all four pages
        const [, sourcesList] = inDb.content.split('## Sources');
        for (const url of PAGES) expect(sourcesList).toContain(`](${url})`);
        expect(inDb.content).toContain('quick view');
    });

    test('switching to By tab and creating the note gives one section per tab', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);
        await dialog.getByRole('button', { name: 'Make quick view' }).click();
        await expect(dialog.getByRole('button', { name: 'Create note' })).toBeEnabled();

        await dialog.getByRole('radio', { name: 'By tab' }).click();
        await expect(dialog.getByRole('region', { name: /^Source \d: / })).toHaveCount(PAGES.length);
        await dialog.getByRole('button', { name: 'Create note' }).click();

        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await notesInBackground(serviceWorker)).length).toBe(1);
        const [note] = await notesInBackground(serviceWorker);
        // One section per tab, its heading links to that tab, and no combined topics
        expect(note.content.match(/^## .+ \(\[\d\]\(https:\/\/[^)]+\)\)$/gm)).toHaveLength(PAGES.length);
        expect(note.content).not.toContain('## Only in one source');
        expect(note.content).not.toContain('grouped by shared words');
        for (const url of PAGES) expect(note.content).toContain(`](${url})`);
    });

    test('with a model, the points quote their page and the note says AI wrote them', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await stubModel(app);
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);

        await dialog.getByRole('button', { name: 'Summarize 4 tabs' }).click();
        await expect(dialog.getByRole('button', { name: 'Create note' })).toBeEnabled();
        // The review opens in Combined; this test checks the points as they are written in By tab
        await dialog.getByRole('radio', { name: 'By tab' }).click();
        await expect(dialog.getByRole('textbox', { name: 'Point 1 of DNS caching explained' })).toHaveValue(
            FIRST_SENTENCE
        );
        await dialog.getByRole('button', { name: 'Create note' }).click();

        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await notesInBackground(serviceWorker)).length).toBe(1);
        const [note] = await notesInBackground(serviceWorker);
        expect(note.content).toContain(`- ${FIRST_SENTENCE}`);
        expect(note.content).toContain("summarized by your browser's built-in AI on this device");
        expect(note.tags).toEqual(['study']);
    });

    test('the shared topics are combined by the AI, and the note says so and cites two pages in a bullet', async ({
        app,
        context,
        serviceWorker,
    }) => {
        await stubModel(app);
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);

        await dialog.getByRole('button', { name: 'Summarize 4 tabs' }).click();
        await expect(dialog.getByRole('button', { name: 'Create note' })).toBeEnabled();
        await expect(dialog.getByText('combined by AI').first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Create note' }).click();

        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await notesInBackground(serviceWorker)).length).toBe(1);
        const [note] = await notesInBackground(serviceWorker);
        expect(note.content).toContain(
            "_From 4 tabs, combined by topic by your browser's built-in AI on this device. It can be wrong: check the sources before relying on it._"
        );
        expect(note.content).not.toContain('grouped by shared words');
        // A bullet of a shared topic cites at least two of the pages it was combined from
        const [topics] = note.content.split('## Only in one source');
        const citingTwo = topics
            .split('\n')
            .filter(line => line.startsWith('- ') && (line.match(/\]\(https:/g) ?? []).length >= 2);
        expect(citingTwo.length).toBeGreaterThan(0);
    });

    // A combine answer the checks reject leaves that topic as its word grouping, and nothing is dropped from the note
    for (const answer of ['unknown-label', 'invented-number'] as const) {
        test(`a combine answer with ${answer} keeps the topics by shared words and every page in the note`, async ({
            app,
            context,
            serviceWorker,
        }) => {
            await stubModel(app, { combine: answer });
            await openPages(context, PAGES);
            const dialog = await openSummarize(app);

            await dialog.getByRole('button', { name: 'Summarize 4 tabs' }).click();
            await expect(dialog.getByRole('button', { name: 'Create note' })).toBeEnabled();
            await expect(dialog.getByText('grouped by shared words (no AI)').first()).toBeVisible();
            await expect(dialog.getByText('combined by AI')).toHaveCount(0);
            await dialog.getByRole('button', { name: 'Create note' }).click();

            await expect(dialog).toHaveCount(0);
            await expect.poll(async () => (await notesInBackground(serviceWorker)).length).toBe(1);
            const [note] = await notesInBackground(serviceWorker);
            expect(note.content).toContain('Topics were grouped by shared words.');
            expect(note.content).not.toContain('combined by topic');
            expect(note.content).not.toContain('The TTL is 3600 seconds.');
            expect(note.content).toContain(FIRST_SENTENCE);
            for (const url of PAGES) expect(note.content).toContain(`](${url})`);
        });
    }

    test('Cancel while combining keeps the word grouping of the topics', async ({ app, context, serviceWorker }) => {
        await stubModel(app, { combine: 'hang' });
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);

        await dialog.getByRole('button', { name: 'Summarize 4 tabs' }).click();
        await expect(dialog.getByText(/^Combining topic 1 of \d+…$/)).toBeVisible();
        await expect(dialog.getByText('grouped by shared words (no AI)').first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();

        // The run stops with the word grouping kept: the review is there and can be saved
        await expect(dialog.getByRole('button', { name: 'Create note' })).toBeEnabled();
        await expect(dialog.getByText('grouped by shared words (no AI)').first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Create note' }).click();

        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => (await notesInBackground(serviceWorker)).length).toBe(1);
        const [note] = await notesInBackground(serviceWorker);
        expect(note.content).toContain('Topics were grouped by shared words.');
        expect(note.content).not.toContain('combined by topic');
    });

    test('Cancel during the run creates no note', async ({ app, context, serviceWorker }) => {
        await stubModel(app, { hang: true });
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);

        await dialog.getByRole('button', { name: 'Summarize 4 tabs' }).click();
        await expect(dialog.getByText(/^Reading and summarizing 1 of 4/)).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel' }).click();

        // The run stops with nothing read, so there is nothing to save
        await expect(dialog.getByText('Nothing was read.')).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Create note' })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Close' }).click();
        await expect(dialog).toHaveCount(0);
        expect(await notesInDb(app)).toHaveLength(0);
        expect(await notesInBackground(serviceWorker)).toHaveLength(0);
    });

    test('Esc during the run closes the dialog and creates no note', async ({ app, context, serviceWorker }) => {
        await stubModel(app, { hang: true });
        await openPages(context, PAGES);
        const dialog = await openSummarize(app);

        await dialog.getByRole('button', { name: 'Summarize 4 tabs' }).click();
        await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
        await app.keyboard.press('Escape');

        await expect(dialog).toHaveCount(0);
        await expect(app.getByRole('button', { name: '✨ Summarize open tabs' })).toBeFocused();
        expect(await notesInDb(app)).toHaveLength(0);
        expect(await notesInBackground(serviceWorker)).toHaveLength(0);
    });

    test('a PDF tab is listed greyed out with its reason and cannot be picked', async ({ app, context }) => {
        await openPages(context, [DNS_CACHING, DNS_TTL, siteOn('dns-guide.test', 'paper.pdf')]);
        const dialog = await openSummarize(app);

        // The PDF is listed but not picked: 2 of 3 selected
        await expect(dialog.getByText('2 of 3 selected, max 12')).toBeVisible();
        await expect(dialog.getByText("Can't read PDFs yet")).toBeVisible();
        const pdf = dialog.getByRole('checkbox', { name: /paper\.pdf/ });
        await expect(pdf).toBeDisabled();
        await expect(pdf).not.toBeChecked();
        await expect(dialog.getByRole('button', { name: 'Make quick view' })).toBeEnabled();
    });
});

test.describe('Summarize open tabs: without the page access option', () => {
    test('the real manifest asks for host access only when the feature needs it', () => {
        const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            permissions?: string[];
            optional_host_permissions?: string[];
        };

        expect(manifest.permissions).toContain('scripting');
        expect(manifest.optional_host_permissions).toEqual(expect.arrayContaining(['http://*/*', 'https://*/*']));
        expect(manifest).not.toHaveProperty('host_permissions');
    });
});
