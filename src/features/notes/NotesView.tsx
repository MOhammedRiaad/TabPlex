import React, { useState, useMemo } from 'react';
import { useBoardStore } from '../../store/boardStore';
import NotesHeader from './components/NotesHeader';
import NotesList from './components/NotesList';
import './NotesView.css';

const NotesView: React.FC = () => {
    const { notes } = useBoardStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Filter notes based on search query
    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return notes;

        const query = searchQuery.toLowerCase();
        return notes.filter(
            note => note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query)
        );
    }, [notes, searchQuery]);

    return (
        <div className="notes-view">
            <NotesHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                totalNotes={notes.length}
                filteredCount={filteredNotes.length}
            />
            <NotesList notes={filteredNotes} viewMode={viewMode} />
        </div>
    );
};

export default NotesView;
