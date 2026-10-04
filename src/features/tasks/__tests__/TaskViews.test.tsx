import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TasksView from '../TasksView';
import TaskCard from '../components/TaskCard';
import TaskContextStrip from '../components/TaskContextStrip';
import ParkDialog from '../components/ParkDialog';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { useTaskDraftStore } from '../../taskDraft/store/taskDraftStore';
import { ChromeMock, installChromeMock, respondToMessages } from '../../../test/chromeMock';
import { makeContext, makeTab, makeTask } from '../../../test/factories';
import { Task } from '../../../types';
import { CONTEXT_MESSAGES, PARK_RESUME_SETTINGS_KEY } from '../../../utils/taskContext';

const state = () => useBoardStore.getState();
const task = (id = 'task_1') => state().tasks.find(t => t.id === id)!;
let received: { type: string; payload: Record<string, unknown> }[];
let mock: ChromeMock;

beforeEach(() => {
    mock = installChromeMock();
    useBoardStore.setState({ tasks: [], tabs: [] });
    useUIStore.setState({ toast: null, parkDialogTaskId: null });
    received = respondToMessages(m =>
        m.type.startsWith('TASK_CONTEXT') ? { success: true, task: m.payload.task } : undefined
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => vi.useRealTimers());

describe('TaskCard', () => {
    const renderCard = (t: Task) => {
        useBoardStore.setState({ tasks: [t] });
        const utils = render(<TaskCard task={t} />);
        const rerenderLatest = () => utils.rerender(<TaskCard task={task(t.id)} />);
        return { ...utils, rerenderLatest };
    };

    it('edits title, description, due date, priority and checklist', () => {
        const { rerenderLatest } = renderCard(
            makeTask({ description: 'Desc', checklist: [{ id: 'c1', text: 'First', completed: false }] })
        );
        fireEvent.click(screen.getByTitle('Edit task'));
        fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'New title' } });
        fireEvent.change(screen.getByPlaceholderText('Description'), { target: { value: 'New desc' } });
        fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2026-10-10' } });
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'high' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByPlaceholderText('Add item...'), { target: { value: 'Second' } });
        fireEvent.keyDown(screen.getByPlaceholderText('Add item...'), { key: 'Enter' });
        fireEvent.click(screen.getByText('Add item')); // empty: ignored
        fireEvent.change(screen.getByPlaceholderText('Add item...'), { target: { value: 'Third' } });
        fireEvent.click(screen.getByText('Add item'));
        fireEvent.click(screen.getByRole('button', { name: 'Remove Third' }));
        fireEvent.click(screen.getByText('Save'));
        expect(task()).toMatchObject({
            title: 'New title',
            description: 'New desc',
            dueDate: '2026-10-10',
            priority: 'high',
        });
        expect(task().checklist!.map(i => [i.text, i.completed])).toEqual([
            ['First', true],
            ['Second', false],
        ]);
        rerenderLatest();
        expect(screen.getByText('Due: ' + new Date('2026-10-10').toLocaleDateString())).toBeInTheDocument();
    });

    it('cancels edits and keeps view-mode checklist toggles (stale state bug)', () => {
        const { rerenderLatest } = renderCard(makeTask({ checklist: [{ id: 'c1', text: 'Item', completed: false }] }));
        fireEvent.click(screen.getByText('Item'));
        expect(task().checklist![0].completed).toBe(true);
        rerenderLatest();
        fireEvent.click(screen.getByTitle('Edit task'));
        fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'discard me' } });
        fireEvent.click(screen.getByText('Cancel'));
        expect(task().title).toBe('Write pricing page');
        fireEvent.click(screen.getByTitle('Edit task'));
        fireEvent.click(screen.getByText('Save'));
        expect(task().checklist![0].completed).toBe(true);
    });

    it('changes status, animating completion, and parks an active task when done', async () => {
        vi.useFakeTimers();
        renderCard(makeTask({ context: makeContext({ state: 'active' }) }));
        fireEvent.click(screen.getByTitle('Doing'));
        expect(task().status).toBe('doing');
        fireEvent.click(screen.getByTitle('Done'));
        expect(received.some(m => m.type === CONTEXT_MESSAGES.PARK)).toBe(true);
        expect(document.querySelector('.animate-card-jump')).not.toBeNull();
        act(() => vi.advanceTimersByTime(500));
        expect(document.querySelector('.animate-success-pop')).not.toBeNull();
        act(() => vi.advanceTimersByTime(500));
        expect(task().status).toBe('done');
        fireEvent.click(screen.getByTitle('To Do'));
        expect(task().status).toBe('todo');
    });

    it('shows linked tabs and deletes after confirmation', () => {
        useBoardStore.setState({ tabs: [makeTab({ id: 'l1', title: 'Linked tab' })] });
        renderCard(makeTask({ tabIds: ['l1', 'missing'], priority: 'low' }));
        expect(screen.getByText(/Linked tab/)).toBeInTheDocument();
        vi.mocked(window.confirm).mockReturnValueOnce(false);
        fireEvent.click(screen.getByTitle('Delete task'));
        expect(state().tasks).toHaveLength(1);
        fireEvent.click(screen.getByTitle('Delete task'));
        expect(state().tasks).toHaveLength(0);
    });
});

describe('TaskContextStrip', () => {
    it('shows nothing for a finished task without tabs', () => {
        const { container } = render(<TaskContextStrip task={makeTask({ status: 'done' })} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('offers Start and Add for an idle task', async () => {
        render(<TaskContextStrip task={makeTask()} />);
        expect(screen.queryByTitle('Show tabs')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '▶ Start' }));
        await waitFor(() => expect(received[0].type).toBe(CONTEXT_MESSAGES.START));
        fireEvent.click(screen.getByRole('button', { name: '+ Add current tabs' }));
        await waitFor(() => expect(received[1].type).toBe(CONTEXT_MESSAGES.ADD_TABS));
    });

    it('lists, removes and resumes parked tabs, with the note and summary', async () => {
        const t = makeTask({
            context: makeContext({
                resumeNote: 'left at VAT',
                aiSummary: 'You were comparing fees.',
                tabs: [
                    { url: 'https://a.example/', title: 'A', favicon: 'a.png' },
                    { url: 'https://b.example/', title: 'B' },
                ],
            }),
        });
        render(<TaskContextStrip task={t} />);
        expect(screen.getByText('“left at VAT”')).toBeInTheDocument();
        expect(screen.getByText(/You were comparing fees/)).toBeInTheDocument();
        expect(screen.getByText(/2 tabs · Parked/)).toBeInTheDocument();
        fireEvent.error(document.querySelector('img.context-favicon')!);
        fireEvent.click(screen.getByTitle('Show tabs'));
        fireEvent.click(screen.getByLabelText('Remove A from this task'));
        await waitFor(() =>
            expect(received[0]).toMatchObject({
                type: CONTEXT_MESSAGES.REMOVE_TAB,
                payload: { url: 'https://a.example/' },
            })
        );
        fireEvent.click(screen.getByRole('button', { name: '▶ Resume' }));
        await waitFor(() => expect(received[1].type).toBe(CONTEXT_MESSAGES.RESUME));
        fireEvent.click(screen.getByTitle('Hide tabs'));
    });

    it('shows a long, chatty summary saved by v1.0 as two plain sentences', () => {
        const aiSummary =
            "Okay, I understand the task. You were fixing **checkout** requests. Then `tests`. Here's a breakdown:\n" +
            '1. More detail';
        render(<TaskContextStrip task={makeTask({ context: makeContext({ aiSummary }) })} />);
        expect(document.querySelector('.task-context-summary-ai')).toHaveTextContent(
            '✨ You were fixing checkout requests. Then tests.'
        );
    });

    it('offers Park for an active task and hides edit controls when compact', () => {
        const t = makeTask({ context: makeContext({ state: 'active' }) });
        render(<TaskContextStrip task={t} compact />);
        expect(screen.getByText(/Active now/)).toBeInTheDocument();
        expect(screen.queryByText('+ Add current tabs')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '⏸ Park' }));
        expect(useUIStore.getState().parkDialogTaskId).toBe('task_1');
        fireEvent.click(screen.getByTitle('Show tabs'));
        expect(screen.queryByLabelText(/Remove/)).toBeNull();
    });

    it('labels tasks with tabs that were never started, and finished tasks read-only', () => {
        const { rerender } = render(<TaskContextStrip task={makeTask({ context: makeContext({ state: 'idle' }) })} />);
        expect(screen.getByText(/Not started/)).toBeInTheDocument();
        rerender(<TaskContextStrip task={makeTask({ status: 'done', context: makeContext() })} />);
        expect(screen.queryByRole('button', { name: /Resume/ })).toBeNull();
    });
});

describe('ParkDialog', () => {
    const open = (t: Task) => {
        useBoardStore.setState({ tasks: [t] });
        render(<ParkDialog />);
        act(() => useUIStore.getState().actions.openParkDialog(t.id));
    };

    it('parks with a note, keeping unchecked tabs open', async () => {
        const a = mock.browser.addTab({ url: 'https://a.example/', title: 'A' });
        const b = mock.browser.addTab({ url: 'https://b.example/', title: 'B' });
        mock.browser.addTab({ url: 'https://a.example/', title: 'A dup' });
        const group = mock.browser.addGroup({ tabIds: [a.id, b.id] });
        open(makeTask({ context: makeContext({ state: 'active', chromeGroupId: group.id }) }));
        const note = await screen.findByLabelText('Where did you leave off?');
        await screen.findByText('Tabs to save (2)');
        fireEvent.change(note, { target: { value: 'Stopped at VAT' } });
        expect(screen.getByText('14/280')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
        expect(screen.getByText('Unchecked tabs stay open and leave this task.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'B' }));
        fireEvent.click(screen.getByLabelText('Close tabs after parking'));
        fireEvent.keyDown(note, { key: 'Enter' });
        await waitFor(() => expect(received[0]).toMatchObject({ type: CONTEXT_MESSAGES.PARK }));
        expect(received[0].payload).toMatchObject({
            note: 'Stopped at VAT',
            closeTabs: false,
            keepOpenUrls: ['https://b.example/'],
        });
        await waitFor(() => expect(useUIStore.getState().parkDialogTaskId).toBeNull());
        expect((await chrome.storage.local.get(PARK_RESUME_SETTINGS_KEY))[PARK_RESUME_SETTINGS_KEY]).toMatchObject({
            closeTabsOnPark: false,
        });
    });

    it('uses saved tabs without a live group, and parks without a note', async () => {
        open(makeTask({ context: makeContext({ state: 'active', chromeGroupId: null }) }));
        await screen.findByText('Tabs to save (2)');
        fireEvent.keyDown(screen.getByLabelText('Where did you leave off?'), { key: 'Enter', shiftKey: true });
        fireEvent.click(screen.getByText('Park without note'));
        await waitFor(() => expect(received[0].payload).toMatchObject({ note: '' }));
    });

    it('creates an on-device summarizer when enabled and available', async () => {
        const create = vi.fn().mockResolvedValue({ summarize: vi.fn().mockResolvedValue('Sum') });
        vi.stubGlobal('Summarizer', { availability: vi.fn().mockResolvedValue('available'), create });
        await chrome.storage.local.set({ [PARK_RESUME_SETTINGS_KEY]: { aiSummaries: true } });
        open(makeTask({ context: makeContext({ state: 'active' }) }));
        expect(await screen.findByText(/A short summary will be written on your device/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Park' }));
        await waitFor(() => expect(create).toHaveBeenCalled());
        vi.unstubAllGlobals();
    });

    it('handles a failing group query and closes with Escape, Cancel or the overlay', async () => {
        vi.spyOn(chrome.tabs, 'query').mockRejectedValueOnce(new Error('x'));
        open(makeTask({ context: makeContext({ state: 'active', chromeGroupId: 7 }) }));
        await screen.findByText('Tabs to save (2)');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(useUIStore.getState().parkDialogTaskId).toBeNull();
        act(() => useUIStore.getState().actions.openParkDialog('task_1'));
        fireEvent.click(await screen.findByText('Cancel'));
        act(() => useUIStore.getState().actions.openParkDialog('task_1'));
        fireEvent.click(document.querySelector('.park-dialog-overlay')!);
        expect(useUIStore.getState().parkDialogTaskId).toBeNull();
        act(() => useUIStore.getState().actions.openParkDialog('missing'));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

describe('TasksView', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-03T12:00:00'));
        useBoardStore.setState({
            tasks: [
                makeTask({ id: 'a', title: 'Due today', dueDate: '2026-10-03', priority: 'high' }),
                makeTask({ id: 'b', title: 'Overdue', dueDate: '2026-09-01', status: 'doing' }),
                makeTask({ id: 'c', title: 'Later', dueDate: '2026-11-01', priority: 'low' }),
                makeTask({ id: 'd', title: 'No date' }),
                makeTask({ id: 'e', title: 'Done today', status: 'done', completedAt: '2026-10-03T09:00:00' }),
                makeTask({ id: 'f', title: 'Done long ago', status: 'done', completedAt: '2026-09-01T09:00:00' }),
            ],
        });
    });

    const renderView = () =>
        render(
            <MemoryRouter>
                <TasksView />
            </MemoryRouter>
        );
    const visible = () => [...document.querySelectorAll('.task-title')].map(e => e.textContent);

    it('opens "New task from tabs" from the header with no tab ids', () => {
        const open = vi.spyOn(useTaskDraftStore.getState().actions, 'open').mockImplementation(() => undefined);
        renderView();
        fireEvent.click(screen.getByRole('button', { name: '✨ Task from tabs' }));
        expect(open).toHaveBeenCalledWith(undefined);
        open.mockRestore();
    });

    it('splits columns and history, and filters by search, date and priority', () => {
        renderView();
        expect(screen.getByText('📜 Completed History')).toBeInTheDocument();
        expect(visible()).toEqual(
            expect.arrayContaining(['Due today', 'Overdue', 'Later', 'No date', 'Done today', 'Done long ago'])
        );
        const [date, priority] = screen.getAllByRole('combobox');
        fireEvent.change(date, { target: { value: 'today' } });
        expect(visible()).toEqual(['Due today']);
        fireEvent.change(date, { target: { value: 'overdue' } });
        expect(visible()).toEqual(['Overdue']);
        fireEvent.change(date, { target: { value: 'upcoming' } });
        expect(visible()).toEqual(['Later']);
        fireEvent.change(date, { target: { value: 'all' } });
        fireEvent.change(priority, { target: { value: 'high' } });
        expect(visible()).toEqual(['Due today']);
        fireEvent.change(priority, { target: { value: 'all' } });
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'later' } });
        expect(visible()).toEqual(['Later']);
        expect(screen.getByText(/Showing 1 of 6/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('← Back to Today'));
    });

    it('adds tasks to a column with linked tabs', () => {
        useBoardStore.setState({ tabs: [makeTab({ id: 'l1', title: 'Link me' })] });
        renderView();
        fireEvent.click(screen.getAllByText('+ Add Task')[1]);
        fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'From column' } });
        fireEvent.change(document.querySelector('.add-task-form input[type="date"]')!, {
            target: { value: '2026-10-05' },
        });
        fireEvent.change(within(document.querySelector('.add-task-form') as HTMLElement).getByRole('combobox'), {
            target: { value: 'high' },
        });
        fireEvent.click(screen.getByLabelText('Link me'));
        fireEvent.click(screen.getByLabelText('Link me'));
        fireEvent.click(screen.getByLabelText('Link me'));
        fireEvent.submit(document.querySelector('.add-task-form form')!);
        expect(state().tasks.find(t => t.title === 'From column')).toMatchObject({
            status: 'doing',
            priority: 'high',
            tabIds: ['l1'],
            dueDate: '2026-10-05',
        });
        fireEvent.click(screen.getAllByText('+ Add Task')[0]);
        fireEvent.submit(document.querySelector('.add-task-form form')!); // empty: ignored
        fireEvent.click(screen.getByText('Cancel'));
        expect(document.querySelector('.add-task-form')).toBeNull();
    });
});
