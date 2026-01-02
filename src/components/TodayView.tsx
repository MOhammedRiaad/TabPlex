import React, { useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import TaskCard from './TaskCard';
import NoteCard from './NoteCard';
import AddTaskForm from './AddTaskForm';
import AddNoteForm from './AddNoteForm';
import PomodoroTimer from './PomodoroTimer';
import { useTaskNotifications } from '../hooks/useTaskNotifications';
import { useTimerStore } from '../store/timerStore';
import './TodayView.css';

const TodayView: React.FC = () => {
  const { tasks, notes } = useBoardStore();

  // Enable task notifications
  useTaskNotifications();

  // State to track if we're showing all tasks
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  // Timer Store
  const { timeLeft, isRunning, setIsRunning, resetTimer, settings } = useTimerStore();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  // Combine all relevant tasks for today view
  const allTodayTasks = [...overdueTasks, ...todayTasks, ...noDueDateTasks];

  // Use all tasks if showAllTasks is true, otherwise use today's tasks
  const tasksToDisplay = showAllTasks ? tasks : allTodayTasks;

  // Group tasks by status
  const todoTasks = tasksToDisplay.filter(task => task.status === 'todo');
  const doingTasks = tasksToDisplay.filter(task => task.status === 'doing');
  const doneTasks = tasksToDisplay.filter(task => task.status === 'done');

  // Filter notes for today
  const todayNotes = notes.filter(note => {
    const noteDate = new Date(note.createdAt);
    noteDate.setHours(0, 0, 0, 0); // Start of note creation date

    return noteDate.getTime() === today.getTime();
  });

  return (
    <div className="today-view">
      <div className="today-header">
        <div className="header-content">
          <h2>Today's Tasks & Notes</h2>
          <div className="today-date">
            {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className="header-actions">
          {(!showTimer && (isRunning || timeLeft < (settings.workDuration * 60))) && (
            <div className="mini-timer">
              <span className={`mini-time ${isRunning ? 'running' : 'paused'}`}>{formatTime(timeLeft)}</span>
              <button
                className="mini-control-btn"
                onClick={(e) => { e.stopPropagation(); isRunning ? setIsRunning(false) : setIsRunning(true); }}
                title={isRunning ? "Pause" : "Resume"}
              >
                {isRunning ? '⏸️' : '▶️'}
              </button>
              <button
                className="mini-control-btn"
                onClick={(e) => { e.stopPropagation(); resetTimer(); }}
                title="Reset"
              >
                🔄
              </button>
            </div>
          )}
          <button
            className={`toggle-timer-btn ${showTimer ? 'active' : ''}`}
            onClick={() => setShowTimer(!showTimer)}
            title="Toggle Focus Timer"
          >
            {showTimer ? 'Hide Timer ⏱️' : 'Focus Timer ⏱️'}
          </button>
        </div>
      </div>

      <div className="today-content">
        <div className={`main-content ${showTimer ? 'with-sidebar' : ''}`}>
          {/* Notes Section */}
          <div className="notes-section">
            <h3 className="notes-header">
              <span className="status-icon">📝</span> Today's Notes
              <span className="note-count">{todayNotes.length}</span>
            </h3>
            <div className="notes-list">
              {todayNotes.length > 0 ? (
                todayNotes.map(note => (
                  <NoteCard key={note.id} note={note} />
                ))
              ) : (
                <p className="no-notes">No notes for today</p>
              )}
              <AddNoteForm />
            </div>
          </div>

          {/* Tasks Section */}
          <div className="tasks-container">
            <div className="tasks-header">
              <h3 className="tasks-title">
                <span className="status-icon">📋</span> Tasks
              </h3>
              <div className="tasks-controls">
                <button
                  className={`toggle-tasks-btn ${showAllTasks ? 'active' : ''}`}
                  onClick={() => setShowAllTasks(!showAllTasks)}
                >
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
        </div>

        {/* Sidebar / Timer Section */}
        {showTimer && (
          <div className="today-sidebar">
            <div className="sticky-timer">
              <PomodoroTimer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayView;