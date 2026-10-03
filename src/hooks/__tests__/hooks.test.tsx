import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../useTheme';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useTaskNotifications } from '../useTaskNotifications';
import { useBoardStore } from '../../store/boardStore';
import { makeBoard, makeFolder, makeTask } from '../../test/factories';

const press = (key: string, opts: KeyboardEventInit = {}, target: EventTarget = window) =>
    act(() => {
        target.dispatchEvent(
            new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: true, bubbles: true, ...opts })
        );
    });

describe('useTheme', () => {
    let listeners: ((e: { matches: boolean }) => void)[];
    beforeEach(() => {
        listeners = [];
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
            removeEventListener: vi.fn(),
        }));
    });

    it('follows the system theme by default and reacts to changes', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current).toMatchObject({ theme: 'system', resolvedTheme: 'light' });
        expect(document.documentElement.dataset.theme).toBe('light');
        act(() => listeners.forEach(l => l({ matches: true })));
        expect(result.current.resolvedTheme).toBe('dark');
        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('persists explicit themes and toggles', () => {
        localStorage.setItem('tabboard_theme', 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('dark');
        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('light');
        expect(localStorage.getItem('tabboard_theme')).toBe('light');
        act(() => result.current.setTheme('system'));
        act(() => result.current.toggleTheme());
        expect(result.current.theme).toBe('dark');
    });

    it('ignores invalid stored values', () => {
        localStorage.setItem('tabboard_theme', 'purple');
        expect(renderHook(() => useTheme()).result.current.theme).toBe('system');
    });
});

describe('useKeyboardShortcuts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useBoardStore.setState({ boards: [makeBoard()], folders: [makeFolder()], tabs: [], tasks: [], notes: [] });
    });
    afterEach(() => vi.useRealTimers());

    it.each([
        ['b', 'boards'],
        ['h', 'history'],
        ['s', 'sessions'],
        ['t', 'today'],
        ['m', 'bookmarks'],
    ])('Ctrl+Shift+%s switches to %s', (key, view) => {
        const setActiveView = vi.fn();
        renderHook(() => useKeyboardShortcuts('today', setActiveView));
        press(key);
        expect(setActiveView).toHaveBeenCalledWith(view);
    });

    it('ignores keys typed into inputs', () => {
        const setActiveView = vi.fn();
        renderHook(() => useKeyboardShortcuts('today', setActiveView));
        const input = document.createElement('input');
        document.body.appendChild(input);
        press('b', {}, input);
        expect(setActiveView).not.toHaveBeenCalled();
        input.remove();
    });

    it('creates tabs, notes, tasks and folders, debouncing repeats', () => {
        const { rerender } = renderHook(({ view }) => useKeyboardShortcuts(view, vi.fn()), {
            initialProps: { view: 'boards' as 'boards' | 'today' | 'history' },
        });
        press('a');
        press('a'); // ignored while processing
        expect(useBoardStore.getState().tabs).toHaveLength(1);
        expect(useBoardStore.getState().tabs[0].folderId).toBe('folder_1');
        act(() => vi.advanceTimersByTime(300));
        rerender({ view: 'today' });
        press('a');
        expect(useBoardStore.getState().tabs[1].folderId).toBe('');
        act(() => vi.advanceTimersByTime(300));
        rerender({ view: 'history' });
        press('a');
        expect(useBoardStore.getState().tabs).toHaveLength(2);

        press('n');
        press('n');
        expect(useBoardStore.getState().notes).toHaveLength(1);
        press('k');
        press('k');
        expect(useBoardStore.getState().tasks).toHaveLength(1);
        press('f');
        press('f');
        expect(useBoardStore.getState().folders).toHaveLength(2);
        act(() => vi.advanceTimersByTime(300));
        press('f');
        expect(useBoardStore.getState().folders).toHaveLength(3);
    });

    it('does not add folders without a board, and dispatches export', () => {
        useBoardStore.setState({ boards: [] });
        renderHook(() => useKeyboardShortcuts('boards', vi.fn()));
        press('f');
        expect(useBoardStore.getState().folders).toHaveLength(1);
        press('n');
        expect(useBoardStore.getState().notes[0].boardId).toBeUndefined();
        const onExport = vi.fn();
        window.addEventListener('exportData', onExport);
        press('e');
        expect(onExport).toHaveBeenCalled();
        window.removeEventListener('exportData', onExport);
        press('z');
        press('b', { ctrlKey: false, metaKey: false });
    });
});

describe('useTaskNotifications', () => {
    const notifications: { title: string; options: NotificationOptions; close: () => void; onclick?: () => void }[] =
        [];

    class FakeNotification {
        static permission: NotificationPermission = 'granted';
        static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
        close = vi.fn();
        onclick?: () => void;
        constructor(
            public title: string,
            public options: NotificationOptions
        ) {
            notifications.push(this);
        }
    }

    beforeEach(() => {
        notifications.length = 0;
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00'));
        vi.stubGlobal('Notification', FakeNotification);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('notifies due and overdue tasks once, spaced out', () => {
        useBoardStore.setState({
            tasks: [
                makeTask({ id: 'today', title: 'Today', dueDate: '2026-10-03T09:00:00', priority: 'high' }),
                makeTask({ id: 'late', title: 'Late', dueDate: '2026-10-01T09:00:00' }),
                makeTask({ id: 'future', dueDate: '2026-10-09T09:00:00' }),
                makeTask({ id: 'done', status: 'done', dueDate: '2026-10-01T09:00:00' }),
                makeTask({ id: 'nodate' }),
            ],
        });
        const { rerender } = renderHook(() => useTaskNotifications());
        act(() => vi.advanceTimersByTime(0));
        expect(notifications.map(n => n.title)).toEqual(['📅 Task Due Today: Today']);
        expect(notifications[0].options).toMatchObject({ requireInteraction: true, tag: 'task-today' });

        // A store change during the delay must not schedule duplicates
        act(() => useBoardStore.setState({ tasks: [...useBoardStore.getState().tasks] }));
        rerender();
        act(() => vi.advanceTimersByTime(2000));
        expect(notifications.map(n => n.title)).toEqual(['📅 Task Due Today: Today', '⚠️ Overdue Task: Late']);
        expect(notifications[1].options.body).toContain('This task was due on');

        // Non-high priority notifications close themselves; clicks focus the window
        act(() => vi.advanceTimersByTime(10000));
        expect(notifications[1].close).toHaveBeenCalled();
        expect(notifications[0].close).not.toHaveBeenCalled();
        notifications[0].onclick?.();
        expect(notifications[0].close).toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(60000));
        expect(notifications).toHaveLength(2);
    });

    it('forgets notified tasks once they are done, and asks for permission', () => {
        FakeNotification.permission = 'default';
        useBoardStore.setState({ tasks: [makeTask({ dueDate: '2026-10-03T00:00:00' })] });
        renderHook(() => useTaskNotifications());
        expect(FakeNotification.requestPermission).toHaveBeenCalled();
        expect(notifications).toHaveLength(0);
        FakeNotification.permission = 'granted';
        act(() => useBoardStore.setState({ tasks: [makeTask({ status: 'done', dueDate: '2026-10-03T00:00:00' })] }));
    });

    it('logs notification errors', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.stubGlobal(
            'Notification',
            Object.assign(
                function () {
                    throw new Error('blocked');
                },
                { permission: 'granted', requestPermission: vi.fn() }
            )
        );
        useBoardStore.setState({ tasks: [makeTask({ dueDate: '2026-10-03T00:00:00' })] });
        renderHook(() => useTaskNotifications());
        act(() => vi.advanceTimersByTime(0));
        expect(error).toHaveBeenCalledWith('Error showing notification:', expect.any(Error));
    });
});
