import React from 'react';
import { useNavigate } from 'react-router-dom';
import TaskCard from '../../tasks/components/TaskCard';
import AddTaskForm from '../../tasks/components/AddTaskForm';
import '../TodayView.css';
import { Task } from '../../../types';

interface TodayTasksProps {
    todoTasks: Task[];
    doingTasks: Task[];
    doneTasks: Task[];
    showAllTasks: boolean;
    onToggleShowAll: () => void;
    dateFilter: 'all' | 'today' | 'overdue' | 'upcoming';
    onDateFilterChange: (filter: 'all' | 'today' | 'overdue' | 'upcoming') => void;
    priorityFilter: 'all' | 'low' | 'medium' | 'high';
    onPriorityFilterChange: (filter: 'all' | 'low' | 'medium' | 'high') => void;
}

const TodayTasks: React.FC<TodayTasksProps> = ({
    todoTasks,
    doingTasks,
    doneTasks,
    showAllTasks,
    onToggleShowAll,
    dateFilter,
    onDateFilterChange,
    priorityFilter,
    onPriorityFilterChange,
}) => {
    const navigate = useNavigate();

    const totalTasks = todoTasks.length + doingTasks.length + doneTasks.length;

    return (
        <div className="tasks-container">
            <div className="tasks-header">
                <h3 className="tasks-title">
                    <span className="status-icon">📋</span> Tasks
                </h3>
                <div className="tasks-controls">
                    <button
                        className={`toggle-all-btn ${showAllTasks ? 'active' : ''}`}
                        onClick={onToggleShowAll}
                        type="button"
                    >
                        {showAllTasks ? 'Today Only Tasks' : 'Show All Tasks'}
                    </button>
                    <button className="view-more-btn" onClick={() => navigate('/tasks')} type="button">
                        View All Tasks ({totalTasks})
                    </button>
                </div>
            </div>

            {/* Filter Controls */}
            <div className="tasks-filters">
                <div className="filter-group">
                    <label htmlFor="date-filter">Date:</label>
                    <select
                        id="date-filter"
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
                    <label htmlFor="priority-filter">Priority:</label>
                    <select
                        id="priority-filter"
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
            </div>

            <div className="tasks-columns">
                <div className="task-column">
                    <h3 className="column-header">
                        <span className="status-icon">📋</span> To Do
                        <span className="task-count">{todoTasks.length}</span>
                    </h3>
                    <div className="tasks-list">
                        {todoTasks.slice(0, showAllTasks ? undefined : 3).map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                        <AddTaskForm status="todo" />
                    </div>
                </div>

                <div className="task-column">
                    <h3 className="column-header">
                        <span className="status-icon">🔄</span> Doing
                        <span className="task-count">{doingTasks.length}</span>
                    </h3>
                    <div className="tasks-list">
                        {doingTasks.slice(0, showAllTasks ? undefined : 3).map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                        <AddTaskForm status="doing" />
                    </div>
                </div>

                <div className="task-column">
                    <h3 className="column-header">
                        <span className="status-icon">✅</span> Done
                        <span className="task-count">{doneTasks.length}</span>
                    </h3>
                    <div className="tasks-list">
                        {doneTasks.slice(0, showAllTasks ? undefined : 3).map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                        <AddTaskForm status="done" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TodayTasks;
