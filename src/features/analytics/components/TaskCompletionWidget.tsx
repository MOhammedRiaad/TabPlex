import React from 'react';
import '../AnalyticsDashboard.css';

interface TaskCompletionWidgetProps {
    completedTasks: number;
    pendingTasks: number;
    completionRate: number;
}

const TaskCompletionWidget: React.FC<TaskCompletionWidgetProps> = ({
    completedTasks,
    pendingTasks,
    completionRate,
}) => {
    return (
        <div className="analytics-section">
            <h3>📋 Task Progress</h3>
            <div className="task-progress-container">
                <div className="progress-stats">
                    <div className="progress-stat">
                        <span className="stat-value">{completedTasks}</span>
                        <span className="stat-label">Completed</span>
                    </div>
                    <div className="progress-stat">
                        <span className="stat-value">{pendingTasks}</span>
                        <span className="stat-label">Pending</span>
                    </div>
                    <div className="progress-stat">
                        <span className="stat-value">{completionRate}%</span>
                        <span className="stat-label">Completion Rate</span>
                    </div>
                </div>
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${completionRate}%` }} />
                </div>
            </div>
        </div>
    );
};

export default TaskCompletionWidget;
