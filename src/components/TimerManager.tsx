import React, { useEffect, useRef } from 'react';
import { useTimerStore } from '../store/timerStore';
import { useBoardStore } from '../store/boardStore';

const TimerManager: React.FC = () => {
    const {
        isRunning,
        timeLeft,
        mode,
        settings,
        completedSessions,
        linkedTaskId,
        setTimeLeft,
        setIsRunning,
        setMode,
        setCompletedSessions,
        syncTime
    } = useTimerStore();

    const { updateTask } = useBoardStore();
    const intervalRef = useRef<number | null>(null);

    // Sync time on mount (handle refresh)
    useEffect(() => {
        syncTime();
    }, [syncTime]);

    // Handle Tick
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = window.setInterval(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
        } else if (isRunning && timeLeft <= 0) {
            handleTimerComplete();
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, timeLeft, setTimeLeft]);

    const handleTimerComplete = () => {
        setIsRunning(false);
        playNotificationSound();
        sendBrowserNotification();

        if (mode === 'work') {
            const newCompletedSessions = completedSessions + 1;
            setCompletedSessions(newCompletedSessions);

            // Update Linked Task Stats
            if (linkedTaskId) {
                updateLinkedTaskStats();
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

    const updateLinkedTaskStats = () => {
        // We need to fetch the task to get current count, or just increment
        // Since we use a store, let's find it 
        const { tasks } = useBoardStore.getState();
        const task = tasks.find(t => t.id === linkedTaskId);
        if (task) {
            updateTask(task.id, {
                completedSessions: (task.completedSessions || 0) + 1
            });
        }
    };

    const playNotificationSound = () => {
        if (!settings.soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
            setTimeout(() => { ctx.close() }, 300);
        } catch (e) { console.error(e); }
    };

    const sendBrowserNotification = () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = mode === 'work' ? '🍅 Work session complete!' : '☕ Break is over!';
            new Notification(title);
        }
    };

    return null; // Headless component
};

export default TimerManager;
