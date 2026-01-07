import React from 'react';
import '../AnalyticsDashboard.css';

interface SessionStatsProps {
    averageSessionDuration: number;
    formatDuration: (ms: number) => string;
}

const SessionStats: React.FC<SessionStatsProps> = ({ averageSessionDuration, formatDuration }) => {
    return (
        <div className="analytics-section">
            <h3>⏰ Session Statistics</h3>
            <div className="session-stats">
                <div className="session-stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-info">
                        <div className="stat-value">{formatDuration(averageSessionDuration)}</div>
                        <div className="stat-label">Average Session Duration</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionStats;
