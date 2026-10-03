import { beforeEach, describe, expect, it } from 'vitest';
import { useTimerStore } from '../../../../store/timerStore';
import { pausePomodoroForTask, startPomodoroForTask } from '../pomodoroLink';

describe('pomodoroLink', () => {
    beforeEach(() => {
        useTimerStore.setState({
            mode: 'work',
            activeMode: null,
            isRunning: false,
            endTime: null,
            linkedTaskId: null,
            timeLeft: 25 * 60,
        });
    });

    it('links the timer and starts a work session', () => {
        useTimerStore.setState({ mode: 'shortBreak', timeLeft: 0 });
        expect(startPomodoroForTask('t1')).toBe(true);
        const state = useTimerStore.getState();
        expect(state.linkedTaskId).toBe('t1');
        expect(state.isRunning).toBe(true);
        expect(state.activeMode).toBe('work');
        expect(state.timeLeft).toBeGreaterThan(0);
    });

    it('only relinks when a timer is already running', () => {
        useTimerStore.getState().setIsRunning(true);
        const endTime = useTimerStore.getState().endTime;
        expect(startPomodoroForTask('t2')).toBe(false);
        expect(useTimerStore.getState().linkedTaskId).toBe('t2');
        expect(useTimerStore.getState().endTime).toBe(endTime);
    });

    it('pauses only the linked running work session', () => {
        startPomodoroForTask('t1');
        expect(pausePomodoroForTask('other')).toBe(false);
        expect(pausePomodoroForTask('t1')).toBe(true);
        expect(useTimerStore.getState().isRunning).toBe(false);
        expect(pausePomodoroForTask('t1')).toBe(false);
    });
});
