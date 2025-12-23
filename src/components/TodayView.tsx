import React from 'react';
import { useBoardStore } from '../store/boardStore';
import TaskCard from './TaskCard';
import AddTaskForm from './AddTaskForm';
import './TodayView.css';

const TodayView: React.FC = () => {
  const { tasks } = useBoardStore();
  
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

  return (
    <div className="today-view">
      <div className="today-header">
        <h2>Today's Tasks</h2>
        <div className="today-date">
          {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
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