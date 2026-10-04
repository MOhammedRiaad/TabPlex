import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateTaskFromTabs } from '../useCreateTaskFromTabs';
import { useTaskDraftStore } from '../../store/taskDraftStore';
import { useBoardStore } from '../../../../store/boardStore';
import { useUIStore } from '../../../ui/store/uiStore';
import { useTimerStore } from '../../../../store/timerStore';
import { respondToMessages } from '../../../../test/chromeMock';
import { makeContext, makeTask } from '../../../../test/factories';
import { Task } from '../../../../types';
import { CONTEXT_MESSAGES, PARK_RESUME_SETTINGS_KEY } from '../../../../utils/taskContext';

type Message = { type: string; payload: Record<string, unknown> };

const toast = () => useUIStore.getState().toast;
const draft = () => useTaskDraftStore.getState();

/** A dialog that's ready to create: 3 checked tabs, notes, 3 steps (one excluded, one empty) */
function seedDraft(overrides: Partial<ReturnType<typeof draft>> = {}) {
    useTaskDraftStore.setState({
        phase: 'ready',
        tabs: [],
        checkedIds: [11, 12, 13],
        title: '  Compare pricing  ',
        description: '   ',
        priority: 'high',
        steps: [
            { key: 's1', text: ' Compare fees ', included: true },
            { key: 's2', text: 'Skip me', included: false },
            { key: 's3', text: '   ', included: true },
        ],
        ...overrides,
    });
}

describe('useCreateTaskFromTabs', () => {
    let received: Message[];
    let reply: (m: Message) => unknown;
    /** Order of events: sent messages and the moment ADD_TASK was answered */
    let log: string[];

    beforeEach(() => {
        useTaskDraftStore.getState().actions.cancel();
        useBoardStore.setState({ tasks: [] });
        useUIStore.setState({ toast: null });
        useTimerStore.setState({
            isRunning: false,
            linkedTaskId: null,
            mode: 'work',
            activeMode: null,
            timeLeft: 1500,
        });
        log = [];
        reply = m => {
            if (m.type === 'ADD_TASK') return { success: true };
            const task = m.payload.task as Task;
            if (m.type === CONTEXT_MESSAGES.START) {
                return {
                    success: true,
                    task: { ...task, status: 'doing', context: makeContext({ state: 'active', tabs: [] }) },
                };
            }
            const ids = m.payload.chromeTabIds as number[];
            const tabs = ids.slice(0, 2).map(id => ({ url: `https://t${id}.dev/`, title: `T${id}` }));
            return { success: true, task: { ...task, context: { ...(task.context ?? makeContext()), tabs } } };
        };
        received = respondToMessages(m => {
            log.push(m.type);
            return reply(m);
        });
    });

    /** Render first, then act: renderHook inside act() leaves result.current null until act ends */
    const run = async (action: 'create' | 'createAndStart') => {
        const { current } = renderHook(() => useCreateTaskFromTabs()).result;
        await act(() => current[action]());
    };

    it('1: create saves the task, waits for the background, then attaches the checked tabs', async () => {
        seedDraft();
        await run('create');

        expect(log).toEqual(['ADD_TASK', CONTEXT_MESSAGES.ADD_TABS]);
        const added = received[0].payload as unknown as Task;
        expect(added).toMatchObject({ title: 'Compare pricing', priority: 'high', status: 'todo' });
        expect(added.description).toBeUndefined();
        expect(added.checklist).toEqual([{ id: expect.any(String), text: 'Compare fees', completed: false }]);
        expect(received[1].payload.chromeTabIds).toEqual([11, 12, 13]);
        expect(toast()).toMatchObject({ type: 'success', message: 'Created “Compare pricing” with 2 tabs' });
        expect(draft().phase).toBe('closed');
        expect(useBoardStore.getState().tasks[0].context!.tabs).toHaveLength(2);
    });

    it('create without checked tabs or steps: no tab message, no checklist', async () => {
        seedDraft({ checkedIds: [], steps: [], description: 'Some notes' });
        await run('create');
        expect(log).toEqual(['ADD_TASK']);
        const added = received[0].payload as unknown as Task;
        expect(added.description).toBe('Some notes');
        expect('checklist' in added).toBe(false);
        expect(toast()!.message).toBe('Created “Compare pricing” with 0 tabs');
    });

    it('2: create & start: ADD_TASK, then START, then ADD_TABS; reports an auto-parked task', async () => {
        seedDraft();
        const base = reply;
        reply = m =>
            m.type === CONTEXT_MESSAGES.START
                ? { ...(base(m) as object), autoParked: makeTask({ id: 'other', title: 'Plan offsite' }) }
                : base(m);
        await run('createAndStart');

        expect(log).toEqual(['ADD_TASK', CONTEXT_MESSAGES.START, CONTEXT_MESSAGES.ADD_TABS]);
        // ADD_TABS gets the started (active) task, so the background groups the tabs in place
        expect((received[2].payload.task as Task).context!.state).toBe('active');
        expect(toast()!.message).toBe('Started “Compare pricing” · 2 tabs grouped · Parked “Plan offsite”');
        expect(draft().phase).toBe('closed');
    });

    it('create & start without checked tabs just starts the task', async () => {
        seedDraft({ checkedIds: [] });
        await run('createAndStart');
        expect(log).toEqual(['ADD_TASK', CONTEXT_MESSAGES.START]);
        expect(toast()!.message).toBe('Started “Compare pricing” · 0 tabs grouped');
    });

    it('3: a background error on ADD_TASK keeps the dialog open and sends nothing else', async () => {
        seedDraft();
        reply = () => ({ error: 'storage full' });
        await run('create');
        expect(log).toEqual(['ADD_TASK']);
        expect(toast()).toMatchObject({ type: 'error', message: "Couldn't create the task: storage full" });
        expect(draft().phase).toBe('ready');
    });

    it('4: attaching tabs fails: the task stays, the toast says so, the dialog closes', async () => {
        seedDraft();
        const base = reply;
        reply = m => (m.type === CONTEXT_MESSAGES.ADD_TABS ? { error: 'no window' } : base(m));
        await run('create');
        expect(useBoardStore.getState().tasks).toHaveLength(1);
        expect(toast()).toMatchObject({
            type: 'error',
            message: "Created “Compare pricing”, but couldn't attach its tabs: no window",
        });
        expect(draft().phase).toBe('closed');

        seedDraft();
        reply = m => (m.type === CONTEXT_MESSAGES.START ? { error: 'no window' } : base(m));
        await run('createAndStart');
        expect(toast()!.message).toBe("Created “Compare pricing”, but couldn't start it: no window");
        expect(draft().phase).toBe('closed');
    });

    it('5: create & start starts the linked Pomodoro when the setting is on', async () => {
        await chrome.storage.local.set({ [PARK_RESUME_SETTINGS_KEY]: { startPomodoroOnStart: true } });
        seedDraft();
        await run('createAndStart');
        const taskId = (received[0].payload as unknown as Task).id;
        expect(useTimerStore.getState()).toMatchObject({ isRunning: true, linkedTaskId: taskId });
        expect(toast()!.message).toContain('· 🍅 timer started');
    });

    it('does nothing without a title or while already creating', async () => {
        seedDraft({ title: '   ' });
        await run('create');
        seedDraft({ phase: 'creating' });
        await run('createAndStart');
        expect(log).toEqual([]);
        vi.restoreAllMocks();
    });
});
