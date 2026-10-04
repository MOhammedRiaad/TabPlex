import React from 'react';
import { useDisplayName } from '../../settings/hooks/useDisplayName';
import '../TodayView.css';

const TodayHeader: React.FC = () => {
    // Set in Settings → Profile; no Chrome identity permission needed
    const userName = useDisplayName();
    const today = new Date();
    const hour = today.getHours();

    let greeting = 'Good Morning';
    if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
    else if (hour >= 17) greeting = 'Good Evening';

    return (
        <div className="today-header">
            <div className="header-content">
                <h2 className="greeting">
                    {greeting}
                    {userName ? `, ${userName}` : ''}
                </h2>
                <div className="today-date">
                    {today.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </div>
            </div>
        </div>
    );
};

export default TodayHeader;
