import {
    addTask as addTaskToDB,
    deleteTask as deleteTaskFromDB,
    updateTask as updateTaskInDB,
} from '../../../utils/storage';
import { Task } from '../../../types';
import { TaskSlice, BoardStoreCreator } from './types';

export const createTaskSlice: BoardStoreCreator<TaskSlice> = (set, get) => ({
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

    updateTask: (id, updates) => {
        const task = get().tasks.find(t => t.id === id);
        if (!task) return;

        const now = new Date().toISOString();

        // Determine completedAt value
        let completedAt = task.completedAt;
        if (updates.status === 'done' && task.status !== 'done') {
            // Task is being marked as done - set completedAt
            completedAt = now;
        } else if (updates.status && updates.status !== 'done') {
            // Task is being unmarked from done - clear completedAt
            completedAt = undefined;
        }

        const updatedTask: Task = {
            ...task,
            ...updates,
            updatedAt: now,
            completedAt,
        };

        set(state => ({
            tasks: state.tasks.map(t => (t.id === id ? updatedTask : t)),
        }));

        // Persist to IndexedDB
        updateTaskInDB(updatedTask).catch(console.error);

        // Keep the background copy and other open TabPlex tabs in sync
        chrome.runtime
            .sendMessage({
                type: 'UPDATE_TASK',
                payload: updatedTask,
            })
            .catch(console.error);
    },

    upsertTaskSilently: task => {
        set(state => {
            const exists = state.tasks.some(t => t.id === task.id);
            return {
                tasks: exists ? state.tasks.map(t => (t.id === task.id ? task : t)) : [...state.tasks, task],
            };
        });

        updateTaskInDB(task).catch(console.error);
    },

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
