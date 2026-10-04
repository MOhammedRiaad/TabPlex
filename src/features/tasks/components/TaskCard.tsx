import React, { useState } from 'react';
import { Task } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { formatDate } from '../../../utils/dateUtils';
import { isContextActive } from '../../../utils/taskContext';
import { useTaskContextActions } from '../hooks/useTaskContextActions';
import TaskContextStrip from './TaskContextStrip';
import TaskForm, { TaskFormValues, formValuesToTask, taskToFormValues } from './TaskForm';
import './TaskCard.css';

interface TaskCardProps {
    task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
    const [isEditing, setIsEditing] = useState(false);

    // Animation states
    const [isAnimatingCard, setIsAnimatingCard] = useState(false);
    const [isAnimatingIcon, setIsAnimatingIcon] = useState(false);

    const updateTask = useBoardStore(state => state.updateTask);
    const deleteTask = useBoardStore(state => state.deleteTask);
    const tabs = useBoardStore(state => state.tabs); // Get tabs to resolve linked names

    const { park } = useTaskContextActions();

    const linkedTabs = task.tabIds?.map(id => tabs.find(t => t.id === id)).filter(Boolean) || [];

    // The form mounts when editing starts, so it always begins from the latest task values (edits made
    // elsewhere — checklist toggles, other tabs, background — are never reverted on Save)
    const startEditing = () => setIsEditing(true);

    const handleStatusChange = (newStatus: 'todo' | 'doing' | 'done') => {
        if (newStatus === 'done' && task.status !== 'done' && isContextActive(task)) {
            // Finishing a task that has its tabs open: park them (keeps the note and tab list)
            park(task);
        }
        if (newStatus === 'done' && task.status !== 'done') {
            setIsAnimatingCard(true);

            // Wait for jump apex/landing (500ms)
            setTimeout(() => {
                setIsAnimatingCard(false);
                setIsAnimatingIcon(true);
            }, 500);

            // Wait for icon pop before moving column (total 1s + small buffer)
            setTimeout(() => {
                updateTask(task.id, { status: newStatus });
                setIsAnimatingIcon(false);
            }, 1000);
        } else {
            updateTask(task.id, { status: newStatus });
        }
    };

    const handleSave = (values: TaskFormValues) => {
        updateTask(task.id, formValuesToTask(values));
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask(task.id);
        }
    };

    const toggleChecklistItem = (itemId: string) => {
        const newList = (task.checklist || []).map(item =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
        );
        updateTask(task.id, { checklist: newList });
    };

    // Using shared formatDate utility from dateUtils

    const getPriorityColor = () => {
        switch (task.priority) {
            case 'high':
                return '#ef4444'; // red
            case 'medium':
                return '#f59e0b'; // amber
            case 'low':
                return '#10b981'; // emerald
            default:
                return '#6b7280'; // gray
        }
    };

    if (isEditing) {
        return (
            <div className="task-card editing">
                <TaskForm
                    initial={taskToFormValues(task)}
                    availableTabs={tabs}
                    submitLabel="Save"
                    onSubmit={handleSave}
                    onCancel={() => setIsEditing(false)}
                />
            </div>
        );
    }

    return (
        <div
            className={`task-card ${isAnimatingCard ? 'animate-card-jump' : ''}`}
            style={
                {
                    '--priority-color': getPriorityColor(),
                } as React.CSSProperties
            }
        >
            <div className="task-header">
                <h3 className="task-title">{task.title}</h3>
                <div className="task-actions">
                    <button className="edit-btn" onClick={startEditing} title="Edit task">
                        ✏️
                    </button>
                    <button className="delete-btn" onClick={handleDelete} title="Delete task">
                        🗑️
                    </button>
                </div>
            </div>

            {task.description && <p className="task-description">{task.description}</p>}

            {linkedTabs.length > 0 && (
                <div className="task-links">
                    {linkedTabs.map(tab => (
                        <a
                            key={tab!.id}
                            href={tab!.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="task-link-badge"
                        >
                            🔗 {tab!.title}
                        </a>
                    ))}
                </div>
            )}

            <TaskContextStrip task={task} />

            {task.checklist && task.checklist.length > 0 && (
                <div className="task-checklist">
                    <div className="checklist-progress">
                        {task.checklist.filter(i => i.completed).length} / {task.checklist.length}
                    </div>
                    <div className="checklist-preview">
                        {task.checklist.map(item => (
                            <div
                                key={item.id}
                                className="checklist-item-view"
                                onClick={() => toggleChecklistItem(item.id)}
                            >
                                <span className={item.completed ? 'checked' : ''}>{item.completed ? '☑' : '☐'}</span>
                                <span className={item.completed ? 'completed-text' : ''}>{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {task.dueDate && <div className="task-due-date">Due: {formatDate(task.dueDate)}</div>}
            <div className="task-status-actions">
                <div className="status-buttons">
                    <button
                        className={`status-btn ${task.status === 'todo' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('todo')}
                        title="To Do"
                    >
                        📋
                    </button>
                    <button
                        className={`status-btn ${task.status === 'doing' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('doing')}
                        title="Doing"
                    >
                        🔄
                    </button>
                    <button
                        className={`status-btn ${task.status === 'done' ? 'active' : ''} ${isAnimatingIcon ? 'animate-success-pop' : ''}`}
                        onClick={() => handleStatusChange('done')}
                        title="Done"
                    >
                        ✅
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskCard;
