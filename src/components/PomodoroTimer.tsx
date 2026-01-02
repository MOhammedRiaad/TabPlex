import React, { useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useTimerStore } from '../store/timerStore';
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



const PomodoroTimer: React.FC = () => {
    const {
        mode,
        timeLeft,
        isRunning,
        completedSessions,
        linkedTaskId,
        settings,
        setMode,
        setIsRunning,
        resetTimer,
        setLinkedTaskId,
        updateSettings
    } = useTimerStore();

    const [showSettings, setShowSettings] = useState(false);
    const [showTaskPicker, setShowTaskPicker] = useState(false);

    const { tasks, updateTask } = useBoardStore();

    // Get active (doing) tasks
    const activeTasks = tasks.filter(t => t.status === 'doing' || t.status === 'todo');
    const linkedTask = linkedTaskId ? tasks.find(t => t.id === linkedTaskId) : null;

    // Format time as MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate progress percentage
    const getDuration = (m: TimerMode) => {
        switch (m) {
            case 'work': return settings.workDuration * 60;
            case 'shortBreak': return settings.shortBreakDuration * 60;
            case 'longBreak': return settings.longBreakDuration * 60;
        }
    };
    const maxDuration = getDuration(mode);
    const progress = ((maxDuration - timeLeft) / maxDuration) * 100;

    // Control functions
    const startTimer = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        setIsRunning(true);
    };

    const pauseTimer = () => setIsRunning(false);

    const linkTask = (task: Task) => {
        setLinkedTaskId(task.id);
        setShowTaskPicker(false);
        if (task.status === 'todo') {
            updateTask(task.id, { status: 'doing' });
        }
    };

    const unlinkTask = () => setLinkedTaskId(null);

    const completeTask = () => {
        if (linkedTask) {
            updateTask(linkedTask.id, { status: 'done' });
            setLinkedTaskId(null);
        }
    };

    const handleSettingChange = <K extends keyof TimerSettings>(key: K, value: TimerSettings[K]) => {
        updateSettings({ [key]: value });
        // Notes: The store handles resetting time if needed, or we might need to trigger visual updates?
        // Actually, the current persistent store implementation doesn't auto-reset time when settings change unless we tell it to.
        // But for UX, let's leave it as is. If user changes duration mid-timer, it might be weird.
        // Let's assume user changes settings when stopped.
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
                    onClick={() => setMode('work')}
                >
                    Work
                </button>
                <button
                    className={`mode-btn ${mode === 'shortBreak' ? 'active' : ''}`}
                    onClick={() => setMode('shortBreak')}
                >
                    Short Break
                </button>
                <button
                    className={`mode-btn ${mode === 'longBreak' ? 'active' : ''}`}
                    onClick={() => setMode('longBreak')}
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
                            onChange={(e) => handleSettingChange('workDuration', parseInt(e.target.value) || 25)}
                        />
                    </div>

                    <div className="setting-row">
                        <label>Short Break (min)</label>
                        <input
                            type="number"
                            min="1"
                            max="30"
                            value={settings.shortBreakDuration}
                            onChange={(e) => handleSettingChange('shortBreakDuration', parseInt(e.target.value) || 5)}
                        />
                    </div>

                    <div className="setting-row">
                        <label>Long Break (min)</label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={settings.longBreakDuration}
                            onChange={(e) => handleSettingChange('longBreakDuration', parseInt(e.target.value) || 15)}
                        />
                    </div>

                    <div className="setting-row">
                        <label>Sessions until Long Break</label>
                        <input
                            type="number"
                            min="2"
                            max="10"
                            value={settings.longBreakInterval}
                            onChange={(e) => handleSettingChange('longBreakInterval', parseInt(e.target.value) || 4)}
                        />
                    </div>

                    <div className="setting-row checkbox-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.autoStartBreaks}
                                onChange={(e) => handleSettingChange('autoStartBreaks', e.target.checked)}
                            />
                            Auto-start Breaks
                        </label>
                    </div>

                    <div className="setting-row checkbox-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.autoStartWork}
                                onChange={(e) => handleSettingChange('autoStartWork', e.target.checked)}
                            />
                            Auto-start Work Sessions
                        </label>
                    </div>

                    <div className="setting-row checkbox-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.soundEnabled}
                                onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
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
