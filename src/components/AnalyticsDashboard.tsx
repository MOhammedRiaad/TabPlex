import React, { useMemo } from 'react';
import { useBoardStore } from '../store/boardStore';
import { AnalyticsData, DomainStat } from '../types';
import './AnalyticsDashboard.css';

const AnalyticsDashboard: React.FC = () => {
    const { tabs, tasks, notes, sessions, history } = useBoardStore();

    const analytics = useMemo((): AnalyticsData => {
        // Calculate task statistics
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const pendingTasks = tasks.filter(t => t.status !== 'done').length;
        const taskCompletionRate = tasks.length > 0
            ? Math.round((completedTasks / tasks.length) * 100)
            : 0;

        // Calculate session duration
        const sessionsWithDuration = sessions.filter(s => s.endTime);
        const totalDuration = sessionsWithDuration.reduce((acc, session) => {
            if (session.endTime) {
                const start = new Date(session.startTime).getTime();
                const end = new Date(session.endTime).getTime();
                return acc + (end - start);
            }
            return acc;
        }, 0);
        const averageSessionDuration = sessionsWithDuration.length > 0
            ? totalDuration / sessionsWithDuration.length
            : 0;

        // Calculate most visited domains
        const domainCounts: Record<string, number> = {};
        [...tabs, ...history].forEach(item => {
            try {
                const url = new URL(item.url);
                const domain = url.hostname.replace('www.', '');
                domainCounts[domain] = (domainCounts[domain] || 0) + 1;
            } catch {
                // Invalid URL, skip
            }
        });

        const totalDomainVisits = Object.values(domainCounts).reduce((a, b) => a + b, 0);
        const mostVisitedDomains: DomainStat[] = Object.entries(domainCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([domain, count]) => ({
                domain,
                count,
                percentage: Math.round((count / totalDomainVisits) * 100),
            }));

        // Calculate activity by day (last 7 days)
        const activityByDay = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dayTabs = tabs.filter(t => {
                const created = new Date(t.createdAt);
                return created >= date && created < nextDay;
            }).length;

            const dayTasks = tasks.filter(t => {
                if (t.status !== 'done') return false;
                const updated = new Date(t.updatedAt);
                return updated >= date && updated < nextDay;
            }).length;

            const daySessions = sessions.filter(s => {
                const started = new Date(s.startTime);
                return started >= date && started < nextDay;
            }).length;

            activityByDay.push({
                date: date.toLocaleDateString('en-US', { weekday: 'short' }),
                tabsOpened: dayTabs,
                tasksCompleted: dayTasks,
                sessionsStarted: daySessions,
            });
        }


        // Calculate Top Focused Tasks
        const tasksWithSessions = tasks
            .filter(t => t.completedSessions && t.completedSessions > 0)
            .sort((a, b) => (b.completedSessions || 0) - (a.completedSessions || 0))
            .slice(0, 5);

        const topFocusedTasks = tasksWithSessions.map(t => {
            const sessions = t.completedSessions || 0;
            // Assuming default 25 min work duration for stored sessions if exact time not tracked per session on task
            // Ideally we'd sum real duration, but for now we multiply by standard 25 mins or get from settings if possible. 
            // We'll estimate 25 mins per session for now as specific session-task log isn't fully detailed in history yet.
            const totalMinutes = sessions * 25;

            // 8 hours = 480 minutes
            const workDayMinutes = 480;

            let timeString = '';
            if (totalMinutes >= workDayMinutes) {
                const days = (totalMinutes / workDayMinutes).toFixed(1);
                timeString = `${days} days`;
            } else if (totalMinutes >= 60) {
                const hours = (totalMinutes / 60).toFixed(1);
                timeString = `${hours} hrs`;
            } else {
                timeString = `${totalMinutes} mins`;
            }

            return {
                id: t.id,
                title: t.title,
                sessions,
                timeString
            };
        });

        const maxTaskSessions = topFocusedTasks.length > 0 ? topFocusedTasks[0].sessions : 1;

        return {
            totalTabs: tabs.length,
            totalTasks: tasks.length,
            totalNotes: notes.length,
            totalSessions: sessions.length,
            completedTasks,
            pendingTasks,
            averageSessionDuration,
            mostVisitedDomains,
            taskCompletionRate,
            activityByDay,
            topFocusedTasks,
            maxTaskSessions
        };
    }, [tabs, tasks, notes, sessions, history]);

    const formatDuration = (ms: number): string => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const getMaxActivity = () => {
        return Math.max(
            ...analytics.activityByDay.map(d =>
                Math.max(d.tabsOpened, d.tasksCompleted * 3, d.sessionsStarted * 2)
            ),
            1
        );
    };

    return (
        <div className="analytics-dashboard">
            <div className="analytics-header">
                <h2>📊 Analytics Dashboard</h2>
                <p className="analytics-subtitle">Your productivity at a glance</p>
            </div>

            {/* Summary Cards */}
            <div className="analytics-cards">
                <div className="analytics-card">
                    <div className="card-icon">🌐</div>
                    <div className="card-content">
                        <div className="card-value">{analytics.totalTabs}</div>
                        <div className="card-label">Total Tabs</div>
                    </div>
                </div>

                <div className="analytics-card">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                        <div className="card-value">{analytics.totalTasks}</div>
                        <div className="card-label">Total Tasks</div>
                    </div>
                </div>

                <div className="analytics-card">
                    <div className="card-icon">📝</div>
                    <div className="card-content">
                        <div className="card-value">{analytics.totalNotes}</div>
                        <div className="card-label">Total Notes</div>
                    </div>
                </div>

                <div className="analytics-card">
                    <div className="card-icon">⏱️</div>
                    <div className="card-content">
                        <div className="card-value">{analytics.totalSessions}</div>
                        <div className="card-label">Sessions</div>
                    </div>
                </div>
            </div>

            {/* Task Progress */}
            <div className="analytics-section">
                <h3>📋 Task Progress</h3>
                <div className="task-progress-container">
                    <div className="progress-stats">
                        <div className="progress-stat">
                            <span className="stat-value">{analytics.completedTasks}</span>
                            <span className="stat-label">Completed</span>
                        </div>
                        <div className="progress-stat">
                            <span className="stat-value">{analytics.pendingTasks}</span>
                            <span className="stat-label">Pending</span>
                        </div>
                        <div className="progress-stat">
                            <span className="stat-value">{analytics.taskCompletionRate}%</span>
                            <span className="stat-label">Completion Rate</span>
                        </div>
                    </div>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar"
                            style={{ width: `${analytics.taskCompletionRate}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Activity Chart */}
            <div className="analytics-section">
                <h3>📈 Weekly Activity</h3>
                <div className="activity-chart">
                    {analytics.activityByDay.map((day, index) => (
                        <div key={index} className="activity-day">
                            <div className="activity-bars">
                                <div
                                    className="activity-bar tabs"
                                    style={{
                                        height: `${(day.tabsOpened / getMaxActivity()) * 100}%`
                                    }}
                                    title={`${day.tabsOpened} tabs`}
                                />
                                <div
                                    className="activity-bar tasks"
                                    style={{
                                        height: `${((day.tasksCompleted * 3) / getMaxActivity()) * 100}%`
                                    }}
                                    title={`${day.tasksCompleted} tasks`}
                                />
                                <div
                                    className="activity-bar sessions"
                                    style={{
                                        height: `${((day.sessionsStarted * 2) / getMaxActivity()) * 100}%`
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

            {/* Top Domains */}
            <div className="analytics-section">
                <h3>🌍 Most Visited Domains</h3>
                <div className="domains-list">
                    {analytics.mostVisitedDomains.length > 0 ? (
                        analytics.mostVisitedDomains.map((domain, index) => (
                            <div key={domain.domain} className="domain-item">
                                <span className="domain-rank">#{index + 1}</span>
                                <span className="domain-name">{domain.domain}</span>
                                <div className="domain-bar-container">
                                    <div
                                        className="domain-bar"
                                        style={{ width: `${domain.percentage}%` }}
                                    />
                                </div>
                                <span className="domain-count">{domain.count}</span>
                            </div>
                        ))
                    ) : (
                        <p className="no-data">No domain data available</p>
                    )}
                </div>
            </div>

            {/* Task Focus Metrics */}
            <div className="analytics-section">
                <h3>🍅 Task Focus Metrics</h3>
                <div className="domains-list">
                    {analytics.topFocusedTasks.length > 0 ? (
                        analytics.topFocusedTasks.map((task, index) => (
                            <div key={task.id} className="domain-item">
                                <span className="domain-rank">#{index + 1}</span>
                                <span className="domain-name" title={task.title}>{task.title}</span>
                                <div className="domain-bar-container">
                                    <div
                                        className="domain-bar"
                                        style={{ width: `${(task.sessions / analytics.maxTaskSessions) * 100}%`, background: 'var(--color-warning)' }}
                                    />
                                </div>
                                <div className="focus-stats" style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
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

            {/* Session Stats */}
            <div className="analytics-section">
                <h3>⏰ Session Statistics</h3>
                <div className="session-stats">
                    <div className="session-stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-info">
                            <div className="stat-value">
                                {formatDuration(analytics.averageSessionDuration)}
                            </div>
                            <div className="stat-label">Average Session Duration</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
