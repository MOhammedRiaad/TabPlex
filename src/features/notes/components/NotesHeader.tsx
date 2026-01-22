import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../NotesView.css';

interface NotesHeaderProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    totalNotes: number;
    filteredCount: number;
}

const NotesHeader: React.FC<NotesHeaderProps> = ({
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
    totalNotes,
    filteredCount,
}) => {
    const navigate = useNavigate();

    return (
        <div className="notes-view-header">
            <button className="back-to-today-btn" onClick={() => navigate('/today')} type="button">
                ← Back to Today
            </button>
            <div className="notes-header-top">
                <div className="notes-title-section">
                    <h1 className="notes-view-title">
                        📝 All Notes
                        <span className="notes-count-badge">{totalNotes}</span>
                    </h1>
                    {searchQuery && filteredCount !== totalNotes && (
                        <span className="notes-filtered-count">
                            Showing {filteredCount} of {totalNotes}
                        </span>
                    )}
                </div>

                <div className="notes-view-actions">
                    {/* View Toggle */}
                    <div className="notes-view-toggle">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`notes-icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            title="Grid view"
                            aria-label="Switch to grid view"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                                <rect
                                    x="12"
                                    y="2"
                                    width="6"
                                    height="6"
                                    rx="1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                                <rect
                                    x="2"
                                    y="12"
                                    width="6"
                                    height="6"
                                    rx="1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                                <rect
                                    x="12"
                                    y="12"
                                    width="6"
                                    height="6"
                                    rx="1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`notes-icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                            title="List view"
                            aria-label="Switch to list view"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect
                                    x="2"
                                    y="3"
                                    width="16"
                                    height="3"
                                    rx="1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                                <rect
                                    x="2"
                                    y="8.5"
                                    width="16"
                                    height="3"
                                    rx="1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                                <rect
                                    x="2"
                                    y="14"
                                    width="16"
                                    height="3"
                                    rx="1"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="notes-search-bar">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12.5 12.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    type="text"
                    className="notes-search-input"
                    placeholder="Search notes by title or content..."
                    value={searchQuery}
                    onChange={e => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear-btn" onClick={() => onSearchChange('')} aria-label="Clear search">
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

export default NotesHeader;
