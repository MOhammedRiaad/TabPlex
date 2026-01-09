import React, { useState, useEffect } from 'react';
import { Bookmark } from '../../../types';
import { formatDate } from '../utils/dateUtils';
import BookmarkModal from './BookmarkModal';
import '../BookmarkView.css';

interface BookmarkNodeProps {
    bookmark: Bookmark;
    isFolder: boolean;
    isExpanded: boolean;
    hasChildren: boolean;
    level: number;
    onToggleFolder: () => void;
    onUpdate: (id: string, changes: { title?: string; url?: string }) => void;
    onDelete: (id: string, isFolder: boolean) => void;
    onMove: (id: string, destination: { parentId?: string; index?: number }) => void;
    onOpenBookmark: (url: string) => void;
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
    folders?: Bookmark[];
}

const BookmarkNode: React.FC<BookmarkNodeProps> = ({
    bookmark,
    isFolder,
    isExpanded,
    hasChildren,
    level,
    onToggleFolder,
    onUpdate,
    onDelete,
    onMove: _onMove, // Reserved for future drag-and-drop functionality
    onOpenBookmark,
    onShowToast,
    folders = [],
}) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

    // Get favicon for bookmark
    useEffect(() => {
        if (!isFolder && bookmark.url) {
            try {
                const url = new URL(bookmark.url);
                const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
                setFaviconUrl(favicon);
            } catch {
                // Invalid URL, use default
                setFaviconUrl(null);
            }
        }
    }, [bookmark.url, isFolder]);

    const handleEditSubmit = (data: { title: string; url?: string; parentId?: string }) => {
        onUpdate(bookmark.id, {
            title: data.title,
            url: data.url,
        });
    };

    const handleClick = () => {
        if (isFolder) {
            onToggleFolder();
        } else if (bookmark.url) {
            onOpenBookmark(bookmark.url);
        }
    };

    // Keyboard navigation support
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        } else if (e.key === 'Delete' && !isFolder) {
            e.preventDefault();
            onDelete(bookmark.id, isFolder);
        }
    };

    const handleCopyUrl = async () => {
        if (bookmark.url) {
            try {
                await navigator.clipboard.writeText(bookmark.url);
                onShowToast?.('URL copied to clipboard!', 'success');
            } catch (error) {
                console.error('Failed to copy URL:', error);
                onShowToast?.('Failed to copy URL', 'error');
            }
        }
    };

    // Format dates for display in DD-MM-YYYY format
    const addedDate = bookmark.dateAdded ? formatDate(bookmark.dateAdded) : null;
    const modifiedDate = bookmark.dateGroupModified ? formatDate(bookmark.dateGroupModified) : null;

    return (
        <>
            <div
                className={`bookmark-node ${isFolder ? 'bookmark-folder' : 'bookmark-item'}`}
                style={{ paddingLeft: `${level * 12}px` }}
                tabIndex={0}
                role="button"
                aria-label={isFolder ? `Folder: ${bookmark.title}` : `Bookmark: ${bookmark.title}`}
                aria-expanded={isFolder ? isExpanded : undefined}
                onKeyDown={handleKeyDown}
            >
                <div className="bookmark-node-content">
                    <div className="bookmark-node-main" onClick={handleClick}>
                        {isFolder ? (
                            <span className="bookmark-icon bookmark-folder-icon" aria-hidden="true">
                                {isExpanded ? '📂' : '📁'}
                            </span>
                        ) : (
                            <span className="bookmark-icon bookmark-favicon" aria-hidden="true">
                                {faviconUrl ? (
                                    <img
                                        src={faviconUrl}
                                        alt=""
                                        className="bookmark-favicon-img"
                                        onError={() => setFaviconUrl(null)}
                                    />
                                ) : (
                                    <span className="bookmark-default-icon">🔖</span>
                                )}
                            </span>
                        )}
                        <div className="bookmark-node-info">
                            <div className="bookmark-node-title-row">
                                <span className="bookmark-title" title={bookmark.title}>
                                    {bookmark.title}
                                </span>
                                {hasChildren && (
                                    <span className="bookmark-children-count">{bookmark.children?.length || 0}</span>
                                )}
                            </div>
                            {!isFolder && bookmark.url && (
                                <span className="bookmark-url" title={bookmark.url}>
                                    {(() => {
                                        try {
                                            const url = new URL(bookmark.url);
                                            return url.hostname.replace('www.', '');
                                        } catch {
                                            return bookmark.url.length > 50
                                                ? `${bookmark.url.substring(0, 50)}...`
                                                : bookmark.url;
                                        }
                                    })()}
                                </span>
                            )}
                            {/* Date information */}
                            {(addedDate || modifiedDate) && (
                                <div className="bookmark-node-meta">
                                    {addedDate && (
                                        <span className="bookmark-date" title={`Added on ${addedDate}`}>
                                            {addedDate}
                                        </span>
                                    )}
                                    {modifiedDate && modifiedDate !== addedDate && (
                                        <span className="bookmark-date" title={`Modified on ${modifiedDate}`}>
                                            Modified: {modifiedDate}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bookmark-node-actions">
                        <div className="bookmark-quick-actions">
                            {bookmark.url && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        onOpenBookmark(bookmark.url!);
                                    }}
                                    className="bookmark-action-btn"
                                    title="Open in new tab (Enter)"
                                    aria-label="Open bookmark in new tab"
                                    type="button"
                                >
                                    🔗
                                </button>
                            )}
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    setShowEditModal(true);
                                }}
                                className="bookmark-action-btn"
                                title="Edit bookmark"
                                aria-label="Edit bookmark"
                                type="button"
                            >
                                ✏️
                            </button>
                            {bookmark.url && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleCopyUrl();
                                    }}
                                    className="bookmark-action-btn"
                                    title="Copy URL to clipboard"
                                    aria-label="Copy URL to clipboard"
                                    type="button"
                                >
                                    📋
                                </button>
                            )}
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    onDelete(bookmark.id, isFolder);
                                }}
                                className="bookmark-action-btn bookmark-action-btn-danger"
                                title={`Delete ${isFolder ? 'folder' : 'bookmark'}`}
                                aria-label={`Delete ${isFolder ? 'folder' : 'bookmark'}`}
                                type="button"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <BookmarkModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                mode="edit"
                bookmark={bookmark}
                isFolder={isFolder}
                folders={folders}
                onSubmit={handleEditSubmit}
                onShowToast={onShowToast}
            />
        </>
    );
};

export default BookmarkNode;
