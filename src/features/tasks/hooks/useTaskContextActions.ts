import { useCallback } from 'react';
import { Task } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { useUIActions } from '../../ui/store/uiStore';
import {
    CONTEXT_MESSAGES,
    ContextMessageType,
    ContextResponse,
    LARGE_CONTEXT_THRESHOLD,
    ParkContextPayload,
} from '../../../utils/taskContext';
import { pluralizeTabs } from '../utils/contextUtils';
import { pausePomodoroForTask, startPomodoroForTask } from '../utils/pomodoroLink';
import { readParkResumeSettings } from './useParkResumeSettings';
import { summarizeContext } from '../utils/aiSummary';

async function currentWindowId(): Promise<number | undefined> {
    try {
        return (await chrome.windows.getCurrent()).id;
    } catch {
        return undefined;
    }
}

async function sendContextMessage(type: ContextMessageType, payload?: unknown): Promise<ContextResponse> {
    const response = (await chrome.runtime.sendMessage({ type, payload })) as ContextResponse | undefined;
    if (!response) throw new Error('The background service did not respond');
    if (response.error) throw new Error(response.error);
    return response;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Park & Resume actions. All tab work happens in the background service worker; this hook sends the
 * request, applies the returned task(s) to the store, and reports the outcome with a toast.
 */
export function useTaskContextActions() {
    const upsertTaskSilently = useBoardStore(state => state.upsertTaskSilently);
    const { showToast, openParkDialog } = useUIActions();

    const apply = useCallback(
        (response: ContextResponse) => {
            if (response.autoParked) upsertTaskSilently(response.autoParked);
            if (response.task) upsertTaskSilently(response.task);
        },
        [upsertTaskSilently]
    );

    /** Start (no saved tabs / idle) or resume (parked) a task's context */
    const startOrResume = useCallback(
        async (task: Task) => {
            const count = task.context?.tabs.length ?? 0;
            if (count > LARGE_CONTEXT_THRESHOLD && !window.confirm(`Open ${count} tabs for "${task.title}"?`)) {
                return;
            }
            const isResume = task.context?.state === 'parked';
            try {
                const response = await sendContextMessage(isResume ? CONTEXT_MESSAGES.RESUME : CONTEXT_MESSAGES.START, {
                    task,
                    windowId: await currentWindowId(),
                });
                apply(response);
                const settings = await readParkResumeSettings();
                const timerStarted = settings.startPomodoroOnStart && startPomodoroForTask(task.id);
                const timerNote = timerStarted ? ' · 🍅 timer started' : '';
                if (response.autoParked) {
                    showToast(`Parked "${response.autoParked.title}" · Started "${task.title}"${timerNote}`, 'info');
                } else {
                    showToast(
                        isResume
                            ? `Resumed "${task.title}" · ${pluralizeTabs(count)}${timerNote}`
                            : `Started "${task.title}" — new tabs join its group${timerNote}`,
                        'success'
                    );
                }
            } catch (error) {
                showToast(`Couldn't start "${task.title}": ${errorMessage(error)}`, 'error');
            }
        },
        [apply, showToast]
    );

    /** Generate and attach an on-device summary of a just-parked context (best effort, silent on failure) */
    const attachSummary = useCallback(
        async (parked: Task, summarizer: Promise<Parameters<typeof summarizeContext>[0]>) => {
            const ctx = parked.context;
            if (!ctx?.parkedAt || ctx.tabs.length === 0) return;
            try {
                const summary = await summarizeContext(await summarizer, parked, ctx.tabs, ctx.resumeNote);
                if (!summary) return;
                apply(
                    await sendContextMessage(CONTEXT_MESSAGES.SET_SUMMARY, {
                        taskId: parked.id,
                        summary,
                        parkedAt: ctx.parkedAt,
                    })
                );
            } catch (error) {
                console.warn('On-device summary failed', error);
            }
        },
        [apply]
    );

    const park = useCallback(
        async (
            task: Task,
            options: Omit<ParkContextPayload, 'task'> = {},
            /** Started from the click that triggered the park (Chrome needs user activation) */
            summarizer?: Promise<Parameters<typeof summarizeContext>[0]>
        ) => {
            try {
                const response = await sendContextMessage(CONTEXT_MESSAGES.PARK, { task, ...options });
                apply(response);
                if (summarizer && response.task) attachSummary(response.task, summarizer);
                const settings = await readParkResumeSettings();
                if (settings.startPomodoroOnStart) pausePomodoroForTask(task.id);
                const saved = response.task?.context?.tabs.length ?? 0;
                showToast(`Parked "${task.title}" · ${pluralizeTabs(saved)} saved`, 'success');
            } catch (error) {
                showToast(`Couldn't park "${task.title}": ${errorMessage(error)}`, 'error');
            }
        },
        [apply, attachSummary, showToast]
    );

    /** Open the Park dialog (asks "where did you leave off?") */
    const requestPark = useCallback((task: Task) => openParkDialog(task.id), [openParkDialog]);

    const addCurrentTabs = useCallback(
        async (task: Task) => {
            const before = task.context?.tabs.length ?? 0;
            try {
                const response = await sendContextMessage(CONTEXT_MESSAGES.ADD_TABS, {
                    task,
                    windowId: await currentWindowId(),
                });
                apply(response);
                const after = response.task?.context?.tabs.length ?? before;
                showToast(
                    after > before
                        ? `Added ${pluralizeTabs(after - before)} to "${task.title}"`
                        : 'No new tabs to add (pinned, grouped and browser pages are skipped)',
                    after > before ? 'success' : 'info'
                );
            } catch (error) {
                showToast(`Couldn't add tabs: ${errorMessage(error)}`, 'error');
            }
        },
        [apply, showToast]
    );

    const removeTab = useCallback(
        async (task: Task, url: string) => {
            try {
                apply(await sendContextMessage(CONTEXT_MESSAGES.REMOVE_TAB, { task, url }));
            } catch (error) {
                showToast(`Couldn't remove tab: ${errorMessage(error)}`, 'error');
            }
        },
        [apply, showToast]
    );

    return { startOrResume, park, requestPark, addCurrentTabs, removeTab };
}
