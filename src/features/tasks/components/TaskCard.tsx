import React, { useState } from 'react';
import { Task } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import './TaskCard.css';

interface TaskCardProps {
    task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [editDescription, setEditDescription] = useState(task.description || '');
    const [editDueDate, setEditDueDate] = useState(task.dueDate || '');
    const [editPriority, setEditPriority] = useState(task.priority);
    const [checklist, setChecklist] = useState(task.checklist || []);
    const [newChecklistItem, setNewChecklistItem] = useState('');

    // Animation states
    const [isAnimatingCard, setIsAnimatingCard] = useState(false);
    const [isAnimatingIcon, setIsAnimatingIcon] = useState(false);

    const updateTask = useBoardStore(state => state.updateTask);
    const deleteTask = useBoardStore(state => state.deleteTask);
    const tabs = useBoardStore(state => state.tabs); // Get tabs to resolve linked names

    const linkedTabs = task.tabIds?.map(id => tabs.find(t => t.id === id)).filter(Boolean) || [];

    const handleStatusChange = (newStatus: 'todo' | 'doing' | 'done') => {
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

    const handleSave = () => {
        updateTask(task.id, {
            title: editTitle,
            description: editDescription,
            dueDate: editDueDate || undefined,
            priority: editPriority,
            checklist,
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditTitle(task.title);
        setEditDescription(task.description || '');
        setEditDueDate(task.dueDate || '');
        setEditPriority(task.priority);
        setChecklist(task.checklist || []);
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this task?')) {
            deleteTask(task.id);
        }
    };

    const toggleChecklistItem = (itemId: string) => {
        if (isEditing) {
            setChecklist(prev =>
                prev.map(item => (item.id === itemId ? { ...item, completed: !item.completed } : item))
            );
        } else {
            // Direct toggle in view mode
            const newList = (task.checklist || []).map(item =>
                item.id === itemId ? { ...item, completed: !item.completed } : item
            );
            updateTask(task.id, { checklist: newList });
        }
    };

    const addChecklistItem = () => {
        if (newChecklistItem.trim()) {
            setChecklist(prev => [
                ...prev,
                { id: crypto.randomUUID(), text: newChecklistItem.trim(), completed: false },
            ]);
            setNewChecklistItem('');
        }
    };

    const removeChecklistItem = (itemId: string) => {
        setChecklist(prev => prev.filter(item => item.id !== itemId));
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

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
                <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="edit-title"
                    autoFocus
                    placeholder="Task title"
                />
                <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="edit-description"
                    placeholder="Description"
                    rows={3}
                />

                <div className="edit-checklist">
                    <h4 className="checklist-heading">Checklist</h4>
                    <div className="checklist-items">
                        {checklist.map(item => (
                            <div key={item.id} className="checklist-item-edit">
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => toggleChecklistItem(item.id)}
                                />
                                <span>{item.text}</span>
                                <button onClick={() => removeChecklistItem(item.id)} className="delete-item-btn">
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="add-checklist-item">
                        <input
                            type="text"
                            value={newChecklistItem}
                            onChange={e => setNewChecklistItem(e.target.value)}
                            placeholder="Add item..."
                            onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                        />
                        <button onClick={addChecklistItem}>Add</button>
                    </div>
                </div>

                <div className="edit-fields">
                    <input
                        type="date"
                        value={editDueDate}
                        onChange={e => setEditDueDate(e.target.value)}
                        className="edit-date"
                    />
                    <select
                        value={editPriority}
                        onChange={e => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                        className="edit-priority"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div className="edit-actions">
                    <button onClick={handleSave} className="save-btn">
                        Save
                    </button>
                    <button onClick={handleCancel} className="cancel-btn">
                        Cancel
                    </button>
                </div>
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
                    <button className="edit-btn" onClick={() => setIsEditing(true)} title="Edit task">
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
