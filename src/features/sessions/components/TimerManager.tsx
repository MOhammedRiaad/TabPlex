import React, { useEffect, useRef } from 'react';
import { useTimerStore, TimerSettings } from '../../../store/timerStore';
import { useBoardStore } from '../../../store/boardStore';

const TimerManager: React.FC = () => {
    const syncTime = useTimerStore(state => state.syncTime);

    const { updateTask } = useBoardStore();
    const intervalRef = useRef<number | null>(null);

    // Sync time on mount (handle refresh)
    useEffect(() => {
        syncTime();
    }, [syncTime]);

    // Handle Tick
    useEffect(() => {
        intervalRef.current = window.setInterval(() => {
            const { isRunning, endTime, mode, activeMode, setTimeLeft } = useTimerStore.getState();

            if (isRunning && endTime) {
                const now = Date.now();
                const diff = Math.ceil((endTime - now) / 1000);

                if (diff <= 0) {
                    handleTimerComplete();
                } else {
                    // Only update UI if we are viewing the active running timer
                    if (mode === activeMode) {
                        setTimeLeft(diff);
                    }
                }
            }
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const handleTimerComplete = () => {
        const { mode, settings, completedSessions, linkedTaskId, setIsRunning, setMode, setCompletedSessions } =
            useTimerStore.getState();

        setIsRunning(false);
        playNotificationSound(settings);
        sendBrowserNotification(mode);

        if (mode === 'work') {
            const newCompletedSessions = completedSessions + 1;
            setCompletedSessions(newCompletedSessions);

            // Update Linked Task Stats
            if (linkedTaskId) {
                updateLinkedTaskStats(linkedTaskId);
            }

            // Next Mode
            const isLongBreak = newCompletedSessions % settings.longBreakInterval === 0;
            const nextMode = isLongBreak ? 'longBreak' : 'shortBreak';
            setMode(nextMode);

            if (settings.autoStartBreaks) setIsRunning(true);
        } else {
            setMode('work');
            if (settings.autoStartWork) setIsRunning(true);
        }
    };

    const updateLinkedTaskStats = (taskId: string) => {
        // We need to fetch the task to get current count, or just increment
        const { tasks } = useBoardStore.getState();
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            updateTask(task.id, {
                completedSessions: (task.completedSessions || 0) + 1,
            });
        }
    };

    // Need to pass settings since we are static now
    const playNotificationSound = (settings: TimerSettings) => {
        if (!settings.soundEnabled) return;
        try {
            const ctx = new (
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            )();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
            setTimeout(() => {
                ctx.close();
            }, 300);
        } catch (e) {
            console.error(e);
        }
    };

    const sendBrowserNotification = (mode: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = mode === 'work' ? '🍅 Work session complete!' : '☕ Break is over!';
            new Notification(title);
        }
    };

    return null; // Headless component
};

export default TimerManager;
