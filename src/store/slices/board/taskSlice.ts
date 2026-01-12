import {
    addTask as addTaskToDB,
    deleteTask as deleteTaskFromDB,
    updateTask as updateTaskInDB,
} from '../../../utils/storage';
import { TaskSlice, BoardStoreCreator } from './types';

export const createTaskSlice: BoardStoreCreator<TaskSlice> = set => ({
    tasks: [],

    addTask: task => {
        const newTask = {
            ...task,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        set(state => ({
            tasks: [...state.tasks, newTask],
        }));

        addTaskToDB(newTask).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'ADD_TASK',
                payload: newTask,
            })
            .catch(console.error);
    },

    updateTask: (id, updates) =>
        set(state => {
            const now = new Date().toISOString();
            const updatedTasks = state.tasks.map(task => {
                if (task.id !== id) return task;

                // Determine completedAt value
                let completedAt = task.completedAt;
                if (updates.status === 'done' && task.status !== 'done') {
                    // Task is being marked as done - set completedAt
                    completedAt = now;
                } else if (updates.status && updates.status !== 'done') {
                    // Task is being unmarked from done - clear completedAt
                    completedAt = undefined;
                }

                const updatedTask = {
                    ...task,
                    ...updates,
                    updatedAt: now,
                    completedAt,
                };

                // Persist to IndexedDB
                updateTaskInDB(updatedTask).catch(console.error);

                return updatedTask;
            });

            return { tasks: updatedTasks };
        }),

    deleteTask: id => {
        set(state => ({
            tasks: state.tasks.filter(task => task.id !== id),
        }));

        deleteTaskFromDB(id).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'DELETE_TASK',
                payload: { id },
            })
            .catch(console.error);
    },

    deleteTaskSilently: id => {
        set(state => ({
            tasks: state.tasks.filter(task => task.id !== id),
        }));

        deleteTaskFromDB(id).catch(console.error);
    },
});
