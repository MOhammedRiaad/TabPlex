import { useTimerStore } from '../../../store/timerStore';

/** Link the Pomodoro timer to a task and start a work session (unless one is already running) */
export function startPomodoroForTask(taskId: string): boolean {
    const timer = useTimerStore.getState();
    timer.setLinkedTaskId(taskId);
    if (timer.isRunning) return false;
    if (timer.mode !== 'work') timer.setMode('work');
    if (useTimerStore.getState().timeLeft <= 0) timer.resetTimer();
    useTimerStore.getState().setIsRunning(true);
    return true;
}

/** Pause the timer if it is running a work session for this task */
export function pausePomodoroForTask(taskId: string): boolean {
    const timer = useTimerStore.getState();
    if (timer.linkedTaskId !== taskId || !timer.isRunning || timer.activeMode !== 'work') return false;
    timer.setIsRunning(false);
    return true;
}
