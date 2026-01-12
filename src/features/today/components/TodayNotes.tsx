import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import NoteCard from '../../notes/components/NoteCard';
import AddNoteForm from '../../notes/components/AddNoteForm';
import '../TodayView.css';
import { Note } from '../../../types';

interface TodayNotesProps {
    notes: Note[];
}

const TodayNotes: React.FC<TodayNotesProps> = ({ notes }) => {
    const navigate = useNavigate();

    // Get 6 latest notes sorted by creation date
    const latestNotes = useMemo(() => {
        return [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
    }, [notes]);

    const hasMoreNotes = notes.length > 6;

    return (
        <div className="notes-section">
            <h3 className="notes-header">
                <span className="status-icon">📝</span> Today&apos;s Notes
                <span className="note-count">{notes.length}</span>
            </h3>
            <div className="notes-list">
                {latestNotes.length > 0 ? (
                    latestNotes.map(note => <NoteCard key={note.id} note={note} />)
                ) : (
                    <p className="no-notes">No notes for today</p>
                )}
                <AddNoteForm />
                {hasMoreNotes && (
                    <button className="view-more-btn" onClick={() => navigate('/notes')} type="button">
                        View All Notes ({notes.length})
                    </button>
                )}
            </div>
        </div>
    );
};

export default TodayNotes;
