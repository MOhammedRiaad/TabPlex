import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BoardView from '../BoardView';
import { useBoardStore } from '../../../store/boardStore';
import { fakeChrome, respondToMessages } from '../../../test/chromeMock';
import { makeBoard, makeFolder, makeSession, makeTab } from '../../../test/factories';

const state = () => useBoardStore.getState();
const byId = (id: string) => document.getElementById(id) as HTMLElement;

function seed() {
    useBoardStore.setState({
        boards: [makeBoard({ id: 'b1', name: 'Work' })],
        folders: [
            makeFolder({ id: 'f1', name: 'Research', boardId: 'b1' }),
            makeFolder({ id: 'f2', name: 'Empty folder', boardId: 'b1', color: '#ff0000' }),
        ],
        tabs: [
            makeTab({ id: 't1', title: 'Stripe docs', url: 'https://stripe.com/docs', folderId: 'f1', order: 0 }),
            makeTab({
                id: 't2',
                title: 'Paddle',
                url: 'https://paddle.com',
                folderId: 'f1',
                order: 1,
                favicon: 'p.png',
            }),
            makeTab({ id: 't3', title: 'Loose tab', url: 'https://loose.dev', folderId: '' }),
            makeTab({ id: 't4', title: 'Orphan', url: 'https://orphan.dev', folderId: 'deleted-folder' }),
            makeTab({ id: 't5', title: 'Session tab', url: 'https://s.dev', folderId: '' }),
            makeTab({ id: 't6', title: 'Other board', url: 'https://ob.dev', folderId: 'other' }),
        ],
        sessions: [makeSession({ tabIds: ['t5'] })],
        history: [],
    });
    useBoardStore.setState(s => ({
        folders: [...s.folders, makeFolder({ id: 'other', boardId: 'b2', name: 'Elsewhere' })],
    }));
}

describe('BoardView', () => {
    beforeEach(() => {
        seed();
        respondToMessages(m =>
            m.type === 'GET_HISTORY'
                ? [
                      {
                          id: 'h1',
                          url: 'https://hist.dev',
                          title: 'Hist',
                          visitCount: 2,
                          lastVisitTime: '2026-10-01T00:00:00Z',
                      },
                  ]
                : undefined
        );
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('shows the board folders, loose and orphaned tabs but not session tabs', () => {
        render(<BoardView />);
        expect(screen.getByText('Research')).toBeInTheDocument();
        expect(screen.getByText('Loose tab')).toBeInTheDocument();
        expect(screen.getByText('Orphan')).toBeInTheDocument();
        expect(screen.queryByText('Session tab')).not.toBeInTheDocument();
        expect(screen.queryByText('Other board')).not.toBeInTheDocument();
    });

    it('creates a default board when there is none', async () => {
        vi.useFakeTimers();
        useBoardStore.setState({ boards: [], folders: [], tabs: [] });
        render(<BoardView />);
        act(() => vi.advanceTimersByTime(500));
        expect(state().boards.map(b => b.id)).toEqual(['default_board']);
    });

    it('searches folders and tabs, with an empty state', () => {
        render(<BoardView />);
        const search = screen.getByLabelText('Search tabs and folders');
        fireEvent.change(search, { target: { value: 'paddle' } });
        expect(screen.getByText('Research')).toBeInTheDocument();
        expect(screen.queryByText('Loose tab')).not.toBeInTheDocument();
        fireEvent.change(search, { target: { value: 'empty' } });
        expect(screen.getByText('Empty folder')).toBeInTheDocument();
        fireEvent.change(search, { target: { value: 'zzz' } });
        expect(document.querySelector('.board-empty')).toHaveTextContent('No folders or tabs found matching "zzz"');
        fireEvent.click(screen.getByLabelText('Clear search'));
        expect(screen.getByText('Loose tab')).toBeInTheDocument();
    });

    it('focuses search with Ctrl+F and switches view modes', () => {
        render(<BoardView />);
        fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
        expect(document.activeElement).toBe(screen.getByLabelText('Search tabs and folders'));
        fireEvent.click(screen.getByLabelText('Switch to list view'));
        expect(document.querySelector('.board-list')).not.toHaveClass('grid-view');
        fireEvent.click(screen.getByLabelText('Switch to grid view'));
        expect(document.querySelector('.board-list')).toHaveClass('grid-view');
    });

    it('creates folders and tabs through the modals', async () => {
        render(<BoardView />);
        fireEvent.click(screen.getByLabelText('Create folder'));
        fireEvent.change(byId('board-folder-name'), { target: { value: 'New folder' } });
        fireEvent.change(byId('board-folder-color'), { target: { value: '#00ff00' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(state().folders.some(f => f.name === 'New folder' && f.color === '#00ff00')).toBe(true);
        expect(await screen.findByText('Folder created successfully!')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Add tab'));
        fireEvent.change(byId('board-tab-title'), { target: { value: 'Example' } });
        fireEvent.change(byId('board-tab-url'), { target: { value: 'example.com' } });
        fireEvent.change(byId('board-tab-folder'), { target: { value: 'f1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(state().tabs.find(t => t.title === 'Example')).toMatchObject({
            url: 'https://example.com',
            folderId: 'f1',
        });
    });

    it('opens, edits, copies and deletes tabs', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        render(<BoardView />);
        const loose = screen.getByLabelText('Tab: Loose tab');
        fireEvent.click(within(loose).getByText('Loose tab'));
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith({ url: 'https://loose.dev' });
        fireEvent.click(within(loose).getByLabelText('Open tab in new tab'));
        expect(fakeChrome().tabs.create).toHaveBeenCalledTimes(2);

        fireEvent.click(within(loose).getByLabelText('Copy URL to clipboard'));
        await screen.findByText('URL copied to clipboard!');
        writeText.mockRejectedValueOnce(new Error('denied'));
        fireEvent.click(within(loose).getByLabelText('Copy URL to clipboard'));
        await screen.findByText('Failed to copy URL');

        fireEvent.click(within(loose).getByLabelText('Edit tab'));
        const titleInput = byId('board-tab-title');
        expect(titleInput).toHaveValue('Loose tab');
        fireEvent.change(titleInput, { target: { value: 'Renamed tab' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(state().tabs.find(t => t.id === 't3')!.title).toBe('Renamed tab');

        fireEvent.click(within(screen.getByLabelText('Tab: Renamed tab')).getByLabelText('Delete tab'));
        expect(state().tabs.find(t => t.id === 't3')).toBeUndefined();

        fireEvent.keyDown(screen.getByLabelText('Tab: Orphan'), { key: 'Enter' });
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith({ url: 'https://orphan.dev' });
        fireEvent.keyDown(screen.getByLabelText('Tab: Orphan'), { key: 'Delete' });
        expect(state().tabs.find(t => t.id === 't4')).toBeUndefined();
    });

    it('logs failures to open tabs', async () => {
        fakeChrome().tabs.create.mockRejectedValueOnce(new Error('blocked'));
        render(<BoardView />);
        fireEvent.click(within(screen.getByLabelText('Tab: Loose tab')).getByText('Loose tab'));
        await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error opening tab:', expect.any(Error)));
    });

    it('expands folders, edits them and adds tabs to them', () => {
        render(<BoardView />);
        const folder = screen.getByLabelText('Folder: Research');
        expect(folder).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(within(folder).getByText('Research'));
        expect(folder).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Stripe docs')).toBeInTheDocument();
        fireEvent.keyDown(folder, { key: ' ' });
        expect(folder).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(within(folder).getByLabelText('Edit folder'));
        fireEvent.change(byId('board-folder-name'), { target: { value: 'Research 2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(state().folders.find(f => f.id === 'f1')!.name).toBe('Research 2');

        fireEvent.click(within(screen.getByLabelText('Folder: Research 2')).getByLabelText('Add tab to folder'));
        fireEvent.change(byId('board-tab-title'), { target: { value: 'In folder' } });
        fireEvent.change(byId('board-tab-url'), { target: { value: 'https://in.dev' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(state().tabs.find(t => t.title === 'In folder')!.folderId).toBe('f1');
    });

    it('deletes empty folders after confirmation, and folders with tabs via the delete modal', () => {
        render(<BoardView />);
        fireEvent.click(within(screen.getByLabelText('Folder: Empty folder')).getByLabelText('Delete folder'));
        expect(state().folders.find(f => f.id === 'f2')).toBeUndefined();

        useBoardStore.setState(s => ({
            folders: [...s.folders, makeFolder({ id: 'f3', name: 'Target', boardId: 'b1' })],
        }));
        fireEvent.click(within(screen.getByLabelText('Folder: Research')).getByLabelText('Delete folder'));
        const dialog = screen.getByText('Delete Folder').closest('.board-modal-content') as HTMLElement;
        const confirmBtn = within(dialog).getByRole('button', { name: 'Move & Delete Folder' });
        expect(confirmBtn).toBeDisabled();
        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'f3' } });
        fireEvent.click(confirmBtn);
        expect(state().folders.find(f => f.id === 'f1')).toBeUndefined();
        expect(state().tabs.filter(t => t.folderId === 'f3')).toHaveLength(2);
    });
});
