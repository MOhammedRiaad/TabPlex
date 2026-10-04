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
