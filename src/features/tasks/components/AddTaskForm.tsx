import React, { useState } from 'react';
import { useBoardStore } from '../../../store/boardStore';

import './AddTaskForm.css';

interface AddTaskFormProps {
    status?: 'todo' | 'doing' | 'done';
    boardId?: string;
    folderId?: string;
}

const AddTaskForm: React.FC<AddTaskFormProps> = ({ status = 'todo', boardId, folderId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [selectedTabIds, setSelectedTabIds] = useState<string[]>([]);

    const { tabs, addTask } = useBoardStore();

    // Filter tabs based on the context
    const availableTabs = folderId ? tabs.filter(tab => tab.folderId === folderId) : tabs;

    const handleTabToggle = (tabId: string) => {
        setSelectedTabIds(prev => (prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (title.trim()) {
            addTask({
                id: `task_${Date.now()}`,
                title: title.trim(),
                status,
                priority,
                dueDate: dueDate || undefined,
                boardId,
                folderId,
                tabIds: selectedTabIds,
            });

            // Reset form
            setTitle('');
            setDueDate('');
            setPriority('medium');
            setSelectedTabIds([]);
            setIsExpanded(false);
        }
    };

    if (!isExpanded) {
        return (
            <button className="add-task-btn" onClick={() => setIsExpanded(true)}>
                + Add Task
            </button>
        );
    }

    return (
        <div className="add-task-form">
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Task title"
                    autoFocus
                    required
                />
                <div className="form-fields">
                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
                        <option value="low">Low Priority</option>
                        <option value="medium">Medium Priority</option>
                        <option value="high">High Priority</option>
                    </select>
                </div>

                {availableTabs.length > 0 && (
                    <div className="tab-connections">
                        <label>Connect to Tabs:</label>
                        <div className="tab-list">
                            {availableTabs.map(tab => (
                                <label key={tab.id} className="tab-option">
                                    <input
                                        type="checkbox"
                                        checked={selectedTabIds.includes(tab.id)}
                                        onChange={() => handleTabToggle(tab.id)}
                                    />
                                    <span className="tab-title">{tab.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
                <div className="form-actions">
                    <button type="submit">Add</button>
                    <button type="button" onClick={() => setIsExpanded(false)}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddTaskForm;
