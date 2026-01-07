import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    longBreakInterval: number;
    autoStartBreaks: boolean;
    autoStartWork: boolean;
    soundEnabled: boolean;
}

interface TimerState {
    mode: TimerMode;
    activeMode: TimerMode | null; // The mode that is currently running (if any)
    timeLeft: number;
    isRunning: boolean;
    endTime: number | null; // For persistence check
    linkedTaskId: string | null;
    settings: TimerSettings;
    completedSessions: number;
    remainingTime: Record<TimerMode, number>; // Persist time per mode

    // Actions
    setMode: (mode: TimerMode) => void;
    setTimeLeft: (time: number) => void;
    setIsRunning: (isRunning: boolean) => void;
    setLinkedTaskId: (id: string | null) => void;
    updateSettings: (settings: Partial<TimerSettings>) => void;
    setCompletedSessions: (count: number) => void;
    resetTimer: () => void;

    // Helper to sync time if page reloaded
    syncTime: () => void;
}

const DEFAULT_SETTINGS: TimerSettings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
    autoStartWork: false,
    soundEnabled: true,
};

export const useTimerStore = create<TimerState>()(
    persist(
        (set, get) => ({
            mode: 'work',
            activeMode: null,
            timeLeft: 25 * 60,
            isRunning: false,
            endTime: null,
            linkedTaskId: null,
            settings: DEFAULT_SETTINGS,
            completedSessions: 0,
            remainingTime: {
                work: 25 * 60,
                shortBreak: 5 * 60,
                longBreak: 15 * 60,
            },

            setMode: newMode => {
                const state = get();
                const { activeMode, isRunning, endTime } = state;

                // 1. Save current state of the OLD mode (if it's not the running one)
                // If it IS the running one, we rely on endTime, no need to save static timeLeft yet.
                const updatedRemaining = { ...state.remainingTime };

                if (state.mode !== activeMode) {
                    updatedRemaining[state.mode] = state.timeLeft;
                }

                // 2. Prepare new time
                let nextTime = updatedRemaining[newMode];

                // Initialize if 0/empty
                if (!nextTime) {
                    if (newMode === 'work') nextTime = state.settings.workDuration * 60;
                    else if (newMode === 'shortBreak') nextTime = state.settings.shortBreakDuration * 60;
                    else if (newMode === 'longBreak') nextTime = state.settings.longBreakDuration * 60;
                    updatedRemaining[newMode] = nextTime;
                }

                // 3. Check if we are switching TO the running mode
                if (isRunning && newMode === activeMode && endTime) {
                    const now = Date.now();
                    const remaining = Math.ceil((endTime - now) / 1000);
                    if (remaining > 0) nextTime = remaining;
                }

                set({
                    mode: newMode,
                    timeLeft: nextTime,
                    remainingTime: updatedRemaining,
                    // Do NOT touch isRunning or endTime.
                    // If isRunning was true, it stays true (background).
                });
            },

            setTimeLeft: timeLeft => set({ timeLeft }),

            setIsRunning: isRunning => {
                const state = get();
                if (isRunning) {
                    const now = Date.now();

                    // IF we are starting a NEW mode (clobbering old running timer):
                    // Save the old active timer's progress!
                    if (state.activeMode && state.activeMode !== state.mode && state.endTime) {
                        const remaining = Math.ceil((state.endTime - now) / 1000);
                        const updatedRemaining = { ...state.remainingTime };
                        updatedRemaining[state.activeMode] = remaining > 0 ? remaining : 0;
                        // Optimization: could just update remainingTime here
                        set({ remainingTime: updatedRemaining });
                    }

                    // START: Set activeMode to current mode
                    set({
                        isRunning: true,
                        activeMode: state.mode,
                        endTime: now + state.timeLeft * 1000,
                    });
                } else {
                    set({ isRunning: false, endTime: null });
                    // activeMode can remain as "last active" or be cleared?
                    // Better to not clear it so we know which one was paused?
                    // But for "single timer" logic, pausing just means no timer running.
                }
            },

            setLinkedTaskId: id => set({ linkedTaskId: id }),

            updateSettings: newSettings =>
                set(state => ({
                    settings: { ...state.settings, ...newSettings },
                })),

            setCompletedSessions: count => set({ completedSessions: count }),

            resetTimer: () => {
                const { mode, settings, remainingTime } = get();
                let duration = settings.workDuration * 60;
                if (mode === 'shortBreak') duration = settings.shortBreakDuration * 60;
                if (mode === 'longBreak') duration = settings.longBreakDuration * 60;

                const updatedRemaining = { ...remainingTime };
                updatedRemaining[mode] = duration;

                set({
                    timeLeft: duration,
                    isRunning: false,
                    endTime: null,
                    activeMode: null, // Reset clears active status
                    remainingTime: updatedRemaining,
                });
            },

            syncTime: () => {
                const { isRunning, endTime, mode, activeMode } = get();
                if (isRunning && endTime && activeMode) {
                    const now = Date.now();
                    const diffSeconds = Math.ceil((endTime - now) / 1000);

                    if (diffSeconds <= 0) {
                        // handled by TimerManager usually
                        set({ timeLeft: 0 });
                    } else {
                        // Only update timeLeft if we are viewing the active mode
                        if (mode === activeMode) {
                            set({ timeLeft: diffSeconds });
                        }
                    }
                }
            },
        }),
        {
            name: 'pomodoro-storage',
        }
    )
);
