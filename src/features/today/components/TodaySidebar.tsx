import React from 'react';
import { useNavigate } from 'react-router-dom';
import PomodoroTimer from '../../sessions/components/PomodoroTimer';
import '../TodayView.css';

const TodaySidebar: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="today-sidebar">
            <div className="sticky-timer">
                <PomodoroTimer />
                <button className="pomodoro-full-view-btn" onClick={() => navigate('/pomodoro')} type="button">
                    Open Full Pomodoro View
                </button>
            </div>
        </div>
    );
};

export default TodaySidebar;
