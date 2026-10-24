import type { Page } from '@playwright/test';
import { expect, seedTask, test } from './fixtures';

const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));

/** Height of the card and of the column that holds it */
function cardInColumn(page: Page, title: string) {
    return page.locator('.task-card', { hasText: title }).evaluate(card => {
        const column = card.closest('.task-column') as HTMLElement;
        return { card: card.getBoundingClientRect().height, column: column.getBoundingClientRect().height };
    });
}

test.describe('Layout', () => {
    // Regression: a long note (such as a study note from tabs) spilled out of its card in the grid and list views,
    // because the grid row and the flex item were sized to the scroll area instead of to the note
    test('a long note stays inside its card in the grid and list views', async ({ app }) => {
        await openView(app, 'notes');
        const paragraphs = Array.from(
            { length: 40 },
            (_, i) => `- Point ${i + 1} that explains one idea in a full sentence`
        );
        await app.locator('.expand-note-btn').first().click();
        await app
            .getByPlaceholder('Write your note in markdown...')
            .first()
            .fill(`# Long note\n\n${paragraphs.join('\n')}`);
        await app.locator('.add-note-btn').first().click();
        const card = app.locator('.note-card', { hasText: 'Long note' });
        await expect(card).toBeVisible();

        for (const mode of ['grid', 'list']) {
            await app.getByRole('button', { name: `Switch to ${mode} view` }).click();
            const { scroll, client } = await card.evaluate(element => ({
                scroll: element.scrollHeight,
                client: element.clientHeight,
            }));
            expect(scroll, `${mode} view: the note must fit its card`).toBeLessThanOrEqual(client + 1);
        }
    });

    // Regression: below 1024 px the columns stack, and `flex: 1 1 0` collapsed each one to ~2 px, clipping the cards
    test('task columns stack below 1024 px without hiding their cards', async ({ app }) => {
        await app.setViewportSize({ width: 900, height: 800 });
        await seedTask(app, { id: 'task_layout', title: 'Visible on a narrow window' });

        for (const view of ['tasks', 'today']) {
            await openView(app, view);
            const card = app.locator('.task-card', { hasText: 'Visible on a narrow window' }).first();
            await expect(card).toBeVisible();
            const { card: cardHeight, column } = await cardInColumn(app, 'Visible on a narrow window');
            expect(cardHeight).toBeGreaterThan(40);
            expect(column, `${view} column must fit its card`).toBeGreaterThanOrEqual(cardHeight);
        }
    });
});
