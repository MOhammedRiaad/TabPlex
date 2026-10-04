// "Create task", "Create & start" and "Create & park" for the New task from tabs dialog.
// See docs/specs/AI_TASK_FROM_TABS.md §8.4 and §15.
import { useCallback } from 'react';
import { Task } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { generateId, generateTaskId } from '../../../utils/idGenerator';
import { useUIActions } from '../../ui/store/uiStore';
import { useTaskContextActions } from '../../tasks/hooks/useTaskContextActions';
import { pluralizeTabs } from '../../tasks/utils/contextUtils';
import { useTaskDraftStore } from '../store/taskDraftStore';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useCreateTaskFromTabs(): {
    create(): Promise<void>;
    createAndStart(): Promise<void>;
    createAndPark(): Promise<void>;
} {
    const addTaskAndSync = useBoardStore(state => state.addTaskAndSync);
    const { attachTabs, startQuietly, parkQuietly } = useTaskContextActions();
    const { showToast } = useUIActions();

    /** Save the task (waiting for the background) and return it with the checked tab ids, or null on failure */
    const save = useCallback(async (): Promise<{ saved: Task; ids: number[] } | null> => {
        const state = useTaskDraftStore.getState();
        const title = state.title.trim();
        if (!title || state.phase === 'creating') return null;
        useTaskDraftStore.setState({ phase: 'creating' });

        const checklist = state.steps
            .filter(step => step.included && step.text.trim())
            .map(step => ({ id: generateId(), text: step.text.trim(), completed: false }));
        const task: Omit<Task, 'createdAt' | 'updatedAt'> = {
            id: generateTaskId(),
            title,
            description: state.description.trim() || undefined,
            priority: state.priority,
            status: 'todo',
            ...(checklist.length ? { checklist } : {}),
        };

        try {
            return { saved: await addTaskAndSync(task), ids: state.checkedIds };
        } catch (error) {
            showToast(`Couldn't create the task: ${errorMessage(error)}`, 'error');
            useTaskDraftStore.setState({ phase: 'ready' });
            return null;
        }
    }, [addTaskAndSync, showToast]);

    const close = () => useTaskDraftStore.getState().actions.cancel();

    const create = useCallback(async () => {
        const result = await save();
        if (!result) return;
        const { saved, ids } = result;
        try {
            const withTabs = ids.length ? await attachTabs(saved, ids) : saved;
            showToast(`Created “${saved.title}” with ${pluralizeTabs(withTabs.context?.tabs.length ?? 0)}`, 'success');
        } catch (error) {
            showToast(`Created “${saved.title}”, but couldn't attach its tabs: ${errorMessage(error)}`, 'error');
        }
        close();
    }, [save, attachTabs, showToast]);

    const createAndStart = useCallback(async () => {
        const result = await save();
        if (!result) return;
        const { saved, ids } = result;
        try {
            // Start with an empty context, then attach the live tabs: they're grouped in place. Attaching
            // first would make START reopen them as new tabs (duplicates).
            const started = await startQuietly(saved);
            const withTabs = ids.length ? await attachTabs(started.task ?? saved, ids) : (started.task ?? saved);
            const parked = started.autoParked ? ` · Parked “${started.autoParked.title}”` : '';
            const timer = started.timerStarted ? ' · 🍅 timer started' : '';
            showToast(
                `Started “${saved.title}” · ${pluralizeTabs(withTabs.context?.tabs.length ?? 0)} grouped${parked}${timer}`,
                'success'
            );
        } catch (error) {
            showToast(`Created “${saved.title}”, but couldn't start it: ${errorMessage(error)}`, 'error');
        }
        close();
    }, [save, startQuietly, attachTabs, showToast]);

    const createAndPark = useCallback(async () => {
        const result = await save();
        if (!result) return;
        const { saved, ids } = result;
        try {
            // Attach the tabs, then park: the task never becomes active, so the current active task is untouched
            const withTabs = await attachTabs(saved, ids);
            const parked = await parkQuietly(withTabs, ids);
            const count = parked.context?.tabs.length ?? 0;
            showToast(`Parked “${saved.title}” · ${pluralizeTabs(count)} saved and closed`, 'success');
        } catch (error) {
            showToast(`Created “${saved.title}”, but couldn't park it: ${errorMessage(error)}`, 'error');
        }
        close();
    }, [save, attachTabs, parkQuietly, showToast]);

    return { create, createAndStart, createAndPark };
}
