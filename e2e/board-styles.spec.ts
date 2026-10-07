import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// docs/specs/BOARD_VIEWS.md
const openView = (page: Page, route: string) => page.goto(page.url().replace(/#\/.*$/, `#/${route}`));
const boardTitle = (page: Page) => page.locator('.board-title').first();

test.describe('Board styles', () => {
    test('board tabs by default; Settings switches every open view to the bookshelf', async ({ app }) => {
        await openView(app, 'boards');
        const tabs = app.getByRole('tablist', { name: 'Boards' });
        await expect(tabs).toBeVisible();

        await app.getByRole('button', { name: 'New board' }).click();
        await app.getByRole('dialog', { name: 'New board' }).getByLabel('Name').fill('Home');
        await app.getByRole('button', { name: 'Create board' }).click();
        await expect(tabs.getByRole('tab', { name: /Home/ })).toHaveAttribute('aria-selected', 'true');
        await expect(boardTitle(app)).toHaveText('Home');

        await openView(app, 'settings');
        await app.getByRole('radio', { name: /Bookshelf/ }).click();
        await expect(app.getByRole('radio', { name: /Bookshelf/ })).toHaveAttribute('aria-checked', 'true');

        await openView(app, 'boards');
        await expect(app.locator('.bsw-shelf--bookshelf')).toBeVisible();
        const firstBook = app.locator('.bsw-spine:not(.bsw-spine-new)').first();
        const firstName = (await firstBook.getAttribute('title'))?.split(' · ')[0] ?? '';
        await firstBook.click();
        await expect(boardTitle(app)).toHaveText(firstName);

        // [ and ] move between boards
        await app.locator('body').press(']');
        await expect(boardTitle(app)).toHaveText('Home');
    });

    test('onboarding saves the picked style', async ({ context, extensionId, serviceWorker }) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
        await expect(page.getByRole('radio', { name: /Board tabs/ })).toBeChecked();
        await page.getByText('Side dock', { exact: true }).click();
        await expect(page.getByRole('status')).toHaveText('Saved: Side dock');
        const saved = await serviceWorker.evaluate(
            async () => (await chrome.storage.local.get('tabplex_board_style')).tabplex_board_style
        );
        expect(saved).toBe('dock');
        await page.close();
    });
});
