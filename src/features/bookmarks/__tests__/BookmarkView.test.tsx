/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookmarkView from '../BookmarkView';
import BookmarkModal from '../components/BookmarkModal';
import { useBoardStore } from '../../../store/boardStore';
import { ChromeMock, fakeChrome, installChromeMock, respondToMessages } from '../../../test/chromeMock';

let mock: ChromeMock;
let received: any[];

const tree = () => [
    {
        id: '0',
        title: '',
        children: [
            {
                id: '1',
                title: 'Bookmarks bar',
                children: [
                    {
                        id: '10',
                        parentId: '1',
                        title: 'GitHub',
                        url: 'https://github.com',
                        dateAdded: 1_700_000_000_000,
                    },
                    {
                        id: '11',
                        parentId: '1',
                        title: 'Docs',
                        dateAdded: 1_600_000_000_000,
                        dateGroupModified: 1_700_000_000_000,
                        children: [{ id: '20', parentId: '11', title: 'MDN', url: 'https://developer.mozilla.org' }],
                    },
                    { id: '12', parentId: '1', title: 'Empty folder', children: [] },
                ],
            },
            {
                id: '2',
                title: 'Other bookmarks',
                children: [{ id: '30', parentId: '2', title: 'Zed', url: 'https://zed.dev' }],
            },
        ],
    },
];

const byId = (id: string) => document.getElementById(id) as HTMLElement;

describe('BookmarkView', () => {
    beforeEach(() => {
        mock = installChromeMock();
        useBoardStore.setState({ bookmarks: [], bookmarkTree: [], isLoading: false, error: null });
        received = respondToMessages(m => {
            switch (m.type) {
                case 'GET_BOOKMARKS':
                    return tree();
                case 'SEARCH_BOOKMARKS':
                    return [{ id: '10', parentId: '1', title: 'GitHub', url: 'https://github.com' }];
                case 'CREATE_BOOKMARK':
                case 'CREATE_BOOKMARK_FOLDER':
                    return { id: 'new', ...m.payload };
                case 'UPDATE_BOOKMARK':
                    return { id: m.payload.id, ...m.payload.changes };
                case 'MOVE_BOOKMARK':
                    return { id: m.payload.id };
                default:
                    return { success: true };
            }
        });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('lists the bookmark bar and other bookmarks, expanding folders', async () => {
        render(<BookmarkView />);
        expect(await screen.findByText('GitHub')).toBeInTheDocument();
        expect(screen.getByText('Zed')).toBeInTheDocument();
        expect(screen.queryByText('MDN')).not.toBeInTheDocument();
        const docs = screen.getByLabelText('Folder: Docs');
        fireEvent.click(within(docs).getByText('Docs'));
        expect(await screen.findByText('MDN')).toBeInTheDocument();
        fireEvent.keyDown(docs, { key: 'Enter' });
        expect(screen.queryByText('MDN')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Expand all folders'));
        expect(screen.getByText('MDN')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Collapse all folders'));
        expect(screen.queryByText('MDN')).not.toBeInTheDocument();
    });

    it('reacts to Chrome bookmark events and removes listeners on unmount', async () => {
        const { unmount } = render(<BookmarkView />);
        await screen.findByText('GitHub');
        const before = received.filter(m => m.type === 'GET_BOOKMARKS').length;
        act(() => {
            mock.browser.events.bookmarkChanged.emit('10', {});
            mock.browser.events.bookmarkCreated.emit('99', {});
            mock.browser.events.bookmarkRemoved.emit('99', {});
            mock.browser.events.bookmarkMoved.emit('10', {});
        });
        await waitFor(() => expect(received.filter(m => m.type === 'GET_BOOKMARKS').length).toBe(before + 4));
        unmount();
        expect(mock.browser.events.bookmarkChanged.listeners.size).toBe(0);
    });

    it('searches, switches views and focuses search with Ctrl+F', async () => {
        render(<BookmarkView />);
        await screen.findByText('Zed');
        fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
        const search = screen.getByLabelText('Search bookmarks');
        expect(document.activeElement).toBe(search);
        fireEvent.change(search, { target: { value: 'git' } });
        await waitFor(() => expect(screen.queryByText('Zed')).not.toBeInTheDocument());
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Clear search'));
        expect(await screen.findByText('Zed')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Switch to list view'));
        fireEvent.click(screen.getByLabelText('Switch to grid view'));
    });

    it('filters and sorts', async () => {
        render(<BookmarkView />);
        await screen.findByText('Zed');
        fireEvent.click(screen.getByLabelText('Show filters and sort'));
        fireEvent.change(screen.getByLabelText('Filter bookmarks by type'), { target: { value: 'folders' } });
        await waitFor(() => expect(screen.queryByText('GitHub')).not.toBeInTheDocument());
        expect(screen.getByLabelText('Filter bookmarks by folder')).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Filter bookmarks by type'), { target: { value: 'all' } });
        fireEvent.change(screen.getByLabelText('Filter bookmarks by domain'), { target: { value: 'zed.dev' } });
        await waitFor(() => expect(screen.queryByText('GitHub')).not.toBeInTheDocument());
        fireEvent.change(screen.getByLabelText('Filter bookmarks by domain'), { target: { value: '' } });
        fireEvent.change(screen.getByLabelText('Filter bookmarks by folder'), { target: { value: '11' } });
        fireEvent.click(screen.getByLabelText('Clear all filters'));

        const criteria = screen.getByLabelText('Sort bookmarks by');
        for (const value of ['name', 'dateAdded', 'dateModified', 'domain']) {
            fireEvent.change(criteria, { target: { value } });
            fireEvent.click(screen.getByLabelText(/^Sort (ascending|descending)$/));
        }
        expect(JSON.parse(localStorage.getItem('tabboard-bookmark-sort')!).criteria).toBe('domain');
        fireEvent.click(screen.getByLabelText('Reset sort to default'));
        expect(JSON.parse(localStorage.getItem('tabboard-bookmark-sort')!).criteria).toBe('default');
        fireEvent.click(screen.getByLabelText('Hide filters and sort'));
    });

    it('creates bookmarks and folders', async () => {
        render(<BookmarkView />);
        await screen.findByText('Zed');
        fireEvent.click(screen.getByLabelText('Add bookmark'));
        fireEvent.change(byId('bookmark-title'), { target: { value: 'New one' } });
        fireEvent.change(byId('bookmark-url'), { target: { value: 'new.dev' } });
        fireEvent.change(byId('bookmark-parent'), { target: { value: '11' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        await screen.findByText('Bookmark created successfully!');
        expect(received.find(m => m.type === 'CREATE_BOOKMARK').payload).toEqual({
            title: 'New one',
            url: 'https://new.dev',
            parentId: '11',
        });

        fireEvent.click(screen.getByLabelText('Create folder'));
        fireEvent.change(byId('bookmark-title'), { target: { value: 'Stuff' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        await screen.findByText('Folder created successfully!');
    });

    it('opens, copies, edits and deletes bookmarks', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, { clipboard: { writeText } });
        render(<BookmarkView />);
        const github = await screen.findByLabelText('Bookmark: GitHub');
        fireEvent.click(within(github).getByText('GitHub'));
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith({ url: 'https://github.com' });
        fireEvent.click(within(github).getByLabelText('Open bookmark in new tab'));
        fireEvent.click(within(github).getByLabelText('Copy URL to clipboard'));
        await screen.findByText('URL copied to clipboard!');
        writeText.mockRejectedValueOnce(new Error('no'));
        fireEvent.click(within(github).getByLabelText('Copy URL to clipboard'));
        await screen.findByText('Failed to copy URL');

        fireEvent.click(within(github).getByLabelText('Edit bookmark'));
        expect(byId('bookmark-title')).toHaveValue('GitHub');
        fireEvent.change(byId('bookmark-title'), { target: { value: 'GitHub 2' } });
        fireEvent.change(byId('bookmark-parent'), { target: { value: '11' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await screen.findByText('Bookmark updated successfully!');
        await waitFor(() => expect(received.some(m => m.type === 'MOVE_BOOKMARK')).toBe(true));

        fireEvent.keyDown(github, { key: 'Delete' });
        await screen.findByText('Bookmark deleted successfully!');
        fireEvent.click(within(screen.getByLabelText('Folder: Empty folder')).getByLabelText('Delete folder'));
        await screen.findByText('Folder deleted successfully!');
        expect(received.some(m => m.type === 'DELETE_BOOKMARK_TREE')).toBe(true);
    });

    it('shows loading and error states', async () => {
        useBoardStore.setState({ isLoading: true });
        received.length = 0;
        const { container } = render(<BookmarkView />);
        expect(container.querySelector('.bookmark-loading, .bookmark-tree')).toBeTruthy();
        act(() => useBoardStore.setState({ isLoading: false, error: 'Permission denied' }));
        expect(await screen.findByText(/Permission denied/)).toBeInTheDocument();
    });
});

describe('BookmarkModal', () => {
    const submit = () => fireEvent.submit(document.querySelector('form')!);

    it('validates input and reports submit failures', async () => {
        const onSubmit = vi.fn(() => {
            throw new Error('x');
        });
        const onShowToast = vi.fn();
        const onClose = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<BookmarkModal isOpen mode="create" onClose={onClose} onSubmit={onSubmit} onShowToast={onShowToast} />);
        submit();
        expect(await screen.findByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('URL is required')).toBeInTheDocument();
        fireEvent.change(byId('bookmark-title'), { target: { value: 'T' } });
        fireEvent.change(byId('bookmark-url'), { target: { value: 'mailto:a@b.c' } });
        submit();
        expect(await screen.findByText('URL must start with http://, https://, or file://')).toBeInTheDocument();
        fireEvent.change(byId('bookmark-url'), { target: { value: 'https://ok.dev' } });
        submit();
        expect(onShowToast).toHaveBeenCalledWith('Failed to create bookmark. Please try again.', 'error');
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.mouseDown(document.querySelector('.bookmark-modal-overlay')!);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
