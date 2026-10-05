import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExportMenu from '../components/ExportMenu';
import TaskCard from '../../tasks/components/TaskCard';
import BoardHeader from '../../boards/components/BoardHeader';
import CommandPalette from '../components/CommandPalette';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../store/uiStore';
import { downloadText, slugify } from '../../../utils/download';
import { copyTaskMarkdown, exportCurrentBoard } from '../utils/exportActions';
import { respondToMessages } from '../../../test/chromeMock';
import { makeBoard, makeFolder, makeTab, makeTask } from '../../../test/factories';

/** Capture what downloadText puts in the Blob and the file name it uses */
function captureDownloads() {
    const blobs: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
        blobs.push(blob as Blob);
        return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
    });
    return { blobs, names };
}

const toast = () => useUIStore.getState().toast;

describe('download helpers', () => {
    afterEach(() => vi.restoreAllMocks());

    it('slugify makes safe, non-empty file names', () => {
        expect(slugify('Compare Stripe & Paddle!')).toBe('compare-stripe-paddle');
        expect(slugify('Café déjà vu')).toBe('cafe-deja-vu');
        expect(slugify('***')).toBe('export');
        expect(slugify('a'.repeat(80))).toHaveLength(60);
    });

    it('downloadText saves a Blob with the name and type', async () => {
        const { blobs, names } = captureDownloads();
        downloadText('notes.md', '# Hi', 'text/markdown');
        expect(names).toEqual(['notes.md']);
        expect(blobs[0].type).toBe('text/markdown');
        expect(await blobs[0].text()).toBe('# Hi');
        expect(document.querySelector('a[download]')).toBeNull(); // cleaned up
    });
});

describe('ExportMenu', () => {
    it('opens, runs an item and closes; Esc and outside clicks close it', () => {
        const onSelect = vi.fn();
        render(
            <>
                <ExportMenu label="Export thing" items={[{ label: 'Copy', onSelect }]}>
                    ⤓
                </ExportMenu>
                <p>outside</p>
            </>
        );
        const button = screen.getByRole('button', { name: 'Export thing' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
        expect(onSelect).toHaveBeenCalled();
        expect(screen.queryByRole('menu')).toBeNull();

        fireEvent.click(button);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
        expect(button).toHaveFocus();

        fireEvent.click(button);
        fireEvent.mouseDown(screen.getByText('outside'));
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('opens on hover and closes shortly after the pointer leaves, unless it comes back', () => {
        vi.useFakeTimers();
        const { container } = render(
            <ExportMenu label="Export thing" items={[{ label: 'Copy', onSelect: vi.fn() }]}>
                ⤓
            </ExportMenu>
        );
        const root = container.querySelector('.export-menu') as HTMLElement;
        const button = screen.getByRole('button', { name: 'Export thing' });

        fireEvent.mouseEnter(root);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        // A click after hovering keeps it open rather than toggling it shut; the next click closes it
        fireEvent.click(button);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.click(button);
        expect(screen.queryByRole('menu')).toBeNull();

        fireEvent.mouseEnter(root);
        fireEvent.mouseLeave(root);
        act(() => vi.advanceTimersByTime(100));
        fireEvent.mouseEnter(root); // back in time (e.g. crossing the gap into the menu)
        act(() => vi.advanceTimersByTime(500));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.mouseLeave(root);
        act(() => vi.advanceTimersByTime(200));
        expect(screen.queryByRole('menu')).toBeNull();
        vi.useRealTimers();
    });
});

describe('export actions', () => {
    beforeEach(() => {
        respondToMessages();
        useUIStore.setState({ toast: null });
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], sessions: [] });
    });
    afterEach(() => vi.restoreAllMocks());

    it('copies a task as Markdown from its card, or reports a clipboard error', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        const task = makeTask({ title: 'Ship it' });
        useBoardStore.setState({ tasks: [task] });
        render(<TaskCard task={task} />);
        fireEvent.click(screen.getByRole('button', { name: 'Export task' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Copy as Markdown' }));
        await waitFor(() => expect(toast()?.message).toBe('Copied “Ship it” as Markdown'));
        expect(writeText.mock.calls[0][0]).toMatch(/^# Ship it\n/);

        writeText.mockRejectedValueOnce(new Error('Document is not focused'));
        await copyTaskMarkdown(task, []);
        expect(toast()).toMatchObject({ type: 'error', message: "Couldn't copy: Document is not focused" });
    });

    it('downloads a task and a board', async () => {
        const { names, blobs } = captureDownloads();
        const task = makeTask({ title: 'Ship it' });
        useBoardStore.setState({ tasks: [task] });
        render(<TaskCard task={task} />);
        fireEvent.click(screen.getByRole('button', { name: 'Export task' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download .md' }));
        expect(names[0]).toBe('ship-it.md');

        const board = makeBoard({ id: 'b1', name: 'Work Board' });
        const folders = [makeFolder({ id: 'f1', boardId: 'b1', name: 'Docs' })];
        const tabs = [makeTab({ folderId: 'f1', title: 'Spec', url: 'https://s.dev' })];
        render(
            <MemoryRouter>
                <BoardHeader
                    boardName="Work Board"
                    board={board}
                    folders={folders}
                    tabs={tabs}
                    searchQuery=""
                    onSearch={vi.fn()}
                    onCreateFolder={vi.fn()}
                    onCreateTab={vi.fn()}
                    onShowHistory={vi.fn()}
                    isHistoryOpen={false}
                    viewMode="list"
                    onViewModeChange={vi.fn()}
                />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Export board' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Download .csv' }));
        expect(names[1]).toMatch(/^work-board-\d{4}-\d{2}-\d{2}\.csv$/);
        expect(await blobs[1].text()).toContain('Docs,Spec,https://s.dev');
    });

    it('the command palette exports the board, or says there is none', async () => {
        const { names } = captureDownloads();
        exportCurrentBoard('md');
        expect(toast()).toMatchObject({ type: 'error', message: 'No board to export yet' });

        useBoardStore.setState({ boards: [makeBoard({ name: 'Home' })] });
        render(<CommandPalette isOpen onClose={vi.fn()} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByText('Export board as Markdown'));
        expect(names[0]).toMatch(/^home-.*\.md$/);
        exportCurrentBoard('csv');
        expect(names[1]).toMatch(/^home-.*\.csv$/);
    });
});
