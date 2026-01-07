import React from 'react';
import '../AnalyticsDashboard.css';

interface ActivityData {
    date: string;
    tabsOpened: number;
    tasksCompleted: number;
    sessionsStarted: number;
}

interface ActivityChartProps {
    activityByDay: ActivityData[];
}

const ActivityChart: React.FC<ActivityChartProps> = ({ activityByDay }) => {
    const getMaxActivity = () => {
        return Math.max(
            ...activityByDay.map(d => Math.max(d.tabsOpened, d.tasksCompleted * 3, d.sessionsStarted * 2)),
            1
        );
    };

    const maxActivity = getMaxActivity();

    return (
        <div className="analytics-section">
            <h3>📈 Weekly Activity</h3>
            <div className="activity-chart">
                {activityByDay.map((day, index) => (
                    <div key={index} className="activity-day">
                        <div className="activity-bars">
                            <div
                                className="activity-bar tabs"
                                style={{
                                    height: `${(day.tabsOpened / maxActivity) * 100}%`,
                                }}
                                title={`${day.tabsOpened} tabs`}
                            />
                            <div
                                className="activity-bar tasks"
                                style={{
                                    height: `${((day.tasksCompleted * 3) / maxActivity) * 100}%`,
                                }}
                                title={`${day.tasksCompleted} tasks`}
                            />
                            <div
                                className="activity-bar sessions"
                                style={{
                                    height: `${((day.sessionsStarted * 2) / maxActivity) * 100}%`,
                                }}
                                title={`${day.sessionsStarted} sessions`}
                            />
                        </div>
                        <div className="activity-label">{day.date}</div>
                    </div>
                ))}
            </div>
            <div className="activity-legend">
                <div className="legend-item">
                    <span className="legend-color tabs" />
                    <span>Tabs</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color tasks" />
                    <span>Tasks</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color sessions" />
                    <span>Sessions</span>
                </div>
            </div>
        </div>
    );
};

export default ActivityChart;
