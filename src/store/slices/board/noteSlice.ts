import { addNote as addNoteToDB, deleteNote as deleteNoteFromDB } from '../../../utils/storage';
import { NoteSlice, BoardStoreCreator } from './types';

export const createNoteSlice: BoardStoreCreator<NoteSlice> = set => ({
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

    updateNote: (id, updates) =>
        set(state => ({
            notes: state.notes.map(note =>
                note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
            ),
        })),

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
