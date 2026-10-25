/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BoardView from '../BoardView';
import BoardModal from '../components/BoardModal';
import FolderDeleteModal from '../components/FolderDeleteModal';
import { useBoardStore } from '../../../store/boardStore';
import { respondToMessages } from '../../../test/chromeMock';
import { makeBoard, makeFolder, makeTab } from '../../../test/factories';

let dnd: { onDragStart: (e: any) => void; onDragEnd: (e: any) => void };
vi.mock('@dnd-kit/core', async importOriginal => {
    const actual = await importOriginal<typeof import('@dnd-kit/core')>();
    return {
        ...actual,
        DndContext: (props: any) => {
            dnd = props;
            return <actual.DndContext {...props} />;
        },
        // The real overlay renders children only while dnd-kit tracks an active drag, which the captured props never start
        DragOverlay: ({ children }: { children?: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
    };
});

const state = () => useBoardStore.getState();
const byId = (id: string) => document.getElementById(id) as HTMLElement;
const drag = (active: { id: string; data?: unknown }, over: { id: string } | null) =>
    act(() => {
        dnd.onDragStart({ active: { id: active.id, data: { current: active.data } } });
        dnd.onDragEnd({ active: { id: active.id, data: { current: active.data } }, over });
    });

describe('board drag and drop', () => {
    beforeEach(() => {
        useBoardStore.setState({
            boards: [makeBoard({ id: 'b1' })],
            folders: [
                makeFolder({ id: 'f1', name: 'A', boardId: 'b1' }),
                makeFolder({ id: 'f2', name: 'B', boardId: 'b1' }),
            ],
            tabs: [
                makeTab({ id: 't1', title: 'One', folderId: 'f1', order: 0 }),
                makeTab({ id: 't2', title: 'Two', folderId: 'f1', order: 1 }),
                makeTab({ id: 't3', title: 'Three', folderId: 'f2', order: 0 }),
            ],
            sessions: [],
            history: [],
        });
        respondToMessages(m =>
            m.type === 'GET_HISTORY'
                ? [
                      {
                          id: 'h1',
                          url: 'https://hist.dev',
                          title: 'Hist entry',
                          visitCount: 3,
                          lastVisitTime: '2026-10-01T00:00:00Z',
                          favicon: 'h.png',
                      },
                  ]
                : undefined
        );
        vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    });

    it('reorders tabs within a folder and moves them between folders', () => {
        render(<BoardView />);
        drag({ id: 't2' }, { id: 't1' });
        expect(
            state()
                .tabs.filter(t => t.folderId === 'f1')
                .map(t => t.id)
        ).toEqual(['t2', 't1']);
        drag({ id: 't1' }, { id: 't3' });
        expect(state().tabs.find(t => t.id === 't1')!.folderId).toBe('f2');
        drag({ id: 't3' }, { id: 'f1' });
        expect(state().tabs.find(t => t.id === 't3')!.folderId).toBe('f1');
        drag({ id: 't3' }, { id: 't3' }); // dropped on itself
        drag({ id: 't3' }, null); // dropped outside
        drag({ id: 'missing' }, { id: 'f1' });
        expect(state().tabs).toHaveLength(3);
    });

    it('adds a dragged history item to the folder it is dropped on', () => {
        render(<BoardView />);
        const data = { type: 'HistoryItem', item: { id: 'h9', url: 'https://h.dev', title: 'H' } };
        drag({ id: 'history_h9', data }, { id: 'f2' });
        expect(state().tabs.find(t => t.title === 'H')!.folderId).toBe('f2');
        drag({ id: 'history_h9', data }, { id: 't1' });
        expect(
            state()
                .tabs.filter(t => t.title === 'H')
                .map(t => t.folderId)
        ).toEqual(['f2', 'f1']);
        drag({ id: 'history_h9', data }, { id: 'nowhere' });
        expect(state().tabs.filter(t => t.title === 'H')).toHaveLength(2);
    });

    it('adds history items to folders from the side panel', async () => {
        render(<BoardView />);
        fireEvent.click(screen.getByLabelText('Open history'));
        const entry = (await screen.findByText('Hist entry')).closest('.history-item') as HTMLElement;
        expect(within(entry).getByText('Visits: 3')).toBeInTheDocument();
        const add = within(entry).getByRole('button', { name: 'Add to Folder' });
        expect(add).toBeDisabled();
        fireEvent.change(within(entry).getByRole('combobox'), { target: { value: 'f2' } });
        fireEvent.click(add);
        expect(state().tabs.find(t => t.title === 'Hist entry')!.folderId).toBe('f2');
        fireEvent.click(within(entry).getByRole('button', { name: 'Modify' }));
        expect(window.alert).toHaveBeenCalled();
        fireEvent.click(screen.getByText('Load Recent'));
        fireEvent.click(screen.getByText('✕'));
        await waitFor(() => expect(document.querySelector('.history-side-panel')).not.toHaveClass('open'));
    });
});

describe('board drag edge cases', () => {
    const tabsSnapshot = () =>
        useBoardStore.getState().tabs.map(t => ({ id: t.id, folderId: t.folderId, order: t.order }));

    beforeEach(() => {
        useBoardStore.setState({
            boards: [makeBoard({ id: 'b1' })],
            folders: [makeFolder({ id: 'f1', name: 'A', boardId: 'b1' })],
            tabs: [
                makeTab({ id: 't1', title: 'One', url: 'https://one.dev', folderId: 'f1', order: 0 }),
                makeTab({ id: 't2', title: 'Loose A', url: 'https://a.dev', folderId: '', order: 0 }),
                makeTab({ id: 't3', title: 'Loose B', url: 'https://b.dev', folderId: '', order: 1 }),
            ],
            sessions: [],
            history: [],
        });
        respondToMessages(() => undefined);
    });

    it('does not reorder two unfiled tabs dropped on each other', () => {
        render(<BoardView />);
        const before = tabsSnapshot();

        drag({ id: 't2' }, { id: 't3' });

        expect(tabsSnapshot()).toEqual(before);
    });

    it('moves a filed tab dropped on an unfiled tab to the top level', () => {
        render(<BoardView />);

        drag({ id: 't1' }, { id: 't2' });

        expect(state().tabs.find(t => t.id === 't1')!.folderId).toBe('');
        expect(screen.getByText('Tab moved to folder!')).toBeInTheDocument();
    });

    it('ignores a drop on something that is neither a tab nor a folder', () => {
        render(<BoardView />);
        const before = tabsSnapshot();

        drag({ id: 't1' }, { id: 'nowhere' });

        expect(tabsSnapshot()).toEqual(before);
        expect(screen.queryByText('Tab moved to folder!')).not.toBeInTheDocument();
    });

    it('shows the dragged tab in the overlay until the drag ends', () => {
        render(<BoardView />);
        const overlay = screen.getByTestId('drag-overlay');
        expect(overlay).toBeEmptyDOMElement();

        act(() => dnd.onDragStart({ active: { id: 't1', data: { current: undefined } } }));
        expect(within(overlay).getByText('One')).toBeInTheDocument();
        expect(within(overlay).getByText('https://one.dev')).toBeInTheDocument();

        act(() => dnd.onDragEnd({ active: { id: 't1', data: { current: undefined } }, over: null }));
        expect(overlay).toBeEmptyDOMElement();
    });

    it.each([
        ['with its favicon', 'h.png'],
        ['with the default icon when it has no favicon', undefined],
    ])('shows a dragged history item %s in the overlay', (_name, favicon) => {
        render(<BoardView />);
        const overlay = screen.getByTestId('drag-overlay');
        const item = { id: 'h9', url: 'https://h.dev', title: 'Hist item', favicon };
        const data = { current: { type: 'HistoryItem', item } };

        act(() => dnd.onDragStart({ active: { id: 'history_h9', data } }));
        expect(within(overlay).getByText('Hist item')).toBeInTheDocument();
        const img = overlay.querySelector('img');
        if (favicon) {
            expect(img).toHaveAttribute('src', favicon);
        } else {
            expect(img).toBeNull();
            expect(within(overlay).getByText('🌐')).toBeInTheDocument();
        }

        act(() => dnd.onDragEnd({ active: { id: 'history_h9', data }, over: null }));
        expect(overlay).toBeEmptyDOMElement();
    });
});

describe('BoardModal validation', () => {
    const setup = (props: Partial<React.ComponentProps<typeof BoardModal>> = {}) => {
        const onSubmit = vi.fn();
        const onClose = vi.fn();
        const onShowToast = vi.fn();
        const utils = render(
            <BoardModal
                isOpen
                mode="create"
                type="tab"
                onSubmit={onSubmit}
                onClose={onClose}
                onShowToast={onShowToast}
                {...props}
            />
        );
        return { onSubmit, onClose, onShowToast, ...utils };
    };
    const submit = () => fireEvent.submit(document.querySelector('form')!);

    it('validates tab fields', async () => {
        const { onSubmit } = setup();
        submit();
        expect(await screen.findByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('URL is required')).toBeInTheDocument();
        fireEvent.change(byId('board-tab-title'), { target: { value: 'x'.repeat(201) } });
        fireEvent.change(byId('board-tab-url'), { target: { value: 'javascript:alert(1)' } });
        submit();
        expect(await screen.findByText('Title must be 200 characters or less')).toBeInTheDocument();
        expect(screen.getByText('URL must start with http://, https://, or file://')).toBeInTheDocument();
        fireEvent.change(byId('board-tab-title'), { target: { value: 'ok' } });
        fireEvent.change(byId('board-tab-url'), { target: { value: '[' } });
        submit();
        expect(await screen.findByText('Please enter a valid URL')).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.change(byId('board-tab-url'), { target: { value: 'file:///tmp/a.pdf' } });
        submit();
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'ok', url: 'file:///tmp/a.pdf', folderId: '' })
        );
    });

    it('validates folder names and reports submit errors', async () => {
        const onSubmit = vi.fn(() => {
            throw new Error('fail');
        });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { onShowToast } = setup({ type: 'folder', onSubmit });
        submit();
        expect(await screen.findByText('Name is required')).toBeInTheDocument();
        fireEvent.change(byId('board-folder-name'), { target: { value: 'x'.repeat(101) } });
        submit();
        expect(await screen.findByText('Name must be 100 characters or less')).toBeInTheDocument();
        fireEvent.change(byId('board-folder-name'), { target: { value: 'Valid' } });
        submit();
        expect(onShowToast).toHaveBeenCalledWith('Failed to create folder. Please try again.', 'error');
    });

    it('prefills edit mode and closes with Escape, overlay click or Cancel', () => {
        const folder = makeFolder({ name: 'Existing', color: '#123456' });
        const { onClose, rerender, onSubmit, onShowToast } = setup({ mode: 'edit', type: 'folder', folder });
        expect(byId('board-folder-name')).toHaveValue('Existing');
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.mouseDown(document.querySelector('.board-modal-overlay')!);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        fireEvent.click(screen.getByLabelText('Close modal'));
        expect(onClose).toHaveBeenCalledTimes(4);
        submit();
        expect(onShowToast).toHaveBeenCalledWith('Folder updated successfully!', 'success');

        const tab = makeTab({ title: 'Tab', url: 'https://t.dev', folderId: 'f1' });
        rerender(
            <BoardModal
                isOpen
                mode="edit"
                type="tab"
                tab={tab}
                folders={[makeFolder({ id: 'f1' })]}
                onSubmit={onSubmit}
                onClose={onClose}
            />
        );
        expect(byId('board-tab-title')).toHaveValue('Tab');
        expect(byId('board-tab-folder')).toHaveValue('f1');
        rerender(<BoardModal isOpen={false} mode="edit" type="tab" onSubmit={onSubmit} onClose={onClose} />);
        expect(document.querySelector('.board-modal-overlay')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });
});

describe('BoardModal fallbacks and focus', () => {
    const setup = (props: Partial<React.ComponentProps<typeof BoardModal>> = {}) => {
        const onSubmit = vi.fn();
        const onClose = vi.fn();
        const onShowToast = vi.fn();
        const utils = render(
            <BoardModal
                isOpen
                mode="edit"
                type="tab"
                onSubmit={onSubmit}
                onClose={onClose}
                onShowToast={onShowToast}
                {...props}
            />
        );
        return { onSubmit, onClose, onShowToast, ...utils };
    };

    afterEach(() => vi.useRealTimers());

    it('falls back to an empty name and the default colour for a folder without them', () => {
        setup({ type: 'folder', folder: makeFolder({ name: '', color: undefined }) });

        expect(byId('board-folder-name')).toHaveValue('');
        expect(byId('board-folder-color')).toHaveValue('#3b82f6');
    });

    it('falls back to empty inputs for a tab without title or url', () => {
        setup({ tab: makeTab({ title: '', url: '' }) });

        expect(byId('board-tab-title')).toHaveValue('');
        expect(byId('board-tab-url')).toHaveValue('');
    });

    it('keeps the empty create values when editing a tab but none is given', () => {
        setup({ tab: undefined });

        expect(byId('board-tab-title')).toHaveValue('');
        expect(byId('board-tab-url')).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('focuses the name input of a folder and the title input of a tab', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { unmount } = setup({ type: 'folder', folder: makeFolder({ name: 'Work' }) });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(document.activeElement).toBe(byId('board-folder-name'));
        unmount();

        setup({ tab: makeTab({ title: 'Docs' }) });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(document.activeElement).toBe(byId('board-tab-title'));
    });

    it('does not close on a mousedown inside the dialog body', () => {
        const { onClose } = setup({ tab: makeTab() });

        fireEvent.mouseDown(document.querySelector('.board-modal-content')!);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('reports a failed tab update', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onSubmit = vi.fn(() => {
            throw new Error('fail');
        });
        const { onShowToast } = setup({ tab: makeTab(), onSubmit });

        fireEvent.submit(document.querySelector('form')!);

        expect(onShowToast).toHaveBeenCalledWith('Failed to update tab. Please try again.', 'error');
    });
});

describe('FolderDeleteModal', () => {
    it('deletes everything when chosen, and handles no other folders', () => {
        const onForceDelete = vi.fn();
        const onMoveAndDelete = vi.fn();
        const onClose = vi.fn();
        const folder = makeFolder({ id: 'f1', name: 'Doomed' });
        const { rerender } = render(
            <FolderDeleteModal
                isOpen
                folder={folder}
                availableFolders={[]}
                folderTabCount={2}
                onClose={onClose}
                onMoveAndDelete={onMoveAndDelete}
                onForceDelete={onForceDelete}
            />
        );
        fireEvent.click(screen.getByText('Delete folder and all tabs'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete Everything' }));
        expect(onForceDelete).toHaveBeenCalled();
        fireEvent.click(document.querySelector('.board-modal-overlay')!);
        expect(onClose).toHaveBeenCalled();
        rerender(
            <FolderDeleteModal
                isOpen={false}
                folder={folder}
                availableFolders={[]}
                folderTabCount={2}
                onClose={onClose}
                onMoveAndDelete={onMoveAndDelete}
                onForceDelete={onForceDelete}
            />
        );
        expect(screen.queryByText('Delete Folder')).toBeNull();
    });

    it('moves the tabs to another folder before deleting', () => {
        const onForceDelete = vi.fn();
        const onMoveAndDelete = vi.fn();
        const onClose = vi.fn();
        render(
            <FolderDeleteModal
                isOpen
                folder={makeFolder({ id: 'f1', name: 'Doomed' })}
                availableFolders={[makeFolder({ id: 'f2', name: 'Keep' })]}
                folderTabCount={3}
                onClose={onClose}
                onMoveAndDelete={onMoveAndDelete}
                onForceDelete={onForceDelete}
            />
        );
        const submit = screen.getByRole('button', { name: 'Move & Delete Folder' });
        expect(submit).toBeDisabled(); // no target folder yet

        // Switching to "delete everything" and back via the option cards and radios
        fireEvent.click(screen.getByText('Delete folder and all tabs'));
        expect(screen.getByText('This will permanently delete all 3 tabs')).toBeInTheDocument();
        fireEvent.click(document.querySelector('input[value="move"]')!);
        fireEvent.click(document.querySelector('.delete-option-card')!);

        // Picking a folder doesn't toggle the option card
        const select = screen.getByRole('combobox');
        fireEvent.click(select);
        fireEvent.change(select, { target: { value: 'f2' } });
        expect(submit).toBeEnabled();
        fireEvent.click(submit);
        expect(onMoveAndDelete).toHaveBeenCalledWith('f2');
        expect(onForceDelete).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
