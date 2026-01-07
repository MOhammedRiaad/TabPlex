import { addTask as addTaskToDB, deleteTask as deleteTaskFromDB } from '../../../utils/storage';
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
        set(state => ({
            tasks: state.tasks.map(task =>
                task.id === id ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
            ),
        })),

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
