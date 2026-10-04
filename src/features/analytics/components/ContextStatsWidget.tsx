import React from 'react';
import { ContextStats, formatParkedDuration } from '../utils/contextStats';
import '../AnalyticsDashboard.css';

interface ContextStatsWidgetProps {
    stats: ContextStats;
}

/** Park & Resume: how often you switched context and what it saved (last 7 days) */
const ContextStatsWidget: React.FC<ContextStatsWidgetProps> = ({ stats }) => {
    const hasActivity = stats.parks > 0 || stats.resumes > 0 || stats.currentlyParked > 0;

    return (
        <div className="analytics-section">
            <h3>⏸ Park &amp; Resume · last 7 days</h3>
            {hasActivity ? (
                <>
                    <p className="context-stats-headline">
                        You resumed {stats.resumes} context{stats.resumes === 1 ? '' : 's'} this week
                        {stats.tabsFreed > 0 && (
                            <>
                                {' '}
                                and closed {stats.tabsFreed} tab{stats.tabsFreed === 1 ? '' : 's'} without losing them
                            </>
                        )}
                        .
                    </p>
                    <div className="analytics-cards context-stats-cards">
                        <div className="analytics-card">
                            <div className="card-icon">▶️</div>
                            <div className="card-content">
                                <div className="card-value">{stats.resumes}</div>
                                <div className="card-label">Contexts resumed</div>
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="card-icon">⏸</div>
                            <div className="card-content">
                                <div className="card-value">{stats.parks}</div>
                                <div className="card-label">Times parked</div>
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="card-icon">🧹</div>
                            <div className="card-content">
                                <div className="card-value">{stats.tabsFreed}</div>
                                <div className="card-label">Tabs closed by parking</div>
                            </div>
                        </div>
                        <div className="analytics-card">
                            <div className="card-icon">⏱</div>
                            <div className="card-content">
                                <div className="card-value">
                                    {stats.averageParkedMs === null ? '—' : formatParkedDuration(stats.averageParkedMs)}
                                </div>
                                <div className="card-label">Avg. time parked</div>
                            </div>
                        </div>
                    </div>
                    {stats.currentlyParked > 0 && (
                        <p className="context-stats-footnote">
                            {stats.currentlyParked} task{stats.currentlyParked === 1 ? ' is' : 's are'} parked and
                            waiting on the Today view.
                        </p>
                    )}
                </>
            ) : (
                <p className="no-data">Start a task to give it its own tabs, then park it when you switch.</p>
            )}
        </div>
    );
};

export default ContextStatsWidget;
