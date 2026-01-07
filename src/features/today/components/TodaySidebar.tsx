import React from 'react';
import PomodoroTimer from '../../sessions/components/PomodoroTimer';
import '../TodayView.css';

const TodaySidebar: React.FC = () => {
    return (
        <div className="today-sidebar">
            <div className="sticky-timer">
                <PomodoroTimer />
            </div>
        </div>
    );
};

export default TodaySidebar;
