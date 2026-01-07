import React from 'react';
import '../AnalyticsDashboard.css';

interface TopTask {
    id: string;
    title: string;
    sessions: number;
    timeString: string;
}

interface FocusMetricsProps {
    topFocusedTasks: TopTask[];
    maxTaskSessions: number;
}

const FocusMetrics: React.FC<FocusMetricsProps> = ({ topFocusedTasks, maxTaskSessions }) => {
    return (
        <div className="analytics-section">
            <h3>🍅 Task Focus Metrics</h3>
            <div className="domains-list">
                {topFocusedTasks.length > 0 ? (
                    topFocusedTasks.map((task, index) => (
                        <div key={task.id} className="domain-item">
                            <span className="domain-rank">#{index + 1}</span>
                            <span className="domain-name" title={task.title}>
                                {task.title}
                            </span>
                            <div className="domain-bar-container">
                                <div
                                    className="domain-bar"
                                    style={{
                                        width: `${(task.sessions / maxTaskSessions) * 100}%`,
                                        background: 'var(--color-warning)',
                                    }}
                                />
                            </div>
                            <div
                                className="focus-stats"
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    fontSize: '13px',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                <span>{task.sessions} sess.</span>
                                <span>{task.timeString}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="no-data">No focus sessions recorded on tasks yet.</p>
                )}
            </div>
        </div>
    );
};

export default FocusMetrics;
