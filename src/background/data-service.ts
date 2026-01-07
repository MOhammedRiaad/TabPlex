import { ExtensionMessage, Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';

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

            Promise.all([
                chrome.storage.local.get(['tabboard_boards']).then(result => result['tabboard_boards'] || []),
                chrome.storage.local.get(['tabboard_folders']).then(result => result['tabboard_folders'] || []),
                chrome.storage.local.get(['tabboard_tabs']).then(result => result['tabboard_tabs'] || []),
                chrome.storage.local.get(['tabboard_tasks']).then(result => result['tabboard_tasks'] || []),
                chrome.storage.local.get(['tabboard_notes']).then(result => result['tabboard_notes'] || []),
                chrome.storage.local.get(['tabboard_sessions']).then(result => result['tabboard_sessions'] || []),
                chrome.storage.local.get(['tabboard_history']).then(result => result['tabboard_history'] || []),
            ])
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

                const { boards, folders, tabs, tasks, notes, sessions, history } = message.payload as ImportPayload;

                // Save all data to storage
                Promise.all([
                    chrome.storage.local.set({ tabboard_boards: boards }),
                    chrome.storage.local.set({ tabboard_folders: folders }),
                    chrome.storage.local.set({ tabboard_tabs: tabs }),
                    chrome.storage.local.set({ tabboard_tasks: tasks }),
                    chrome.storage.local.set({ tabboard_notes: notes }),
                    chrome.storage.local.set({ tabboard_sessions: sessions }),
                    chrome.storage.local.set({ tabboard_history: history }),
                ])
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
