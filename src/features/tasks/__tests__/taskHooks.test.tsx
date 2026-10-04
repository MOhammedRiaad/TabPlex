import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskContextActions } from '../hooks/useTaskContextActions';
import { readParkResumeSettings, useParkResumeSettings } from '../hooks/useParkResumeSettings';
import { useParkShortcut } from '../hooks/useParkShortcut';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { useTimerStore } from '../../../store/timerStore';
import { fakeChrome, respondToMessages } from '../../../test/chromeMock';
import { makeContext, makeTask } from '../../../test/factories';
import { Task } from '../../../types';
import { CONTEXT_MESSAGES, DEFAULT_PARK_RESUME_SETTINGS, PARK_RESUME_SETTINGS_KEY } from '../../../utils/taskContext';

const toast = () => useUIStore.getState().toast;
const setSettings = (s: Record<string, unknown>) => chrome.storage.local.set({ [PARK_RESUME_SETTINGS_KEY]: s });

describe('useTaskContextActions', () => {
    let received: { type: string; payload: Record<string, unknown> }[];
    let reply: (m: { type: string; payload: Record<string, unknown> }) => unknown;

    beforeEach(() => {
        useBoardStore.setState({ tasks: [] });
        useUIStore.setState({ toast: null, parkDialogTaskId: null });
        useTimerStore.setState({
            isRunning: false,
            linkedTaskId: null,
            mode: 'work',
            activeMode: null,
            timeLeft: 1500,
        });
        reply = m => ({ success: true, task: m.payload.task });
        received = respondToMessages(m => reply(m));
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    let hook: { current: ReturnType<typeof useTaskContextActions> };
    beforeEach(() => {
        hook = renderHook(() => useTaskContextActions()).result;
    });
    const actions = () => hook.current;

    it('starts a task and applies the returned task', async () => {
        const task = makeTask();
        reply = () => ({ success: true, task: { ...task, context: makeContext({ state: 'active' }) } });
        await act(() => actions().startOrResume(task));
        expect(received[0]).toMatchObject({ type: CONTEXT_MESSAGES.START, payload: { task, windowId: 1 } });
        expect(useBoardStore.getState().tasks[0].context!.state).toBe('active');
        expect(toast()).toMatchObject({
            type: 'success',
            message: expect.stringContaining('Started "Write pricing page"'),
        });
    });

    it('resumes a parked task, reporting an auto-parked one and the timer', async () => {
        await setSettings({ startPomodoroOnStart: true });
        const task = makeTask({ context: makeContext() });
        reply = () => ({ success: true, task, autoParked: makeTask({ id: 'other', title: 'Other' }) });
        await act(() => actions().startOrResume(task));
        expect(received[0].type).toBe(CONTEXT_MESSAGES.RESUME);
        expect(toast()!.message).toBe('Parked "Other" · Started "Write pricing page" · 🍅 timer started');
        expect(useTimerStore.getState()).toMatchObject({ isRunning: true, linkedTaskId: 'task_1' });

        reply = () => ({ success: true, task });
        await act(() => actions().startOrResume(task));
        expect(toast()!.message).toBe('Resumed "Write pricing page" · 2 tabs');
    });

    it('asks before opening very large contexts', async () => {
        const tabs = Array.from({ length: 30 }, (_, i) => ({ url: `https://s${i}.dev`, title: `${i}` }));
        const task = makeTask({ context: makeContext({ tabs }) });
        const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
        await act(() => actions().startOrResume(task));
        expect(received).toHaveLength(0);
        await act(() => actions().startOrResume(task));
        expect(received).toHaveLength(1);
        expect(confirm).toHaveBeenCalledWith('Open 30 tabs for "Write pricing page"?');
    });

    it('reports failures', async () => {
        reply = () => ({ error: 'no window' });
        await act(() => actions().startOrResume(makeTask()));
        expect(toast()).toMatchObject({ type: 'error', message: 'Couldn\'t start "Write pricing page": no window' });

        reply = () => undefined;
        await act(() => actions().park(makeTask()));
        expect(toast()!.message).toContain('The background service did not respond');

        fakeChrome().runtime.sendMessage.mockRejectedValueOnce('plain failure');
        await act(() => actions().addCurrentTabs(makeTask()));
        expect(toast()!.message).toBe("Couldn't add tabs: plain failure");

        reply = () => ({ error: 'x' });
        await act(() => actions().removeTab(makeTask(), 'https://a'));
        expect(toast()!.message).toBe("Couldn't remove tab: x");
    });

    it('parks with options, pausing the linked timer', async () => {
        await setSettings({ startPomodoroOnStart: true });
        useTimerStore.getState().setLinkedTaskId('task_1');
        useTimerStore.getState().setIsRunning(true);
        const parked = makeTask({ context: makeContext() });
        reply = () => ({ success: true, task: parked });
        await act(() => actions().park(makeTask(), { note: 'n', closeTabs: false }));
        expect(received[0].payload).toMatchObject({ note: 'n', closeTabs: false });
        expect(toast()!.message).toBe('Parked "Write pricing page" · 2 tabs saved');
        expect(useTimerStore.getState().isRunning).toBe(false);
    });

    it('attaches an on-device summary after parking', async () => {
        const parked = makeTask({ context: makeContext({ resumeNote: 'note' }) });
        reply = m =>
            m.type === CONTEXT_MESSAGES.SET_SUMMARY
                ? { success: true, task: { ...parked, context: { ...parked.context!, aiSummary: m.payload.summary } } }
                : { success: true, task: parked };
        const summarize = vi.fn().mockResolvedValue('You were testing.');
        const destroy = vi.fn();
        await act(() => actions().park(makeTask(), {}, Promise.resolve({ summarize, destroy })));
        await waitFor(() => expect(useBoardStore.getState().tasks[0].context!.aiSummary).toBe('You were testing.'));
        expect(received[1].payload).toMatchObject({ taskId: 'task_1', parkedAt: parked.context!.parkedAt });
        expect(summarize.mock.calls[0][0]).toContain('Their note: note');
        await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
    });

    it('destroys the summarizer when no summary is made', async () => {
        const summarize = vi.fn();
        const destroy = vi.fn();
        const summarizer = () => Promise.resolve({ summarize, destroy });

        reply = () => ({ success: true, task: makeTask({ context: makeContext({ tabs: [] }) }) });
        await act(() => actions().park(makeTask(), {}, summarizer()));
        await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));

        reply = () => ({ success: true });
        await act(() => actions().park(makeTask(), {}, summarizer()));
        await waitFor(() => expect(destroy).toHaveBeenCalledTimes(2));

        reply = () => ({ error: 'no context' });
        await act(() => actions().park(makeTask(), {}, summarizer()));
        await waitFor(() => expect(destroy).toHaveBeenCalledTimes(3));
        expect(toast()!.message).toBe(`Couldn't park "Write pricing page": no context`);
        expect(summarize).not.toHaveBeenCalled();
    });

    it('skips or tolerates summary problems', async () => {
        const noTabs = makeTask({ context: makeContext({ tabs: [] }) });
        reply = () => ({ success: true, task: noTabs });
        const summarize = vi.fn().mockResolvedValue('');
        await act(() => actions().park(makeTask(), {}, Promise.resolve({ summarize })));
        expect(summarize).not.toHaveBeenCalled();

        reply = () => ({ success: true, task: makeTask({ context: makeContext() }) });
        await act(() => actions().park(makeTask(), {}, Promise.resolve({ summarize })));
        await waitFor(() => expect(summarize).toHaveBeenCalled());
        expect(received.filter(m => m.type === CONTEXT_MESSAGES.SET_SUMMARY)).toHaveLength(0);

        await act(() => actions().park(makeTask(), {}, Promise.reject(new Error('model failed'))));
        await waitFor(() => expect(console.warn).toHaveBeenCalledWith('On-device summary failed', expect.any(Error)));
    });

    it('attaches specific tabs quietly and returns the updated task', async () => {
        const task = makeTask();
        const withTabs = { ...task, context: makeContext({ state: 'idle' }) };
        reply = () => ({ success: true, task: withTabs });
        let result: Task | undefined;
        await act(async () => {
            result = await actions().attachTabs(task, [4, 7]);
        });
        expect(received[0]).toMatchObject({ type: CONTEXT_MESSAGES.ADD_TABS, payload: { task, chromeTabIds: [4, 7] } });
        expect(result).toEqual(withTabs);
        expect(useBoardStore.getState().tasks).toEqual([withTabs]);
        expect(toast()).toBeNull();

        reply = () => ({ success: true });
        await act(async () => {
            result = await actions().attachTabs(task, [4]);
        });
        expect(result).toBe(task);

        reply = () => ({ error: 'no window' });
        await expect(actions().attachTabs(task, [4])).rejects.toThrow('no window');
    });

    it('starts quietly, reporting the auto-parked task and the timer', async () => {
        await setSettings({ startPomodoroOnStart: true });
        const task = makeTask();
        const other = makeTask({ id: 'other', title: 'Other' });
        reply = () => ({
            success: true,
            task: { ...task, context: makeContext({ state: 'active' }) },
            autoParked: other,
        });
        let response: Awaited<ReturnType<ReturnType<typeof useTaskContextActions>['startQuietly']>> | undefined;
        await act(async () => {
            response = await actions().startQuietly(task);
        });
        expect(received[0]).toMatchObject({ type: CONTEXT_MESSAGES.START, payload: { task, windowId: 1 } });
        expect(response).toMatchObject({ autoParked: other, timerStarted: true });
        expect(useTimerStore.getState()).toMatchObject({ isRunning: true, linkedTaskId: task.id });
        expect(
            useBoardStore
                .getState()
                .tasks.map(t => t.id)
                .sort()
        ).toEqual(['other', 'task_1']);
        expect(toast()).toBeNull();
    });

    it('adds current tabs and removes tabs', async () => {
        const task = makeTask();
        reply = () => ({ success: true, task: { ...task, context: makeContext() } });
        await act(() => actions().addCurrentTabs(task));
        expect(toast()).toMatchObject({ type: 'success', message: 'Added 2 tabs to "Write pricing page"' });
        reply = () => ({ success: true, task });
        await act(() => actions().addCurrentTabs(task));
        expect(toast()!.type).toBe('info');
        reply = () => ({ success: true });
        await act(() => actions().addCurrentTabs(task));
        await act(() => actions().removeTab(task, 'https://a'));
        expect(received.slice(-1)[0]).toMatchObject({
            type: CONTEXT_MESSAGES.REMOVE_TAB,
            payload: { url: 'https://a' },
        });
    });

    it('sends no window id when it cannot be read, and opens the park dialog', async () => {
        fakeChrome().windows.getCurrent.mockRejectedValueOnce(new Error('no window'));
        await act(() => actions().startOrResume(makeTask()));
        expect(received[0].payload.windowId).toBeUndefined();
        act(() => actions().requestPark(makeTask({ id: 'p' })));
        expect(useUIStore.getState().parkDialogTaskId).toBe('p');
    });
});

describe('useParkResumeSettings', () => {
    it('loads, updates and follows changes made elsewhere', async () => {
        await setSettings({ closeTabsOnPark: false });
        const { result, unmount } = renderHook(() => useParkResumeSettings());
        await waitFor(() => expect(result.current.settings.closeTabsOnPark).toBe(false));
        expect(result.current.settings.autoAddNewTabs).toBe(true);

        act(() => result.current.updateSettings({ aiSummaries: true }));
        await waitFor(async () => expect((await readParkResumeSettings()).aiSummaries).toBe(true));

        await act(() => setSettings({ startPomodoroOnStart: true }));
        expect(result.current.settings).toEqual({ ...DEFAULT_PARK_RESUME_SETTINGS, startPomodoroOnStart: true });
        await act(() => chrome.storage.local.set({ unrelated: 1 }));
        await act(() => chrome.storage.local.remove(PARK_RESUME_SETTINGS_KEY));
        expect(result.current.settings).toEqual(DEFAULT_PARK_RESUME_SETTINGS);
        unmount();
        expect(fakeChrome().storage.onChanged.listeners.size).toBe(0);
    });

    it('falls back to defaults when storage fails', async () => {
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('x'));
        expect(await readParkResumeSettings()).toEqual(DEFAULT_PARK_RESUME_SETTINGS);
    });

    it('ignores a late load after unmount', async () => {
        const { unmount } = renderHook(() => useParkResumeSettings());
        unmount();
        await act(() => Promise.resolve());
    });
});

describe('useParkShortcut', () => {
    afterEach(() => useUIStore.setState({ parkDialogTaskId: null, toast: null }));

    const press = (init: KeyboardEventInit, target: EventTarget = window) =>
        act(() => {
            target.dispatchEvent(
                new KeyboardEvent('keydown', { code: 'KeyP', altKey: true, shiftKey: true, bubbles: true, ...init })
            );
        });

    it('opens the park dialog for the active task', () => {
        const active: Task = makeTask({ id: 'a', context: makeContext({ state: 'active' }) });
        useBoardStore.setState({ tasks: [active] });
        renderHook(() => useParkShortcut());
        press({});
        expect(useUIStore.getState().parkDialogTaskId).toBe('a');
    });

    it('explains when nothing is active and ignores other keys and inputs', () => {
        useBoardStore.setState({ tasks: [] });
        renderHook(() => useParkShortcut());
        press({ code: 'KeyO' });
        press({ ctrlKey: true });
        const input = document.createElement('textarea');
        document.body.appendChild(input);
        press({}, input);
        expect(useUIStore.getState().toast).toBeNull();
        press({});
        expect(useUIStore.getState().toast!.message).toBe('No active task to park');
        input.remove();
    });
});
