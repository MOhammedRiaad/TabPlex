import { addNote, deleteNote, updateNote } from './storage';
import { broadcast, respondWith } from './respond';
import { ExtensionMessage, Note } from '../types';

// Handle note-related messages
export function handleNoteMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'ADD_NOTE':
            if (message.payload) {
                const note = message.payload as Note;
                return respondWith(
                    addNote(note).then(() => broadcast('STORAGE_NOTE_ADDED', note)),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;

        case 'UPDATE_NOTE':
            // Update a note (upsert) and let other open TabPlex tabs know
            if (message.payload && (message.payload as Note).id) {
                const note = message.payload as Note;
                return respondWith(
                    updateNote(note).then(() => broadcast('STORAGE_NOTE_UPDATED', note)),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;

        case 'DELETE_NOTE':
            if (message.payload && (message.payload as { id: string }).id) {
                const id = (message.payload as { id: string }).id;
                return respondWith(
                    deleteNote(id).then(() => broadcast('STORAGE_NOTE_DELETED', { id })),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;
    }

    return false;
}
