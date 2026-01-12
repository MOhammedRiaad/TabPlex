import React from 'react';
import TaskCard from './TaskCard';
import AddTaskForm from './AddTaskForm';
import { Task } from '../../../types';
import '../TasksView.css';

interface TasksListProps {
    todoTasks: Task[];
    doingTasks: Task[];
    doneTasks: Task[];
}

const TasksList: React.FC<TasksListProps> = ({ todoTasks, doingTasks, doneTasks }) => {
    return (
        <div className="tasks-view-content">
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

export default TasksList;
