import React from 'react';
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
}

const TodayTasks: React.FC<TodayTasksProps> = ({ todoTasks, doingTasks, doneTasks, showAllTasks, onToggleShowAll }) => {
    return (
        <div className="tasks-container">
            <div className="tasks-header">
                <h3 className="tasks-title">
                    <span className="status-icon">📋</span> Tasks
                </h3>
                <div className="tasks-controls">
                    <button className={`toggle-tasks-btn ${showAllTasks ? 'active' : ''}`} onClick={onToggleShowAll}>
                        {showAllTasks ? 'Show Today Tasks' : 'Show All Tasks'}
                    </button>
                </div>
            </div>

            <div className="tasks-columns">
                <div className="task-column">
                    <h3 className="column-header">
                        <span className="status-icon">📋</span> To Do
                        <span className="task-count">{todoTasks.length}</span>
                    </h3>
                    <div className="tasks-list">
                        {todoTasks.map(task => (
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
                        {doingTasks.map(task => (
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
                        {doneTasks.map(task => (
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
