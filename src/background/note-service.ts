import { addNote, deleteNote } from './storage';
import { ExtensionMessage, Note } from '../types';

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

// Handle note-related messages
export function handleNoteMessage(message: ExtensionMessage, _sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'ADD_NOTE':
            // Add a note
            if (message.payload) {
                let addNoteResponseSent = false;

                addNote(message.payload as Note)
                    .then(() => {
                        // Notify the side panel about the addition
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_NOTE_ADDED',
                                payload: message.payload,
                            })
                            .catch(() => {}); // Suppress errors if message listener is unavailable

                        if (!addNoteResponseSent) {
                            addNoteResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!addNoteResponseSent) {
                            addNoteResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!addNoteResponseSent) {
                        addNoteResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;

        case 'DELETE_NOTE':
            // Delete a note
            if (message.payload && (message.payload as { id: string }).id) {
                let deleteNoteResponseSent = false;
                const noteId = (message.payload as { id: string }).id;

                deleteNote(noteId)
                    .then(() => {
                        // Notify the side panel about the deletion
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_NOTE_DELETED',
                                payload: { id: noteId },
                            })
                            .catch(() => {}); // Suppress errors if message listener is unavailable

                        if (!deleteNoteResponseSent) {
                            deleteNoteResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteNoteResponseSent) {
                            deleteNoteResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteNoteResponseSent) {
                        deleteNoteResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;
    }

    return false;
}
