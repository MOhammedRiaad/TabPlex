import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodayView from '../TodayView';
import TodayHeader from '../components/TodayHeader';
import HistoryView from '../../history/HistoryView';
import ErrorBoundary from '../../ui/components/ErrorBoundary';
import ThemeToggle from '../../ui/components/ThemeToggle';
import BoardToast from '../../boards/components/BoardToast';
import Toast from '../../bookmarks/components/Toast';
import { useBoardStore } from '../../../store/boardStore';
import { fakeChrome, respondToMessages } from '../../../test/chromeMock';
import { makeContext, makeFolder, makeNote, makeTask } from '../../../test/factories';

function Location() {
    return <span data-testid="location">{useLocation().pathname}</span>;
}

const renderAt = (ui: React.ReactElement) =>
    render(
        <MemoryRouter initialEntries={['/today']}>
            <Routes>
                <Route
                    path="*"
                    element={
                        <>
                            {ui}
                            <Location />
                        </>
                    }
                />
            </Routes>
        </MemoryRouter>
    );

describe('TodayView', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-03T09:00:00'));
        const many = Array.from({ length: 5 }, (_, i) => makeTask({ id: `todo${i}`, title: `Todo ${i}` }));
        useBoardStore.setState({
            tasks: [
                ...many,
                makeTask({ id: 'due', title: 'Due today', dueDate: '2026-10-03', status: 'doing' }),
                makeTask({ id: 'late', title: 'Late', dueDate: '2026-09-01', priority: 'high' }),
                makeTask({ id: 'later', title: 'Later', dueDate: '2026-10-20', priority: 'low' }),
                makeTask({ id: 'done', title: 'Done now', status: 'done', completedAt: '2026-10-03T08:00:00' }),
                makeTask({ id: 'old', title: 'Done before', status: 'done', completedAt: '2026-09-01T08:00:00' }),
                makeTask({
                    id: 'parked',
                    title: 'Parked one',
                    context: makeContext({
                        tabs: Array.from({ length: 7 }, (_, i) => ({
                            url: `https://s${i}.dev`,
                            title: `S${i}`,
                            favicon: i % 2 ? 'f.png' : undefined,
                        })),
                    }),
                }),
            ],
            notes: [
                makeNote({ createdAt: '2026-10-03T08:00:00' }),
                makeNote({ id: 'old', title: 'Old note', content: 'old', createdAt: '2026-09-01T00:00:00' }),
            ],
            bookmarks: [
                { id: 'b', title: 'Link', url: 'https://link.dev' },
                { id: 'f', title: 'Folder' },
            ] as never,
        });
        respondToMessages(m =>
            m.type === 'GET_USER_INFO' ? { email: 'ada@example.com' } : m.type === 'GET_BOOKMARKS' ? [] : undefined
        );
    });
    afterEach(() => vi.useRealTimers());

    const titles = () => [...document.querySelectorAll('.tasks-card .task-title')].map(e => e.textContent);

    it('greets the user and shows today, parked work, notes and links', async () => {
        renderAt(<TodayView />);
        expect(await screen.findByText('Good Morning, Ada')).toBeInTheDocument();
        expect(screen.getByText('Pick up where you left off')).toBeInTheDocument();
        expect(screen.getByText('+2')).toBeInTheDocument();
        expect(titles()).toEqual(expect.arrayContaining(['Late', 'Due today', 'Done now']));
        expect(titles()).not.toContain('Later');
        expect(titles()).not.toContain('Done before');
        expect(titles().filter(t => t?.startsWith('Todo')).length).toBeLessThan(5); // columns show 3 until 'Show All'
    });

    it('shows all tasks and filters by date and priority', () => {
        renderAt(<TodayView />);
        fireEvent.click(screen.getByText('Show All Tasks'));
        expect(titles()).toEqual(expect.arrayContaining(['Later', 'Done before']));
        const [date, priority] = screen.getAllByRole('combobox').slice(0, 2);
        fireEvent.change(date, { target: { value: 'today' } });
        expect(titles()).toEqual(['Due today']);
        fireEvent.change(date, { target: { value: 'overdue' } });
        expect(titles()).toEqual(['Late']);
        fireEvent.change(date, { target: { value: 'upcoming' } });
        expect(titles()).toEqual(['Later']);
        fireEvent.change(date, { target: { value: 'all' } });
        fireEvent.change(priority, { target: { value: 'low' } });
        expect(titles()).toEqual(['Later']);
        fireEvent.click(screen.getByText('Today Only Tasks'));
    });

    it('navigates from quick actions', () => {
        renderAt(<TodayView />);
        const expectations: [string, string][] = [
            ['.task-action', '/tasks'],
            ['.note-action', '/notes'],
            ['.focus-action', '/pomodoro'],
            ['.canvas-action', '/canvas'],
            ['.view-more-btn', '/tasks'],
        ];
        for (const [selector, path] of expectations) {
            act(() => fireEvent.click(document.querySelector(selector)!));
            expect(screen.getByTestId('location')).toHaveTextContent(path);
        }
    });
});

describe('TodayHeader', () => {
    afterEach(() => vi.useRealTimers());

    it.each([
        ['2026-10-03T13:00:00', 'Good Afternoon'],
        ['2026-10-03T19:00:00', 'Good Evening'],
    ])('greets by time of day (%s)', (time, greeting) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(time));
        render(<TodayHeader />);
        expect(screen.getByText(greeting)).toBeInTheDocument();
    });

    it('falls back to the identity API, and handles its errors', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        fakeChrome().runtime.sendMessage.mockRejectedValueOnce(new Error('no background'));
        fakeChrome().identity.getProfileUserInfo.mockImplementationOnce(
            (_o: unknown, cb: (i: { email: string }) => void) => cb({ email: 'grace@x.dev' })
        );
        const { unmount } = render(<TodayHeader />);
        expect(await screen.findByText(/, Grace/)).toBeInTheDocument();
        unmount();

        fakeChrome().identity.getProfileUserInfo.mockImplementationOnce((_o: unknown, cb: (i: unknown) => void) => {
            fakeChrome().runtime.lastError = { message: 'signed out' };
            cb(undefined);
            fakeChrome().runtime.lastError = undefined;
        });
        render(<TodayHeader />);
        await waitFor(() => expect(console.log).toHaveBeenCalledWith('Identity API error:', expect.anything()));

        fakeChrome().identity.getProfileUserInfo.mockImplementationOnce(() => {
            throw new Error('boom');
        });
        render(<TodayHeader />);
        await waitFor(() =>
            expect(console.log).toHaveBeenCalledWith('Direct identity call failed:', expect.any(Error))
        );
    });
});

describe('HistoryView', () => {
    beforeEach(() => {
        useBoardStore.setState({ history: [], folders: [makeFolder({ id: 'f1', name: 'Folder one' })], tabs: [] });
        respondToMessages(m => {
            if (m.type === 'GET_HISTORY')
                return [{ id: 'h1', url: 'https://h.dev', title: 'Visited page', favicon: 'x.png' }];
            if (m.type === 'GET_BROWSER_HISTORY') return [{ id: 'b1', url: 'https://b.dev', title: 'Browser page' }];
            return undefined;
        });
    });

    it('loads history and adds items to folders', async () => {
        renderAt(<HistoryView />);
        expect(await screen.findByText('Visited page')).toBeInTheDocument();
        fireEvent.error(document.querySelector('.history-favicon')!);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f1' } });
        fireEvent.click(screen.getByText('Add to Folder'));
        expect(await screen.findByText('Added "Visited page" to folder')).toBeInTheDocument();
        expect(useBoardStore.getState().tabs[0].folderId).toBe('f1');
        fireEvent.click(screen.getByText(/Load Recent/));
        expect(await screen.findByText('Browser page')).toBeInTheDocument();
    });

    it('logs browser history failures', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        renderAt(<HistoryView />);
        await screen.findByText('Visited page');
        fakeChrome().runtime.sendMessage.mockRejectedValueOnce(new Error('denied'));
        fireEvent.click(screen.getByText(/Load Recent/));
        await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith('Failed to load browser history:', expect.any(Error))
        );
    });
});

describe('small UI components', () => {
    it('ErrorBoundary shows the default or custom fallback', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const Boom = () => {
            throw new Error('kaboom');
        };
        const { unmount } = render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );
        expect(screen.getByText('Application Error')).toBeInTheDocument();
        expect(screen.getByText('Error: kaboom')).toBeInTheDocument();
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { value: { ...window.location, reload }, configurable: true });
        fireEvent.click(screen.getByText('Reload'));
        expect(reload).toHaveBeenCalled();
        unmount();
        render(
            <ErrorBoundary fallback={<p>custom</p>}>
                <Boom />
            </ErrorBoundary>
        );
        expect(screen.getByText('custom')).toBeInTheDocument();
    });

    it('ThemeToggle switches themes', () => {
        render(<ThemeToggle />);
        fireEvent.click(screen.getByLabelText('Dark mode'));
        expect(localStorage.getItem('tabboard_theme')).toBe('dark');
        fireEvent.click(screen.getByLabelText('Light mode'));
        fireEvent.click(screen.getByLabelText('System theme'));
        expect(localStorage.getItem('tabboard_theme')).toBe('system');
    });

    it.each([BoardToast, Toast])('toasts auto-close and can be dismissed', Component => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<Component message="Saved" onClose={onClose} duration={1000} />);
        fireEvent.click(screen.getByLabelText('Close'));
        act(() => vi.advanceTimersByTime(1000));
        expect(onClose).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });
});
