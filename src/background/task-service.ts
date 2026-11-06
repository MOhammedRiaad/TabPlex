import { addTask, deleteTask, getTask, updateTask } from './storage';
import { ExtensionMessage, Task } from '../types';
import { releaseContextForDeletedTask } from './context-service';
import { broadcast, respondWith } from './respond';

// Handle task-related messages
export function handleTaskMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'ADD_TASK':
            if (message.payload) {
                const task = message.payload as Task;
                return respondWith(
                    addTask(task).then(() => broadcast('STORAGE_TASK_ADDED', task)),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;

        case 'UPDATE_TASK':
            // Update a task (upsert) and let other open TabPlex tabs know
            if (message.payload && (message.payload as Task).id) {
                const incoming = message.payload as Task;
                // `context` (Park & Resume) is owned by context-service: a UI edit (title, status…) sent with
                // a stale copy must not roll back tabs that were captured in the background meanwhile.
                return respondWith(
                    getTask(incoming.id).then(async stored => {
                        const task = stored ? { ...incoming, context: stored.context ?? incoming.context } : incoming;
                        await updateTask(task);
                        broadcast('STORAGE_TASK_UPDATED', task);
                    }),
                    sendResponse
                );
            }
            break;

        case 'DELETE_TASK':
            if (message.payload && (message.payload as { id: string }).id) {
                const id = (message.payload as { id: string }).id;
                return respondWith(
                    releaseContextForDeletedTask(id)
                        .catch(error => console.warn('Could not release task context', error))
                        .then(() => deleteTask(id))
                        .then(() => broadcast('STORAGE_TASK_DELETED', { id })),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;
    }

    return false;
}
