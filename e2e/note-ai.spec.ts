import type { Page, Worker } from '@playwright/test';
import type { Note, Task } from '../src/types';
import { expect, test } from './fixtures';

const NOTE = 'Met with Sam about the pricing page. We need to email legal and update the FAQ.';
const REWRITE = 'Pricing sync with Sam: email legal, update the FAQ.';

const openNotes = (page: Page) => page.goto(page.url().replace(/#\/.*$/, '#/notes'));

function stored<T>(serviceWorker: Worker, key: string) {
    return serviceWorker.evaluate(async k => ((await chrome.storage.local.get(k))[k] as T[] | undefined) ?? [], key);
}

async function addNote(app: Page, text: string) {
    await app.locator('.expand-note-btn').first().click();
    await app.getByPlaceholder('Write your note in markdown...').first().fill(text);
    await app.locator('.add-note-btn').first().click();
    await app.getByRole('button', { name: 'Edit note' }).first().click();
}

test.describe('AI note helpers', () => {
    test('without on-device AI the ✨ AI menu is not shown', async ({ app }) => {
        await openNotes(app);
        await addNote(app, NOTE);
        await expect(app.getByRole('button', { name: '👁️ Preview' })).toBeVisible();
        await expect(app.getByRole('button', { name: '✨ AI' })).toHaveCount(0);
    });

    test('rewrite → Replace → Undo → Replace → Save reaches the background; action items become tasks', async ({
        app,
        serviceWorker,
    }) => {
        // Stand-in for Chrome's built-in model: rewrites, or lists to-dos when asked with a schema
        await app.addInitScript(
            ({ rewrite }) => {
                (self as unknown as { LanguageModel: unknown }).LanguageModel = {
                    availability: async () => 'available',
                    create: async () => ({
                        contextWindow: 100_000,
                        measureContextUsage: async (s: string) => s.length,
                        prompt: async (_input: string, options?: { responseConstraint?: object }) =>
                            options?.responseConstraint
                                ? JSON.stringify({ tasks: [{ title: 'Email legal', priority: 'high' }] })
                                : rewrite,
                        destroy() {},
                    }),
                };
            },
            { rewrite: REWRITE }
        );
        await app.reload();
        await openNotes(app);
        await addNote(app, NOTE);
        const editor = app.locator('.markdown-textarea');

        await app.getByRole('button', { name: '✨ AI' }).click();
        await app.getByRole('menuitem', { name: 'Shorter' }).click();
        const dialog = app.getByRole('dialog', { name: 'Rewrite: shorter' });
        await expect(dialog.getByText(REWRITE)).toBeVisible();
        await dialog.getByRole('button', { name: 'Replace' }).click();
        await expect(editor).toHaveValue(REWRITE);
        await app.getByRole('button', { name: 'Undo' }).click();
        await expect(editor).toHaveValue(NOTE);

        await app.getByRole('button', { name: '✨ AI' }).click();
        await app.getByRole('menuitem', { name: 'Shorter' }).click();
        await app.getByRole('dialog').getByRole('button', { name: 'Replace' }).click();
        await app.locator('.save-btn').first().click();
        await expect.poll(async () => (await stored<Note>(serviceWorker, 'tabboard_notes'))[0]?.content).toBe(REWRITE);

        await app.getByRole('button', { name: 'Edit note' }).first().click();
        await app.getByRole('button', { name: '✨ AI' }).click();
        await app.getByRole('menuitem', { name: 'Action items → tasks' }).click();
        await app.getByRole('dialog').getByRole('button', { name: 'Create 1 task' }).click();
        await expect(app.getByText('Created 1 task')).toBeVisible();
        await expect
            .poll(async () => (await stored<Task>(serviceWorker, 'tabboard_tasks')).map(t => [t.title, t.priority]))
            .toContainEqual(['Email legal', 'high']);
    });
});
