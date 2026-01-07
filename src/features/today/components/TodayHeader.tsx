import React from 'react';
import { useTimerStore } from '../../../store/timerStore';
import '../TodayView.css';

interface TodayHeaderProps {
    showTimer: boolean;
    onToggleTimer: () => void;
    formatTime: (seconds: number) => string;
}

const TodayHeader: React.FC<TodayHeaderProps> = ({ showTimer, onToggleTimer, formatTime }) => {
    const { timeLeft, isRunning, mode, activeMode, setIsRunning, resetTimer, settings } = useTimerStore();
    const isCurrentModeRunning = isRunning && mode === activeMode;

    // Filter tasks for today (Date logic handles in parent, but header just displays date)
    const today = new Date();

    return (
        <div className="today-header">
            <div className="header-content">
                <h2>Today&apos;s Tasks & Notes</h2>
                <div className="today-date">
                    {today.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </div>
            </div>
            <div className="header-actions">
                {!showTimer && (isCurrentModeRunning || timeLeft < settings.workDuration * 60) && (
                    <div className="mini-timer">
                        <span className={`mini-time ${isCurrentModeRunning ? 'running' : 'paused'}`}>
                            {formatTime(timeLeft)}
                        </span>
                        <button
                            className="mini-control-btn"
                            onClick={e => {
                                e.stopPropagation();
                                isCurrentModeRunning ? setIsRunning(false) : setIsRunning(true);
                            }}
                            title={isCurrentModeRunning ? 'Pause' : 'Resume'}
                        >
                            {isCurrentModeRunning ? '⏸️' : '▶️'}
                        </button>
                        <button
                            className="mini-control-btn"
                            onClick={e => {
                                e.stopPropagation();
                                resetTimer();
                            }}
                            title="Reset"
                        >
                            🔄
                        </button>
                    </div>
                )}
                <button
                    className={`toggle-timer-btn ${showTimer ? 'active' : ''}`}
                    onClick={onToggleTimer}
                    title="Toggle Focus Timer"
                >
                    {showTimer ? 'Hide Timer ⏱️' : 'Focus Timer ⏱️'}
                </button>
            </div>
        </div>
    );
};

export default TodayHeader;
