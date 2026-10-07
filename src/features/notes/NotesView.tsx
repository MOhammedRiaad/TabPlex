import React, { useState, useMemo } from 'react';
import { useBoardStore } from '../../store/boardStore';
import NotesHeader from './components/NotesHeader';
import NotesList from './components/NotesList';
import { collectTags, filterByTag } from '../../utils/tags';
import './NotesView.css';

const NotesView: React.FC = () => {
    const { notes } = useBoardStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [tagFilter, setTagFilter] = useState('');
    const tagOptions = useMemo(() => collectTags(notes), [notes]);

    // Filter notes by search query (title, content, tags) and tag
    const filteredNotes = useMemo(() => {
        const tagged = filterByTag(notes, tagFilter);
        if (!searchQuery.trim()) return tagged;

        const query = searchQuery.toLowerCase();
        return tagged.filter(
            note =>
                note.title.toLowerCase().includes(query) ||
                note.content.toLowerCase().includes(query) ||
                note.tags?.some(tag => tag.includes(query))
        );
    }, [notes, searchQuery, tagFilter]);

    return (
        <div className="notes-view">
            <NotesHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                totalNotes={notes.length}
                filteredCount={filteredNotes.length}
                tagFilter={tagFilter}
                onTagFilterChange={setTagFilter}
                tagOptions={tagOptions}
            />
            <NotesList notes={filteredNotes} viewMode={viewMode} />
        </div>
    );
};

export default NotesView;
