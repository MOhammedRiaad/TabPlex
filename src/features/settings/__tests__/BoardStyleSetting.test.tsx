import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import BoardStyleSetting from '../components/BoardStyleSetting';
import { BOARD_STYLE_KEY, BOARD_STYLES } from '../../boards/switcher/boardStyle';

const saved = async () => (await chrome.storage.local.get([BOARD_STYLE_KEY]))[BOARD_STYLE_KEY];

describe('BoardStyleSetting', () => {
    it('offers every board style with Board tabs selected by default', () => {
        render(<BoardStyleSetting />);
        const group = screen.getByRole('radiogroup', { name: 'Board switcher' });
        const options = within(group).getAllByRole('radio');
        expect(options).toHaveLength(BOARD_STYLES.length);
        expect(within(group).getByRole('radio', { name: /Board tabs/ })).toHaveAttribute('aria-checked', 'true');
        expect(within(group).getByRole('radio', { name: /Board tabs/ })).toHaveTextContent('Default');
    });

    it('saves the picked style and follows changes made elsewhere', async () => {
        const user = userEvent.setup();
        render(<BoardStyleSetting />);
        await user.click(screen.getByRole('radio', { name: /Bookshelf/ }));
        expect(screen.getByRole('radio', { name: /Bookshelf/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: /Board tabs/ })).toHaveAttribute('aria-checked', 'false');
        expect(await saved()).toBe('bookshelf');

        await act(() => chrome.storage.local.set({ [BOARD_STYLE_KEY]: 'dock' }));
        expect(screen.getByRole('radio', { name: /Side dock/ })).toHaveAttribute('aria-checked', 'true');
    });
});
