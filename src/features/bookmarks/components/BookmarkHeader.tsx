import React, { useState } from 'react';
import { Bookmark } from '../../../types';
import BookmarkModal from './BookmarkModal';
import '../BookmarkView.css';

interface BookmarkHeaderProps {
    onSearch: (query: string) => void;
    onCreateBookmark: (title: string, url: string, parentId?: string) => void;
    onCreateFolder: (title: string, parentId?: string) => void;
    searchQuery: string;
    onExpandAll?: () => void;
    onCollapseAll?: () => void;
    hasFolders?: boolean;
    folders?: Bookmark[];
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const BookmarkHeader: React.FC<BookmarkHeaderProps> = ({
    onSearch,
    onCreateBookmark,
    onCreateFolder,
    searchQuery,
    onExpandAll,
    onCollapseAll,
    hasFolders,
    folders = [],
    onShowToast,
}) => {
    const [showBookmarkModal, setShowBookmarkModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);

    const handleBookmarkSubmit = (data: { title: string; url?: string; parentId?: string }) => {
        if (data.url) {
            onCreateBookmark(data.title, data.url, data.parentId);
        }
    };

    const handleFolderSubmit = (data: { title: string; url?: string; parentId?: string }) => {
        onCreateFolder(data.title, data.parentId);
    };

    return (
        <div className="bookmark-header">
            <h2>Bookmarks</h2>
            <div className="bookmark-header-actions">
                <div className="bookmark-search">
                    <input
                        type="text"
                        placeholder="Search bookmarks... (Ctrl+F)"
                        value={searchQuery}
                        onChange={e => onSearch(e.target.value)}
                        className="bookmark-search-input"
                        autoComplete="off"
                        aria-label="Search bookmarks"
                        aria-describedby="search-hint"
                    />
                    <span id="search-hint" className="sr-only">
                        Press Ctrl+F to focus search, or start typing to search
                    </span>
                </div>
                <div className="bookmark-actions">
                    <button
                        onClick={() => setShowBookmarkModal(true)}
                        className="bookmark-btn bookmark-btn-primary"
                        title="Add a new bookmark"
                        aria-label="Add bookmark"
                    >
                        ➕ Add Bookmark
                    </button>
                    <button
                        onClick={() => setShowFolderModal(true)}
                        className="bookmark-btn"
                        title="Create a new folder"
                        aria-label="Create folder"
                    >
                        📁 New Folder
                    </button>
                    {hasFolders && (
                        <>
                            <div className="bookmark-actions-divider"></div>
                            <button
                                onClick={onExpandAll}
                                className="bookmark-btn bookmark-btn-icon"
                                title="Expand all folders"
                                aria-label="Expand all folders"
                            >
                                ⬇️
                            </button>
                            <button
                                onClick={onCollapseAll}
                                className="bookmark-btn bookmark-btn-icon"
                                title="Collapse all folders"
                                aria-label="Collapse all folders"
                            >
                                ⬆️
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Create Bookmark Modal */}
            <BookmarkModal
                isOpen={showBookmarkModal}
                onClose={() => setShowBookmarkModal(false)}
                mode="create"
                isFolder={false}
                folders={folders}
                onSubmit={handleBookmarkSubmit}
                onShowToast={onShowToast}
            />

            {/* Create Folder Modal */}
            <BookmarkModal
                isOpen={showFolderModal}
                onClose={() => setShowFolderModal(false)}
                mode="create"
                isFolder={true}
                folders={folders}
                onSubmit={handleFolderSubmit}
                onShowToast={onShowToast}
            />
        </div>
    );
};

export default BookmarkHeader;
