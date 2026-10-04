import { ExtensionMessage, Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';
import { STORAGE_KEYS } from './storage';

const COLLECTIONS = ['boards', 'folders', 'tabs', 'tasks', 'notes', 'sessions', 'history'] as const;

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

// Handle data-related messages
interface ImportPayload {
    boards: Board[];
    folders: Folder[];
    tabs: Tab[];
    tasks: Task[];
    notes: Note[];
    sessions: Session[];
    history: HistoryItem[];
}

export function handleDataMessage(message: ExtensionMessage, _sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'EXPORT_ALL_DATA':
            // Export all data from storage

            let exportAllResponseSent = false;

            // Read every collection by its real key (history lives under 'history_items', not
            // 'tabboard_history', so exports used to drop it)
            Promise.all(
                COLLECTIONS.map(name =>
                    chrome.storage.local.get([STORAGE_KEYS[name]]).then(result => result[STORAGE_KEYS[name]] || [])
                )
            )
                .then(([boards, folders, tabs, tasks, notes, sessions, history]) => {
                    if (!exportAllResponseSent) {
                        exportAllResponseSent = true;
                        safeSendResponse(_sendResponse, {
                            boards,
                            folders,
                            tabs,
                            tasks,
                            notes,
                            sessions,
                            history,
                        });
                    }
                })
                .catch(error => {
                    if (!exportAllResponseSent) {
                        exportAllResponseSent = true;
                        safeSendResponse(_sendResponse, { error: error.message });
                    }
                });

            setTimeout(() => {
                if (!exportAllResponseSent) {
                    exportAllResponseSent = true;
                    safeSendResponse(_sendResponse, { error: 'Export timed out' });
                }
            }, 2000);

            return true;

        case 'IMPORT_ALL_DATA':
            // Import all data to storage
            if (message.payload) {
                let importAllResponseSent = false;

                // Save all data to storage
                const payload = message.payload as ImportPayload;
                // Missing collections are written as empty lists
                Promise.all(
                    COLLECTIONS.map(name => chrome.storage.local.set({ [STORAGE_KEYS[name]]: payload[name] ?? [] }))
                )
                    .then(() => {
                        // Notify the UI about the import completion
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_DATA_IMPORTED',
                            })
                            .catch(() => {}); // Suppress errors if message listener is unavailable

                        if (!importAllResponseSent) {
                            importAllResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch(error => {
                        if (!importAllResponseSent) {
                            importAllResponseSent = true;
                            safeSendResponse(_sendResponse, { error: error.message });
                        }
                    });

                setTimeout(() => {
                    if (!importAllResponseSent) {
                        importAllResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Import timed out' });
                    }
                }, 2000);

                return true;
            }
            break;
    }

    return false;
}
