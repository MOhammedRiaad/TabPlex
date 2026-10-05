import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BoardSwitcher from '../BoardSwitcher';
import { useBoardStore } from '../../../../store/boardStore';
import { useUIStore } from '../../../ui/store/uiStore';
import { respondToMessages } from '../../../../test/chromeMock';
import { makeBoard, makeFolder, makeTab } from '../../../../test/factories';

const state = () => useBoardStore.getState();
const active = () => useUIStore.getState().activeBoardId;

async function openMenu(user: ReturnType<typeof userEvent.setup>, item: string) {
    await user.click(screen.getByRole('button', { name: 'Board actions' }));
    await user.click(screen.getByRole('menuitem', { name: item }));
}

describe('BoardSwitcher', () => {
    beforeEach(() => {
        useBoardStore.setState({
            boards: [makeBoard({ id: 'b1', name: 'Work' }), makeBoard({ id: 'b2', name: 'Home' })],
            folders: [makeFolder({ id: 'f1', boardId: 'b1' }), makeFolder({ id: 'f2', boardId: 'b2' })],
            tabs: [makeTab({ id: 't1', folderId: 'f1' }), makeTab({ id: 't2', folderId: 'f1' })],
        });
        useUIStore.setState({ activeBoardId: null });
        respondToMessages();
        localStorage.clear();
    });

    it('renders nothing without boards', () => {
        useBoardStore.setState({ boards: [] });
        const { container } = render(<BoardSwitcher />);
        expect(container).toBeEmptyDOMElement();
    });

    it('switches boards and remembers the choice', async () => {
        const user = userEvent.setup();
        render(<BoardSwitcher />);
        const select = screen.getByRole('combobox', { name: 'Board' });
        expect(select).toHaveValue('b1');
        await user.selectOptions(select, 'b2');
        expect(active()).toBe('b2');
        expect(localStorage.getItem('tabplex_active_board')).toBe('b2');
        expect(select).toHaveValue('b2');
    });

    it('creates a board from the picker, validates the name and switches to it', async () => {
        const toast = vi.fn();
        const user = userEvent.setup();
        render(<BoardSwitcher onShowToast={toast} />);
        await user.selectOptions(screen.getByRole('combobox', { name: 'Board' }), '__new__');
        const dialog = screen.getByRole('dialog', { name: 'New board' });
        await user.click(within(dialog).getByRole('button', { name: 'Create board' }));
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
        await user.type(within(dialog).getByLabelText('Name'), '  Side project ');
        await user.click(within(dialog).getByRole('button', { name: 'Create board' }));
        const created = state().boards.find(b => b.name === 'Side project');
        expect(created).toBeDefined();
        expect(active()).toBe(created?.id);
        expect(toast).toHaveBeenCalledWith('Created board “Side project”', 'success');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the dialog on Cancel, Escape and a click outside, and the menu on an outside click', async () => {
        const user = userEvent.setup();
        const { container } = render(<BoardSwitcher />);
        await openMenu(user, 'New board');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await openMenu(user, 'New board');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await openMenu(user, 'New board');
        await user.click(container.querySelector('.board-switcher-overlay') as HTMLElement);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Board actions' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        await user.click(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('renames the current board', async () => {
        const toast = vi.fn();
        const user = userEvent.setup();
        render(<BoardSwitcher onShowToast={toast} />);
        await openMenu(user, 'Rename board');
        const name = within(screen.getByRole('dialog', { name: 'Rename board' })).getByLabelText('Name');
        expect(name).toHaveValue('Work');
        await user.clear(name);
        await user.type(name, 'Job');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(state().boards[0].name).toBe('Job');
        expect(toast).toHaveBeenCalledWith('Renamed board to “Job”', 'success');
    });

    it('deletes a board, moving its folders to another board', async () => {
        useBoardStore.setState(s => ({ boards: [...s.boards, makeBoard({ id: 'b3', name: 'Archive' })] }));
        const user = userEvent.setup();
        render(<BoardSwitcher />);
        await openMenu(user, 'Delete board');
        const dialog = screen.getByRole('dialog', { name: 'Delete “Work”' });
        expect(dialog).toHaveTextContent('It has 1 folder and 2 saved tabs.');
        await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Move to board' }), 'b3');
        await user.click(within(dialog).getByRole('button', { name: 'Delete board' }));
        expect(state().boards.map(b => b.id)).toEqual(['b2', 'b3']);
        expect(state().folders.find(f => f.id === 'f1')?.boardId).toBe('b3');
        expect(state().tabs).toHaveLength(2);
        expect(active()).toBe('b3');
    });

    it('deletes a board with its folders and tabs', async () => {
        const toast = vi.fn();
        const user = userEvent.setup();
        render(<BoardSwitcher onShowToast={toast} />);
        await openMenu(user, 'Delete board');
        const dialog = screen.getByRole('dialog');
        const target = within(dialog).getByRole('combobox', { name: 'Move to board' });
        expect(target).toBeEnabled();
        await user.click(within(dialog).getByLabelText('Delete them too'));
        expect(target).toBeDisabled();
        await user.click(within(dialog).getByRole('radio', { name: /Move them to/ }));
        expect(target).toBeEnabled();
        await user.click(within(dialog).getByLabelText('Delete them too'));
        await user.click(within(dialog).getByRole('button', { name: 'Delete board' }));
        expect(state().folders.map(f => f.id)).toEqual(['f2']);
        expect(state().tabs).toEqual([]);
        expect(active()).toBe('b2');
        expect(toast).toHaveBeenCalledWith('Deleted board “Work”', 'info');
    });

    it('deletes an empty board without asking about its contents; Escape and outside clicks cancel', async () => {
        useBoardStore.setState(s => ({ boards: [...s.boards, makeBoard({ id: 'b3', name: 'Empty' })] }));
        useUIStore.setState({ activeBoardId: 'b3' });
        const user = userEvent.setup();
        const { container } = render(<BoardSwitcher />);
        await openMenu(user, 'Delete board');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await openMenu(user, 'Delete board');
        await user.click(container.querySelector('.board-switcher-overlay') as HTMLElement);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await openMenu(user, 'Delete board');
        expect(screen.getByRole('dialog')).toHaveTextContent('This board has no folders or tabs.');
        await user.click(screen.getByRole('button', { name: 'Delete board' }));
        expect(state().boards.map(b => b.id)).toEqual(['b1', 'b2']);
        expect(active()).toBe('b1');
    });

    it('cannot delete the last board', async () => {
        useBoardStore.setState({ boards: [makeBoard({ id: 'b1', name: 'Only' })] });
        const user = userEvent.setup();
        render(<BoardSwitcher />);
        await user.click(screen.getByRole('button', { name: 'Board actions' }));
        const item = screen.getByRole('menuitem', { name: 'Delete board' });
        expect(item).toBeDisabled();
        expect(item).toHaveAttribute('title', 'You need at least one board');
    });
});
