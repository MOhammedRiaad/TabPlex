import React, { useState, useMemo } from 'react';
import { useBoardStore } from '../../store/boardStore';
import TasksHeader from './components/TasksHeader';
import TasksList from './components/TasksList';
import TaskCard from './components/TaskCard';
import './TasksView.css';

const TasksView: React.FC = () => {
    const { tasks } = useBoardStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'overdue' | 'upcoming'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

    // Filter tasks by search query, date, and priority
    const filteredTasks = useMemo(() => {
        let result = tasks;

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(task => task.title.toLowerCase().includes(query));
        }

        // Date filter
        if (dateFilter !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            result = result.filter(task => {
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
            result = result.filter(task => task.priority === priorityFilter);
        }

        return result;
    }, [tasks, searchQuery, dateFilter, priorityFilter]);

    // Separate by status
    const todoTasks = filteredTasks.filter(t => t.status === 'todo');
    const doingTasks = filteredTasks.filter(t => t.status === 'doing');

    // Done tasks split: today's completed vs history
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allDoneTasks = filteredTasks.filter(t => t.status === 'done');

    // Today's done tasks (completed today based on completedAt or updatedAt as fallback)
    const todayDoneTasks = allDoneTasks.filter(task => {
        const completedDate = new Date(task.completedAt || task.updatedAt);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === today.getTime();
    });

    // History: all done tasks NOT completed today
    const historyDoneTasks = allDoneTasks.filter(task => {
        const completedDate = new Date(task.completedAt || task.updatedAt);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() !== today.getTime();
    });

    return (
        <div className="tasks-view">
            <TasksHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                dateFilter={dateFilter}
                onDateFilterChange={setDateFilter}
                priorityFilter={priorityFilter}
                onPriorityFilterChange={setPriorityFilter}
                totalTasks={tasks.length}
                filteredCount={filteredTasks.length}
                todoCount={todoTasks.length}
                doingCount={doingTasks.length}
                doneCount={todayDoneTasks.length}
            />
            <TasksList todoTasks={todoTasks} doingTasks={doingTasks} doneTasks={todayDoneTasks} />

            {/* Completed History Section */}
            {historyDoneTasks.length > 0 && (
                <div className="completed-history-section">
                    <h3 className="history-header">
                        <span>📜 Completed History</span>
                        <span className="history-count">{historyDoneTasks.length} tasks</span>
                    </h3>
                    <div className="history-tasks-list">
                        {historyDoneTasks.map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksView;
