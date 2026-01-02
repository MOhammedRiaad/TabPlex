import { create } from 'zustand';
import { persist } from 'zustand/middleware';


type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerSettings {
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
    timeLeft: number;
    isRunning: boolean;
    endTime: number | null; // For persistence check
    linkedTaskId: string | null;
    settings: TimerSettings;
    completedSessions: number;

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
            timeLeft: 25 * 60,
            isRunning: false,
            endTime: null,
            linkedTaskId: null,
            settings: DEFAULT_SETTINGS,
            completedSessions: 0,

            setMode: (mode) => {
                const { settings } = get();
                let duration = settings.workDuration * 60;
                if (mode === 'shortBreak') duration = settings.shortBreakDuration * 60;
                if (mode === 'longBreak') duration = settings.longBreakDuration * 60;

                set({
                    mode,
                    timeLeft: duration,
                    isRunning: false,
                    endTime: null
                });
            },

            setTimeLeft: (timeLeft) => set({ timeLeft }),

            setIsRunning: (isRunning) => {
                if (isRunning) {
                    // Calculate expected end time based on current timeLeft
                    const now = Date.now();
                    const { timeLeft } = get();
                    set({ isRunning: true, endTime: now + (timeLeft * 1000) });
                } else {
                    set({ isRunning: false, endTime: null });
                }
            },

            setLinkedTaskId: (id) => set({ linkedTaskId: id }),

            updateSettings: (newSettings) => set((state) => ({
                settings: { ...state.settings, ...newSettings }
            })),

            setCompletedSessions: (count) => set({ completedSessions: count }),

            resetTimer: () => {
                const { mode, settings } = get();
                let duration = settings.workDuration * 60;
                if (mode === 'shortBreak') duration = settings.shortBreakDuration * 60;
                if (mode === 'longBreak') duration = settings.longBreakDuration * 60;

                set({
                    timeLeft: duration,
                    isRunning: false,
                    endTime: null
                });
            },

            syncTime: () => {
                const { isRunning, endTime } = get();
                if (isRunning && endTime) {
                    const now = Date.now();
                    const diffSeconds = Math.ceil((endTime - now) / 1000);

                    if (diffSeconds <= 0) {
                        set({ timeLeft: 0 }); // Timer finished while away
                    } else {
                        set({ timeLeft: diffSeconds });
                    }
                }
            }
        }),
        {
            name: 'pomodoro-storage',
        }
    )
);
