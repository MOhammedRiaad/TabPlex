import React from 'react';
import { useNavigate } from 'react-router-dom';
import { openTaskFromTabs } from '../../taskDraft/store/taskDraftStore';
import '../TasksView.css';

interface TasksHeaderProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    dateFilter: 'all' | 'today' | 'overdue' | 'upcoming';
    onDateFilterChange: (filter: 'all' | 'today' | 'overdue' | 'upcoming') => void;
    priorityFilter: 'all' | 'low' | 'medium' | 'high';
    onPriorityFilterChange: (filter: 'all' | 'low' | 'medium' | 'high') => void;
    /** '' = all tags */
    tagFilter?: string;
    onTagFilterChange?: (tag: string) => void;
    tagOptions?: { tag: string; count: number }[];
    totalTasks: number;
    filteredCount: number;
    todoCount: number;
    doingCount: number;
    doneCount: number;
}

const TasksHeader: React.FC<TasksHeaderProps> = ({
    searchQuery,
    onSearchChange,
    dateFilter,
    onDateFilterChange,
    priorityFilter,
    onPriorityFilterChange,
    tagFilter = '',
    onTagFilterChange,
    tagOptions = [],
    totalTasks,
    filteredCount,
    todoCount,
    doingCount,
    doneCount,
}) => {
    const navigate = useNavigate();

    return (
        <div className="tasks-view-header">
            <button className="back-to-today-btn" onClick={() => navigate('/today')} type="button">
                ← Back to Today
            </button>
            <div className="tasks-header-top">
                <div className="tasks-title-section">
                    <h1 className="tasks-view-title">
                        📋 All Tasks
                        <span className="tasks-count-badge">{totalTasks}</span>
                    </h1>
                    <div className="tasks-status-counts">
                        <span className="status-count todo">📋 {todoCount} To Do</span>
                        <span className="status-count doing">🔄 {doingCount} Doing</span>
                        <span className="status-count done">✅ {doneCount} Done</span>
                    </div>
                    {searchQuery && filteredCount !== totalTasks && (
                        <span className="tasks-filtered-count">
                            Showing {filteredCount} of {totalTasks}
                        </span>
                    )}
                </div>
                {/* Synchronous in the click: the on-device model session must start there */}
                <button className="tasks-from-tabs-btn" type="button" onClick={() => openTaskFromTabs()}>
                    ✨ Task from tabs
                </button>
            </div>

            {/* Filter Controls */}
            <div className="tasks-filters">
                <div className="filter-group">
                    <label htmlFor="date-filter-tasks">Date:</label>
                    <select
                        id="date-filter-tasks"
                        className="filter-select"
                        value={dateFilter}
                        onChange={e => onDateFilterChange(e.target.value as 'all' | 'today' | 'overdue' | 'upcoming')}
                    >
                        <option value="all">All</option>
                        <option value="today">Today</option>
                        <option value="overdue">Overdue</option>
                        <option value="upcoming">Upcoming</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label htmlFor="priority-filter-tasks">Priority:</label>
                    <select
                        id="priority-filter-tasks"
                        className="filter-select"
                        value={priorityFilter}
                        onChange={e => onPriorityFilterChange(e.target.value as 'all' | 'low' | 'medium' | 'high')}
                    >
                        <option value="all">All</option>
                        <option value="low">🟢 Low</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="high">🔴 High</option>
                    </select>
                </div>

                {onTagFilterChange && (tagOptions.length > 0 || tagFilter) && (
                    <div className="filter-group">
                        <label htmlFor="tag-filter-tasks">Tag:</label>
                        <select
                            id="tag-filter-tasks"
                            className="filter-select"
                            value={tagFilter}
                            onChange={e => onTagFilterChange(e.target.value)}
                        >
                            <option value="">All tags</option>
                            {tagOptions.map(({ tag, count }) => (
                                <option key={tag} value={tag}>
                                    #{tag} ({count})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="tasks-search-bar">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12.5 12.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    type="text"
                    className="tasks-search-input"
                    placeholder="Search tasks by title..."
                    value={searchQuery}
                    onChange={e => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear-btn" onClick={() => onSearchChange('')}>
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

export default TasksHeader;
