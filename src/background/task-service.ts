import { addTask, deleteTask, getTask, updateTask } from './storage';
import { ExtensionMessage, ExtensionResponse, Task } from '../types';
import { releaseContextForDeletedTask } from './context-service';

// Helper function to safely send response
// Helper function to safely send response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeSendResponse(_sendResponse: (response: any) => void, response: unknown) {
    try {
        _sendResponse(response);
    } catch (error) {
        // Response already sent or channel closed
        console.warn('Failed to send response:', error);
    }
}

// Handle task-related messages
export function handleTaskMessage(message: ExtensionMessage, _sendResponse: (response: ExtensionResponse) => void) {
    switch (message.type) {
        case 'ADD_TASK':
            // Add a task
            if (message.payload) {
                let addTaskResponseSent = false;
                const task = message.payload as Task;

                addTask(task)
                    .then(() => {
                        // Notify the side panel about the addition
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_TASK_ADDED',
                                payload: message.payload,
                            })
                            .catch(() => {}); // Ignore errors from sendMessage

                        if (!addTaskResponseSent) {
                            addTaskResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!addTaskResponseSent) {
                            addTaskResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!addTaskResponseSent) {
                        addTaskResponseSent = true;
                        safeSendResponse(_sendResponse, { success: true }); // Fallback response
                    }
                }, 1000);

                return true;
            }
            break;

        case 'UPDATE_TASK':
            // Update a task (upsert) and let other open TabPlex tabs know
            if (message.payload && (message.payload as Task).id) {
                let updateTaskResponseSent = false;
                const incoming = message.payload as Task;
                let task = incoming;

                // `context` (Park & Resume) is owned by context-service: a UI edit (title, status…) sent with
                // a stale copy must not roll back tabs that were captured in the background meanwhile.
                getTask(incoming.id)
                    .then(stored => {
                        task = stored ? { ...incoming, context: stored.context ?? incoming.context } : incoming;
                        return updateTask(task);
                    })
                    .then(() => {
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_TASK_UPDATED',
                                payload: task,
                            })
                            .catch(() => {}); // No listener open — nothing to sync

                        if (!updateTaskResponseSent) {
                            updateTaskResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!updateTaskResponseSent) {
                            updateTaskResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                return true;
            }
            break;

        case 'DELETE_TASK':
            // Delete a task
            if (message.payload && (message.payload as { id: string }).id) {
                let deleteTaskResponseSent = false;
                const taskId = (message.payload as { id: string }).id;

                releaseContextForDeletedTask(taskId)
                    .catch(error => console.warn('Could not release task context', error))
                    .then(() => deleteTask(taskId))
                    .then(() => {
                        // Notify the side panel about the deletion
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_TASK_DELETED',
                                payload: { id: taskId },
                            })
                            .catch(() => {}); // Suppress errors if message listener is unavailable

                        if (!deleteTaskResponseSent) {
                            deleteTaskResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteTaskResponseSent) {
                            deleteTaskResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteTaskResponseSent) {
                        deleteTaskResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;
    }

    return false;
}
