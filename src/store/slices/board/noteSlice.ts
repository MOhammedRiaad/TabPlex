import {
    addNote as addNoteToDB,
    deleteNote as deleteNoteFromDB,
    updateNote as updateNoteInDB,
} from '../../../utils/storage';
import { Note } from '../../../types';
import { deriveNoteTitle } from '../../../utils/noteTitle';
import { NoteSlice, BoardStoreCreator } from './types';

export const createNoteSlice: BoardStoreCreator<NoteSlice> = (set, get) => ({
    notes: [],

    addNote: note => {
        const newNote = {
            ...note,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        set(state => ({
            notes: [...state.notes, newNote],
        }));

        addNoteToDB(newNote).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'ADD_NOTE',
                payload: newNote,
            })
            .catch(console.error);
    },

    updateNote: (id, updates) => {
        const note = get().notes.find(n => n.id === id);
        if (!note) return;

        const updatedNote: Note = {
            ...note,
            ...updates,
            // The title is the first line: keep it in step when the content changes (unless one is given)
            title: updates.title ?? (updates.content !== undefined ? deriveNoteTitle(updates.content) : note.title),
            updatedAt: new Date().toISOString(),
        };

        set(state => ({ notes: state.notes.map(n => (n.id === id ? updatedNote : n)) }));

        updateNoteInDB(updatedNote).catch(console.error);

        // Keep the background copy and other open TabPlex tabs in sync
        chrome.runtime
            .sendMessage({
                type: 'UPDATE_NOTE',
                payload: updatedNote,
            })
            .catch(console.error);
    },

    deleteNote: id => {
        set(state => ({
            notes: state.notes.filter(note => note.id !== id),
        }));

        deleteNoteFromDB(id).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'DELETE_NOTE',
                payload: { id },
            })
            .catch(console.error);
    },

    deleteNoteSilently: id => {
        set(state => ({
            notes: state.notes.filter(note => note.id !== id),
        }));

        deleteNoteFromDB(id).catch(console.error);
    },
});
