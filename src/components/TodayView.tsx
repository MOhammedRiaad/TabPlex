import React from 'react';
import { useBoardStore } from '../store/boardStore';
import TaskCard from './TaskCard';
import AddTaskForm from './AddTaskForm';
import './TodayView.css';

// For now, we'll render plain text instead of markdown
// If you want to use markdown, you'd need to install and import 'marked'
// import { marked } from 'marked';

const TodayView: React.FC = () => {
  const { tasks, notes } = useBoardStore();
  
  // Filter tasks for today
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const todayTasks = tasks.filter(task => {
    if (!task.dueDate) return false;
    
    const taskDueDate = new Date(task.dueDate);
    taskDueDate.setHours(0, 0, 0, 0); // Start of task due date
    
    return taskDueDate.getTime() === today.getTime();
  });
  
  // Also include tasks with no due date or overdue tasks
  const noDueDateTasks = tasks.filter(task => !task.dueDate);
  const overdueTasks = tasks.filter(task => {
    if (!task.dueDate) return false;
    
    const taskDueDate = new Date(task.dueDate);
    taskDueDate.setHours(0, 0, 0, 0); // Start of task due date
    
    return taskDueDate.getTime() < today.getTime();
  });
  
  // Combine all relevant tasks
  const allTodayTasks = [...overdueTasks, ...todayTasks, ...noDueDateTasks];
  
  // Group tasks by status
  const todoTasks = allTodayTasks.filter(task => task.status === 'todo');
  const doingTasks = allTodayTasks.filter(task => task.status === 'doing');
  const doneTasks = allTodayTasks.filter(task => task.status === 'done');
  
  // Filter notes for today
  const todayNotes = notes.filter(note => {
    const noteDate = new Date(note.createdAt);
    noteDate.setHours(0, 0, 0, 0); // Start of note creation date
    
    return noteDate.getTime() === today.getTime();
  });
  


  return (
    <div className="today-view">
      <div className="today-header">
        <h2>Today's Tasks & Notes</h2>
        <div className="today-date">
          {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
      {/* Notes Section */}
      <div className="notes-section">
        <h3 className="notes-header">
          <span className="status-icon">📝</span> Today's Notes
          <span className="note-count">{todayNotes.length}</span>
        </h3>
        <div className="notes-list">
          {todayNotes.length > 0 ? (
            todayNotes.map(note => (
              <div key={note.id} className="note-card">
                <div className="note-content">
                  <p className="note-text">{note.content}</p>
                </div>
                <div className="note-meta">
                  Created: {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          ) : (
            <p className="no-notes">No notes for today</p>
          )}
        </div>
      </div>
      
      {/* Tasks Section */}
      <div className="tasks-container">
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

export default TodayView;