import React from 'react';
import '../AnalyticsDashboard.css';

interface AnalyticsSummaryCardsProps {
    totalTabs: number;
    totalTasks: number;
    totalNotes: number;
    totalSessions: number;
}

const AnalyticsSummaryCards: React.FC<AnalyticsSummaryCardsProps> = ({
    totalTabs,
    totalTasks,
    totalNotes,
    totalSessions,
}) => {
    return (
        <div className="analytics-cards">
            <div className="analytics-card">
                <div className="card-icon">🌐</div>
                <div className="card-content">
                    <div className="card-value">{totalTabs}</div>
                    <div className="card-label">Total Tabs</div>
                </div>
            </div>

            <div className="analytics-card">
                <div className="card-icon">✅</div>
                <div className="card-content">
                    <div className="card-value">{totalTasks}</div>
                    <div className="card-label">Total Tasks</div>
                </div>
            </div>

            <div className="analytics-card">
                <div className="card-icon">📝</div>
                <div className="card-content">
                    <div className="card-value">{totalNotes}</div>
                    <div className="card-label">Total Notes</div>
                </div>
            </div>

            <div className="analytics-card">
                <div className="card-icon">⏱️</div>
                <div className="card-content">
                    <div className="card-value">{totalSessions}</div>
                    <div className="card-label">Sessions</div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsSummaryCards;
