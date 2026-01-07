import React from 'react';
import NoteCard from '../../notes/components/NoteCard';
import AddNoteForm from '../../notes/components/AddNoteForm';
import '../TodayView.css';
import { Note } from '../../../types';

interface TodayNotesProps {
    notes: Note[];
}

const TodayNotes: React.FC<TodayNotesProps> = ({ notes }) => {
    return (
        <div className="notes-section">
            <h3 className="notes-header">
                <span className="status-icon">📝</span> Today&apos;s Notes
                <span className="note-count">{notes.length}</span>
            </h3>
            <div className="notes-list">
                {notes.length > 0 ? (
                    notes.map(note => <NoteCard key={note.id} note={note} />)
                ) : (
                    <p className="no-notes">No notes for today</p>
                )}
                <AddNoteForm />
            </div>
        </div>
    );
};

export default TodayNotes;
