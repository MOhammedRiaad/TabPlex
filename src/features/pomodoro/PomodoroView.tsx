import React from 'react';
import { useNavigate } from 'react-router-dom';
import PomodoroTimer from '../sessions/components/PomodoroTimer';
import './PomodoroView.css';

const PomodoroView: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="pomodoro-view">
            <button className="back-to-today-btn" onClick={() => navigate('/today')} type="button">
                ← Back to Today
            </button>
            <div className="pomodoro-view-header">
                <h1 className="pomodoro-view-title">🍅 Pomodoro Timer</h1>
                <p className="pomodoro-view-subtitle">Focus and productivity timer</p>
            </div>
            <div className="pomodoro-view-content">
                <PomodoroTimer />
            </div>
        </div>
    );
};

export default PomodoroView;
