import React, { useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useTaskNotifications } from '../../hooks/useTaskNotifications';
import './TodayView.css';
import TodayHeader from './components/TodayHeader';
import TodayNotes from './components/TodayNotes';
import TodayTasks from './components/TodayTasks';
import DailyQuote from './components/DailyQuote';
import QuickActions from './components/QuickActions';
import QuickLinks from './components/QuickLinks';
import PomodoroTimer from '../sessions/components/PomodoroTimer';

const TodayView: React.FC = () => {
    const { tasks, notes } = useBoardStore();
    const [showAllTasks, setShowAllTasks] = useState(false);
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

    // Enable task notifications
    useTaskNotifications();

    // Filter tasks for today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Apply filters
    let filteredTasks = tasks;

    // Date filter
    if (!showAllTasks || dateFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => {
            if (dateFilter === 'today') {
                if (!task.dueDate) return false;
                const taskDueDate = new Date(task.dueDate);
                taskDueDate.setHours(0, 0, 0, 0);
                return taskDueDate.getTime() === today.getTime();
            } else if (dateFilter === 'overdue') {
                if (!task.dueDate) return false;
                const taskDueDate = new Date(task.dueDate);
                taskDueDate.setHours(0, 0, 0, 0);
                return taskDueDate.getTime() < today.getTime();
            } else if (dateFilter === 'upcoming') {
                if (!task.dueDate) return false;
                const taskDueDate = new Date(task.dueDate);
                taskDueDate.setHours(0, 0, 0, 0);
                return taskDueDate.getTime() > today.getTime();
            }
            return true;
        });
    }

    // Priority filter
    if (priorityFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
    }

    const todayTasks = filteredTasks.filter(task => {
        if (!task.dueDate) return !showAllTasks; // Include no-date tasks only when not showing all
        const taskDueDate = new Date(task.dueDate);
        taskDueDate.setHours(0, 0, 0, 0);
        return taskDueDate.getTime() === today.getTime();
    });

    const noDueDateTasks = filteredTasks.filter(task => !task.dueDate);
    const overdueTasks = filteredTasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDueDate = new Date(task.dueDate);
        taskDueDate.setHours(0, 0, 0, 0);
        return taskDueDate.getTime() < today.getTime();
    });

    const allTodayTasks = showAllTasks ? filteredTasks : [...overdueTasks, ...todayTasks, ...noDueDateTasks];

    const todoTasks = allTodayTasks.filter(task => task.status === 'todo');
    const doingTasks = allTodayTasks.filter(task => task.status === 'doing');

    // Done tasks: only show today's completed tasks unless "Show All" is enabled
    const doneTasks = allTodayTasks.filter(task => {
        if (task.status !== 'done') return false;

        if (showAllTasks) return true;

        // Only show tasks completed today
        const updatedDate = new Date(task.updatedAt);
        updatedDate.setHours(0, 0, 0, 0);
        return updatedDate.getTime() === today.getTime();
    });

    // Filter notes for today
    const todayNotes = notes.filter(note => {
        const noteDate = new Date(note.createdAt);
        noteDate.setHours(0, 0, 0, 0);
        return noteDate.getTime() === today.getTime();
    });

    return (
        <div className="today-view">
            <TodayHeader />

            <div className="today-content-wrapper">
                <QuickActions />

                <div className="dashboard-grid">
                    <div className="dashboard-column main-column">
                        <section className="dashboard-card tasks-card">
                            <TodayTasks
                                todoTasks={todoTasks}
                                doingTasks={doingTasks}
                                doneTasks={doneTasks}
                                showAllTasks={showAllTasks}
                                onToggleShowAll={() => setShowAllTasks(!showAllTasks)}
                                dateFilter={dateFilter}
                                onDateFilterChange={setDateFilter}
                                priorityFilter={priorityFilter}
                                onPriorityFilterChange={setPriorityFilter}
                            />
                        </section>

                        <section className="dashboard-card notes-card">
                            <TodayNotes notes={todayNotes} />
                        </section>
                    </div>

                    <div className="dashboard-column side-column">
                        <div className="dashboard-card timer-card">
                            <PomodoroTimer />
                        </div>

                        <QuickLinks />

                        <div className="dashboard-card quote-card">
                            <DailyQuote />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TodayView;
