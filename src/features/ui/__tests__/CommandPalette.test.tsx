import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommandPalette from '../components/CommandPalette';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../store/uiStore';
import { useOrganizeStore } from '../../organize/store/organizeStore';
import { useTaskDraftStore } from '../../taskDraft/store/taskDraftStore';
import { respondToMessages } from '../../../test/chromeMock';
import { makeBoard, makeContext, makeTask } from '../../../test/factories';

describe('CommandPalette', () => {
    let received: { type: string }[];
    beforeEach(() => {
        useBoardStore.setState({
            boards: [makeBoard()],
            folders: [],
            tasks: [
                makeTask({ id: 'act', title: 'Active', context: makeContext({ state: 'active' }) }),
                makeTask({ id: 'park', title: 'Parked', context: makeContext() }),
            ],
            notes: [],
            tabs: [],
        });
        useUIStore.setState({ parkDialogTaskId: null });
        received = respondToMessages(m => (m.type.startsWith('TASK_CONTEXT') ? { success: true } : undefined));
    });

    it('runs every command', async () => {
        const onNavigate = vi.fn();
        const onClose = vi.fn();
        const exportData = vi.fn();
        const importData = vi.fn();
        window.addEventListener('exportData', exportData);
        window.addEventListener('importData', importData);
        render(<CommandPalette isOpen onClose={onClose} onNavigate={onNavigate} />);
        const items = [...document.querySelectorAll('.command-item')];
        expect(items.length).toBeGreaterThan(25);
        items.forEach(item => fireEvent.click(item));
        expect(onNavigate).toHaveBeenCalledWith('today');
        expect(onNavigate).toHaveBeenCalledWith('canvas');
        expect(useBoardStore.getState().tasks).toHaveLength(3);
        expect(useBoardStore.getState().notes).toHaveLength(1);
        expect(useBoardStore.getState().folders).toHaveLength(1);
        expect(exportData).toHaveBeenCalled();
        expect(importData).toHaveBeenCalled();
        expect(useUIStore.getState().parkDialogTaskId).toBe('act');
        await waitFor(() =>
            expect(received.map(m => m.type)).toEqual(
                expect.arrayContaining(['TASK_CONTEXT_ADD_TABS', 'TASK_CONTEXT_RESUME'])
            )
        );
        expect(onClose).toHaveBeenCalled();
    });

    it('starts "Organize open tabs"', () => {
        const start = vi
            .spyOn(useOrganizeStore.getState().actions, 'startOrganize')
            .mockImplementation(() => undefined);
        render(<CommandPalette isOpen onClose={vi.fn()} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByText('Organize open tabs'));
        expect(start).toHaveBeenCalled();
    });

    it('opens "New task from open tabs" right after "Create New Task"', () => {
        const open = vi.spyOn(useTaskDraftStore.getState().actions, 'open').mockImplementation(() => undefined);
        render(<CommandPalette isOpen onClose={vi.fn()} onNavigate={vi.fn()} />);
        const names = [...document.querySelectorAll('.command-name')].map(e => e.textContent);
        expect(names[names.indexOf('Create New Task') + 1]).toBe('New task from open tabs');
        fireEvent.click(screen.getByText('New task from open tabs'));
        expect(open).toHaveBeenCalledWith(undefined);
        open.mockRestore();
    });

    it('filters, navigates with the keyboard and closes', () => {
        const onNavigate = vi.fn();
        const onClose = vi.fn();
        render(<CommandPalette isOpen onClose={onClose} onNavigate={onNavigate} />);
        const input = screen.getByPlaceholderText('Type a command or search...');
        fireEvent.change(input, { target: { value: 'go to' } });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onNavigate).toHaveBeenCalledWith('settings');
        fireEvent.change(input, { target: { value: 'navigation' } });
        expect(screen.getByText('Go to Boards')).toBeInTheDocument();
        fireEvent.change(input, { target: { value: 'zzzz' } });
        expect(screen.getByText('No commands found')).toBeInTheDocument();
        fireEvent.keyDown(input, { key: 'Enter' });
        onClose.mockClear();
        fireEvent.keyDown(input, { key: 'Escape' });
        fireEvent.click(document.querySelector('.command-palette-overlay')!);
        expect(onClose).toHaveBeenCalledTimes(2);
        fireEvent.mouseEnter(document.querySelector('.command-palette') ?? document.body);
    });

    it('creates a folder without a board and renders nothing when closed', () => {
        useBoardStore.setState({ boards: [], tasks: [] });
        const { rerender } = render(<CommandPalette isOpen onClose={vi.fn()} onNavigate={vi.fn()} />);
        fireEvent.click(screen.getByText('Create New Folder'));
        expect(screen.queryByText(/^Park "/)).toBeNull();
        rerender(<CommandPalette isOpen={false} onClose={vi.fn()} onNavigate={vi.fn()} />);
        expect(document.querySelector('.command-palette-overlay')).toBeNull();
    });
});
