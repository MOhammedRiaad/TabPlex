import React, { useMemo } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { AnalyticsData, DomainStat } from '../../types';
import './AnalyticsDashboard.css';
import AnalyticsSummaryCards from './components/AnalyticsSummaryCards';
import TaskCompletionWidget from './components/TaskCompletionWidget';
import ActivityChart from './components/ActivityChart';
import DomainList from './components/DomainList';
import FocusMetrics from './components/FocusMetrics';
import SessionStats from './components/SessionStats';

const AnalyticsDashboard: React.FC = () => {
    const { tabs, tasks, notes, sessions, history } = useBoardStore();

    const analytics = useMemo((): AnalyticsData => {
        // Calculate task statistics
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const pendingTasks = tasks.filter(t => t.status !== 'done').length;
        const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

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
        const averageSessionDuration =
            sessionsWithDuration.length > 0 ? totalDuration / sessionsWithDuration.length : 0;

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
                timeString,
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
            maxTaskSessions,
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

    return (
        <div className="analytics-dashboard">
            <div className="analytics-header">
                <h2>📊 Analytics Dashboard</h2>
                <p className="analytics-subtitle">Your productivity at a glance</p>
            </div>

            <AnalyticsSummaryCards
                totalTabs={analytics.totalTabs}
                totalTasks={analytics.totalTasks}
                totalNotes={analytics.totalNotes}
                totalSessions={analytics.totalSessions}
            />

            <TaskCompletionWidget
                completedTasks={analytics.completedTasks}
                pendingTasks={analytics.pendingTasks}
                completionRate={analytics.taskCompletionRate}
            />

            <ActivityChart activityByDay={analytics.activityByDay} />

            <DomainList mostVisitedDomains={analytics.mostVisitedDomains} />

            <FocusMetrics topFocusedTasks={analytics.topFocusedTasks} maxTaskSessions={analytics.maxTaskSessions} />

            <SessionStats averageSessionDuration={analytics.averageSessionDuration} formatDuration={formatDuration} />
        </div>
    );
};

export default AnalyticsDashboard;
