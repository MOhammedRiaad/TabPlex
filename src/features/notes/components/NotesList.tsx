import React from 'react';
import NoteCard from './NoteCard';
import AddNoteForm from './AddNoteForm';
import { Note } from '../../../types';
import { pinnedFirst } from '../../../utils/pinned';
import '../NotesView.css';

interface NotesListProps {
    notes: Note[];
    viewMode: 'grid' | 'list';
}

const NotesList: React.FC<NotesListProps> = ({ notes, viewMode }) => {
    return (
        <div className={`notes-view-content ${viewMode}-view`}>
            {notes.length > 0 ? (
                pinnedFirst(notes).map(note => <NoteCard key={note.id} note={note} />)
            ) : (
                <div className="notes-empty-state">
                    <span className="empty-icon">📝</span>
                    <h3>No notes found</h3>
                    <p>Start creating notes to see them here</p>
                </div>
            )}
            <AddNoteForm />
        </div>
    );
};

export default NotesList;
