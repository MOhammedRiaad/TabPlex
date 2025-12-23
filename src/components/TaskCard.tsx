import React, { useState } from 'react';
import { Task } from '../types';
import { useBoardStore } from '../store/boardStore';
import './TaskCard.css';

interface TaskCardProps {
  task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDueDate, setEditDueDate] = useState(task.dueDate || '');
  const [editPriority, setEditPriority] = useState(task.priority);
  
  const updateTask = useBoardStore(state => state.updateTask);
  const deleteTask = useBoardStore(state => state.deleteTask);

  const handleStatusChange = (newStatus: 'todo' | 'doing' | 'done') => {
    updateTask(task.id, { status: newStatus });
  };

  const handleSave = () => {
    updateTask(task.id, { 
      title: editTitle, 
      dueDate: editDueDate || undefined,
      priority: editPriority
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditDueDate(task.dueDate || '');
    setEditPriority(task.priority);
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteTask(task.id);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'high': return '#ef4444'; // red
      case 'medium': return '#f59e0b'; // amber
      case 'low': return '#10b981'; // emerald
      default: return '#6b7280'; // gray
    }
  };

  if (isEditing) {
    return (
      <div className="task-card editing">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="edit-title"
          autoFocus
        />
        <div className="edit-fields">
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="edit-date"
          />
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value as any)}
            className="edit-priority"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="edit-actions">
          <button onClick={handleSave} className="save-btn">Save</button>
          <button onClick={handleCancel} className="cancel-btn">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-card">
      <div className="task-header">
        <div 
          className="priority-indicator" 
          style={{ backgroundColor: getPriorityColor() }}
          title={`Priority: ${task.priority}`}
        />
        <div className="task-actions">
          <button 
            className="edit-btn" 
            onClick={() => setIsEditing(true)}
            title="Edit task"
          >
            ✏️
          </button>
          <button 
            className="delete-btn" 
            onClick={handleDelete}
            title="Delete task"
          >
            🗑️
          </button>
        </div>
      </div>
      <h3 className="task-title">{task.title}</h3>
      {task.dueDate && (
        <div className="task-due-date">
          Due: {formatDate(task.dueDate)}
        </div>
      )}
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
            className={`status-btn ${task.status === 'done' ? 'active' : ''}`}
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