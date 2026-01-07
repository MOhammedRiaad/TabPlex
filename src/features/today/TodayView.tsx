import React, { useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useTaskNotifications } from '../../hooks/useTaskNotifications';
import './TodayView.css';
import TodayHeader from './components/TodayHeader';
import TodayNotes from './components/TodayNotes';
import TodayTasks from './components/TodayTasks';
import TodaySidebar from './components/TodaySidebar';

const TodayView: React.FC = () => {
    const { tasks, notes } = useBoardStore();

    // Enable task notifications
    useTaskNotifications();

    // State
    const [showAllTasks, setShowAllTasks] = useState(false);
    const [showTimer, setShowTimer] = useState(false);

    // Helpers
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
        taskDueDate.setHours(0, 0, 0, 0);
        return taskDueDate.getTime() === today.getTime();
    });

    const noDueDateTasks = tasks.filter(task => !task.dueDate);
    const overdueTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDueDate = new Date(task.dueDate);
        taskDueDate.setHours(0, 0, 0, 0);
        return taskDueDate.getTime() < today.getTime();
    });

    const allTodayTasks = [...overdueTasks, ...todayTasks, ...noDueDateTasks];
    const tasksToDisplay = showAllTasks ? tasks : allTodayTasks;

    const todoTasks = tasksToDisplay.filter(task => task.status === 'todo');
    const doingTasks = tasksToDisplay.filter(task => task.status === 'doing');
    const doneTasks = tasksToDisplay.filter(task => task.status === 'done');

    // Filter notes for today
    const todayNotes = notes.filter(note => {
        const noteDate = new Date(note.createdAt);
        noteDate.setHours(0, 0, 0, 0);
        return noteDate.getTime() === today.getTime();
    });

    return (
        <div className="today-view">
            <TodayHeader showTimer={showTimer} onToggleTimer={() => setShowTimer(!showTimer)} formatTime={formatTime} />

            <div className="today-content">
                <div className={`main-content ${showTimer ? 'with-sidebar' : ''}`}>
                    <TodayNotes notes={todayNotes} />

                    <TodayTasks
                        todoTasks={todoTasks}
                        doingTasks={doingTasks}
                        doneTasks={doneTasks}
                        showAllTasks={showAllTasks}
                        onToggleShowAll={() => setShowAllTasks(!showAllTasks)}
                    />
                </div>

                {showTimer && <TodaySidebar />}
            </div>
        </div>
    );
};

export default TodayView;
