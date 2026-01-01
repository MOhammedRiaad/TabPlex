import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';
import { Task } from '../types';
import './PomodoroTimer.css';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerSettings {
    workDuration: number; // in minutes
    shortBreakDuration: number;
    longBreakDuration: number;
    longBreakInterval: number; // number of work sessions before long break
    autoStartBreaks: boolean;
    autoStartWork: boolean;
    soundEnabled: boolean;
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

const PomodoroTimer: React.FC = () => {
    const [settings, setSettings] = useState<TimerSettings>(() => {
        const saved = localStorage.getItem('pomodoro_settings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    });

    const [mode, setMode] = useState<TimerMode>('work');
    const [timeLeft, setTimeLeft] = useState(settings.workDuration * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [completedSessions, setCompletedSessions] = useState(0);
    const [linkedTask, setLinkedTask] = useState<Task | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showTaskPicker, setShowTaskPicker] = useState(false);

    const intervalRef = useRef<number | null>(null);

    const { tasks, updateTask } = useBoardStore();

    // Get active (doing) tasks
    const activeTasks = tasks.filter(t => t.status === 'doing' || t.status === 'todo');

    // Save settings to localStorage
    useEffect(() => {
        localStorage.setItem('pomodoro_settings', JSON.stringify(settings));
    }, [settings]);

    // Get duration based on mode
    const getDuration = useCallback((timerMode: TimerMode) => {
        switch (timerMode) {
            case 'work':
                return settings.workDuration * 60;
            case 'shortBreak':
                return settings.shortBreakDuration * 60;
            case 'longBreak':
                return settings.longBreakDuration * 60;
        }
    }, [settings]);

    // Timer tick
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = window.setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            handleTimerComplete();
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRunning, timeLeft]);

    // Play notification sound
    const playSound = useCallback(() => {
        if (settings.soundEnabled) {
            // Create a simple beep using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();

            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);

            // Play it 3 times
            setTimeout(() => playBeep(), 300);
            setTimeout(() => playBeep(), 600);
        }
    }, [settings.soundEnabled]);

    const playBeep = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();

            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);
        } catch (e) {
            console.log('Audio not supported');
        }
    };

    // Handle timer completion
    const handleTimerComplete = useCallback(() => {
        setIsRunning(false);
        playSound();

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = mode === 'work' ? '🍅 Work session complete!' : '☕ Break is over!';
            const body = mode === 'work'
                ? 'Time for a break!'
                : 'Ready to get back to work?';
            new Notification(title, { body });
        }

        if (mode === 'work') {
            const newCompletedSessions = completedSessions + 1;
            setCompletedSessions(newCompletedSessions);

            // Determine next break type
            const isLongBreak = newCompletedSessions % settings.longBreakInterval === 0;
            const nextMode = isLongBreak ? 'longBreak' : 'shortBreak';

            setMode(nextMode);
            setTimeLeft(getDuration(nextMode));

            if (settings.autoStartBreaks) {
                setIsRunning(true);
            }
        } else {
            setMode('work');
            setTimeLeft(getDuration('work'));

            if (settings.autoStartWork) {
                setIsRunning(true);
            }
        }
    }, [mode, completedSessions, settings, getDuration, playSound]);

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate progress percentage
    const progress = ((getDuration(mode) - timeLeft) / getDuration(mode)) * 100;

    // Control functions
    const startTimer = () => {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        setIsRunning(true);
    };

    const pauseTimer = () => setIsRunning(false);

    const resetTimer = () => {
        setIsRunning(false);
        setTimeLeft(getDuration(mode));
    };

    const switchMode = (newMode: TimerMode) => {
        setIsRunning(false);
        setMode(newMode);
        setTimeLeft(getDuration(newMode));
    };

    const linkTask = (task: Task) => {
        setLinkedTask(task);
        setShowTaskPicker(false);

        // Update task status to 'doing' if it's 'todo'
        if (task.status === 'todo') {
            updateTask(task.id, { status: 'doing' });
        }
    };

    const unlinkTask = () => {
        setLinkedTask(null);
    };

    const completeTask = () => {
        if (linkedTask) {
            updateTask(linkedTask.id, { status: 'done' });
            setLinkedTask(null);
        }
    };

    const updateSetting = <K extends keyof TimerSettings>(key: K, value: TimerSettings[K]) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            // Update time left if currently matching the changed setting
            if (key === 'workDuration' && mode === 'work' && !isRunning) {
                setTimeLeft(value as number * 60);
            } else if (key === 'shortBreakDuration' && mode === 'shortBreak' && !isRunning) {
                setTimeLeft(value as number * 60);
            } else if (key === 'longBreakDuration' && mode === 'longBreak' && !isRunning) {
                setTimeLeft(value as number * 60);
            }
            return newSettings;
        });
    };

    return (
        <div className="pomodoro-timer">
            <div className="timer-header">
                <h3>🍅 Pomodoro Timer</h3>
                <button
                    className="settings-btn"
                    onClick={() => setShowSettings(!showSettings)}
                    aria-label="Settings"
                >
                    ⚙️
                </button>
            </div>

            {/* Mode Tabs */}
            <div className="timer-modes">
                <button
                    className={`mode-btn ${mode === 'work' ? 'active' : ''}`}
                    onClick={() => switchMode('work')}
                >
                    Work
                </button>
                <button
                    className={`mode-btn ${mode === 'shortBreak' ? 'active' : ''}`}
                    onClick={() => switchMode('shortBreak')}
                >
                    Short Break
                </button>
                <button
                    className={`mode-btn ${mode === 'longBreak' ? 'active' : ''}`}
                    onClick={() => switchMode('longBreak')}
                >
                    Long Break
                </button>
            </div>

            {/* Timer Display */}
            <div className={`timer-display ${mode}`}>
                <div className="timer-circle">
                    <svg className="timer-svg" viewBox="0 0 100 100">
                        <circle
                            className="timer-bg-circle"
                            cx="50"
                            cy="50"
                            r="45"
                        />
                        <circle
                            className="timer-progress-circle"
                            cx="50"
                            cy="50"
                            r="45"
                            strokeDasharray={`${2 * Math.PI * 45}`}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                        />
                    </svg>
                    <div className="timer-time">{formatTime(timeLeft)}</div>
                </div>
            </div>

            {/* Controls */}
            <div className="timer-controls">
                {!isRunning ? (
                    <button className="control-btn start" onClick={startTimer}>
                        ▶️ Start
                    </button>
                ) : (
                    <button className="control-btn pause" onClick={pauseTimer}>
                        ⏸️ Pause
                    </button>
                )}
                <button className="control-btn reset" onClick={resetTimer}>
                    🔄 Reset
                </button>
            </div>

            {/* Session Counter */}
            <div className="session-counter">
                <span className="session-label">Completed Sessions:</span>
                <span className="session-count">{completedSessions}</span>
                <div className="session-dots">
                    {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
                        <span
                            key={i}
                            className={`session-dot ${i < (completedSessions % settings.longBreakInterval) ? 'filled' : ''}`}
                        />
                    ))}
                </div>
            </div>

            {/* Linked Task */}
            <div className="linked-task-section">
                {linkedTask ? (
                    <div className="linked-task">
                        <span className="task-label">Working on:</span>
                        <span className="task-title">{linkedTask.title}</span>
                        <div className="task-actions">
                            <button onClick={completeTask} className="complete-task-btn" title="Mark as done">
                                ✅
                            </button>
                            <button onClick={unlinkTask} className="unlink-btn" title="Unlink task">
                                ✕
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="link-task-btn"
                        onClick={() => setShowTaskPicker(!showTaskPicker)}
                    >
                        🔗 Link a Task
                    </button>
                )}

                {showTaskPicker && (
                    <div className="task-picker">
                        <div className="task-picker-header">
                            <span>Select a task to focus on:</span>
                            <button onClick={() => setShowTaskPicker(false)}>✕</button>
                        </div>
                        <div className="task-list">
                            {activeTasks.length > 0 ? (
                                activeTasks.map(task => (
                                    <button
                                        key={task.id}
                                        className="task-option"
                                        onClick={() => linkTask(task)}
                                    >
                                        <span className={`task-status ${task.status}`}>
                                            {task.status === 'doing' ? '🔄' : '📋'}
                                        </span>
                                        {task.title}
                                    </button>
                                ))
                            ) : (
                                <p className="no-tasks">No active tasks. Create one in Today view!</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="settings-panel">
                    <h4>Timer Settings</h4>

                    <div className="setting-row">
                        <label>Work Duration (min)</label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={settings.workDuration}
                            onChange={(e) => updateSetting('workDuration', parseInt(e.target.value) || 25)}
                        />
                    </div>

                    <div className="setting-row">
                        <label>Short Break (min)</label>
                        <input
                            type="number"
                            min="1"
                            max="30"
                            value={settings.shortBreakDuration}
                            onChange={(e) => updateSetting('shortBreakDuration', parseInt(e.target.value) || 5)}
                        />
                    </div>

                    <div className="setting-row">
                        <label>Long Break (min)</label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={settings.longBreakDuration}
                            onChange={(e) => updateSetting('longBreakDuration', parseInt(e.target.value) || 15)}
                        />
                    </div>

                    <div className="setting-row">
                        <label>Sessions until Long Break</label>
                        <input
                            type="number"
                            min="2"
                            max="10"
                            value={settings.longBreakInterval}
                            onChange={(e) => updateSetting('longBreakInterval', parseInt(e.target.value) || 4)}
                        />
                    </div>

                    <div className="setting-row checkbox-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.autoStartBreaks}
                                onChange={(e) => updateSetting('autoStartBreaks', e.target.checked)}
                            />
                            Auto-start Breaks
                        </label>
                    </div>

                    <div className="setting-row checkbox-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.autoStartWork}
                                onChange={(e) => updateSetting('autoStartWork', e.target.checked)}
                            />
                            Auto-start Work Sessions
                        </label>
                    </div>

                    <div className="setting-row checkbox-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.soundEnabled}
                                onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
                            />
                            Sound Notifications
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PomodoroTimer;
