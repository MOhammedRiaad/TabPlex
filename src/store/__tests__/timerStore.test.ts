import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerStore } from '../timerStore';

const timer = () => useTimerStore.getState();
const reset = () =>
    useTimerStore.setState({
        mode: 'work',
        activeMode: null,
        timeLeft: 25 * 60,
        isRunning: false,
        endTime: null,
        linkedTaskId: null,
        completedSessions: 0,
        remainingTime: { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
        settings: {
            workDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            longBreakInterval: 4,
            autoStartBreaks: false,
            autoStartWork: false,
            soundEnabled: true,
        },
    });

describe('timer store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000_000);
        reset();
    });
    afterEach(() => vi.useRealTimers());

    it('starts and pauses, tracking the end time', () => {
        timer().setIsRunning(true);
        expect(timer()).toMatchObject({ isRunning: true, activeMode: 'work', endTime: 1_000_000 + 25 * 60 * 1000 });
        timer().setIsRunning(false);
        expect(timer()).toMatchObject({ isRunning: false, endTime: null });
    });

    it('switches modes, remembering paused time per mode', () => {
        timer().setTimeLeft(600);
        timer().setMode('shortBreak');
        expect(timer().timeLeft).toBe(300);
        expect(timer().remainingTime.work).toBe(600);
        timer().setMode('work');
        expect(timer().timeLeft).toBe(600);
    });

    it('initialises an empty mode from settings', () => {
        useTimerStore.setState({ remainingTime: { work: 0, shortBreak: 0, longBreak: 0 } });
        timer().setMode('longBreak');
        expect(timer().timeLeft).toBe(15 * 60);
        timer().setMode('shortBreak');
        expect(timer().timeLeft).toBe(5 * 60);
        timer().setMode('work');
        expect(timer().timeLeft).toBe(25 * 60);
    });

    it('shows the live remaining time when switching back to the running mode', () => {
        timer().setIsRunning(true);
        timer().setMode('shortBreak');
        vi.setSystemTime(1_000_000 + 60_000);
        timer().setMode('work');
        expect(timer().timeLeft).toBe(25 * 60 - 60);
        expect(timer().isRunning).toBe(true);
    });

    it('saves the progress of the running mode when another mode starts', () => {
        timer().setIsRunning(true);
        vi.setSystemTime(1_000_000 + 120_000);
        timer().setMode('shortBreak');
        timer().setIsRunning(true);
        expect(timer().remainingTime.work).toBe(25 * 60 - 120);
        expect(timer().activeMode).toBe('shortBreak');

        // A running mode whose time has elapsed is saved as 0
        useTimerStore.setState({ mode: 'work', activeMode: 'longBreak', endTime: 1 });
        timer().setIsRunning(true);
        expect(timer().remainingTime.longBreak).toBe(0);
    });

    it('resets the current mode to its full duration', () => {
        for (const [mode, minutes] of [
            ['work', 25],
            ['shortBreak', 5],
            ['longBreak', 15],
        ] as const) {
            useTimerStore.setState({ mode, timeLeft: 1, isRunning: true, activeMode: mode });
            timer().resetTimer();
            expect(timer()).toMatchObject({ timeLeft: minutes * 60, isRunning: false, activeMode: null });
        }
    });

    it('syncs the visible time after a reload', () => {
        timer().setIsRunning(true);
        vi.setSystemTime(1_000_000 + 30_000);
        timer().syncTime();
        expect(timer().timeLeft).toBe(25 * 60 - 30);

        timer().setMode('shortBreak');
        timer().syncTime(); // viewing a different mode: unchanged
        expect(timer().timeLeft).toBe(300);

        vi.setSystemTime(1_000_000 + 26 * 60_000);
        timer().syncTime();
        expect(timer().timeLeft).toBe(0);

        reset();
        timer().syncTime(); // not running
        expect(timer().timeLeft).toBe(25 * 60);
    });

    it('updates settings, links tasks and counts sessions', () => {
        timer().updateSettings({ workDuration: 50 });
        timer().setLinkedTaskId('t1');
        timer().setCompletedSessions(3);
        expect(timer()).toMatchObject({ linkedTaskId: 't1', completedSessions: 3 });
        expect(timer().settings.workDuration).toBe(50);
        expect(timer().settings.shortBreakDuration).toBe(5);
    });
});
