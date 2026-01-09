import React, { useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { Bookmark } from '../../types';
import './BookmarkView.css';
import BookmarkHeader from './components/BookmarkHeader';
import BookmarkTree from './components/BookmarkTree';
import Toast from './components/Toast';

const BookmarkView: React.FC = () => {
    const {
        bookmarkTree,
        isLoading,
        error,
        fetchBookmarks,
        createBookmark,
        createBookmarkFolder,
        updateBookmark,
        deleteBookmark,
        deleteBookmarkTree,
        moveBookmark,
        searchBookmarks,
    } = useBoardStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Bookmark[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    useEffect(() => {
        // Load bookmarks when the component mounts
        console.log('BookmarkView: Fetching bookmarks...');
        fetchBookmarks().catch(error => {
            console.error('BookmarkView: Error fetching bookmarks:', error);
        });
    }, [fetchBookmarks]);

    // Listen for bookmark changes from Chrome
    useEffect(() => {
        // Check if chrome.bookmarks API is available
        if (!chrome?.bookmarks) {
            console.warn('Chrome bookmarks API is not available');
            return;
        }

        const handleBookmarkChanged = () => {
            fetchBookmarks();
        };

        const handleBookmarkCreated = () => {
            fetchBookmarks();
        };

        const handleBookmarkRemoved = () => {
            fetchBookmarks();
        };

        const handleBookmarkMoved = () => {
            fetchBookmarks();
        };

        try {
            chrome.bookmarks.onChanged.addListener(handleBookmarkChanged);
            chrome.bookmarks.onCreated.addListener(handleBookmarkCreated);
            chrome.bookmarks.onRemoved.addListener(handleBookmarkRemoved);
            chrome.bookmarks.onMoved.addListener(handleBookmarkMoved);

            return () => {
                try {
                    chrome.bookmarks.onChanged.removeListener(handleBookmarkChanged);
                    chrome.bookmarks.onCreated.removeListener(handleBookmarkCreated);
                    chrome.bookmarks.onRemoved.removeListener(handleBookmarkRemoved);
                    chrome.bookmarks.onMoved.removeListener(handleBookmarkMoved);
                } catch (error) {
                    console.warn('Error removing bookmark listeners:', error);
                }
            };
        } catch (error) {
            console.error('Error setting up bookmark listeners:', error);
        }
    }, [fetchBookmarks]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim()) {
            setIsSearching(true);
            try {
                const results = await searchBookmarks(query);
                setSearchResults(results);
            } catch (error) {
                console.error('Error searching bookmarks:', error);
            } finally {
                setIsSearching(false);
            }
        } else {
            setSearchResults([]);
        }
    };

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
    }, []);

    const handleCreateBookmark = async (title: string, url: string, parentId?: string) => {
        try {
            await createBookmark({ title, url, parentId });
            showToast('Bookmark created successfully!', 'success');
        } catch (error) {
            console.error('Error creating bookmark:', error);
            showToast('Failed to create bookmark. Please try again.', 'error');
        }
    };

    const handleCreateFolder = async (title: string, parentId?: string) => {
        try {
            await createBookmarkFolder({ title, parentId });
            showToast('Folder created successfully!', 'success');
        } catch (error) {
            console.error('Error creating folder:', error);
            showToast('Failed to create folder. Please try again.', 'error');
        }
    };

    const handleUpdateBookmark = async (id: string, changes: { title?: string; url?: string }) => {
        try {
            await updateBookmark(id, changes);
            showToast('Bookmark updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating bookmark:', error);
            showToast('Failed to update bookmark. Please try again.', 'error');
        }
    };

    const handleDeleteBookmark = async (id: string, isFolder: boolean) => {
        if (window.confirm(`Are you sure you want to delete this ${isFolder ? 'folder' : 'bookmark'}?`)) {
            try {
                if (isFolder) {
                    await deleteBookmarkTree(id);
                } else {
                    await deleteBookmark(id);
                }
                showToast(`${isFolder ? 'Folder' : 'Bookmark'} deleted successfully!`, 'success');
            } catch (error) {
                console.error('Error deleting bookmark:', error);
                showToast('Failed to delete bookmark. Please try again.', 'error');
            }
        }
    };

    const handleMoveBookmark = async (id: string, destination: { parentId?: string; index?: number }) => {
        try {
            await moveBookmark(id, destination);
        } catch (error) {
            console.error('Error moving bookmark:', error);
            alert('Failed to move bookmark. Please try again.');
        }
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const expandAllFolders = useCallback(() => {
        const getAllFolderIds = (bookmarks: Bookmark[]): string[] => {
            const folderIds: string[] = [];
            const traverse = (items: Bookmark[]) => {
                items.forEach(item => {
                    if (!item.url && item.children && item.children.length > 0) {
                        folderIds.push(item.id);
                        traverse(item.children);
                    }
                });
            };
            traverse(bookmarks);
            return folderIds;
        };
        const allFolderIds = getAllFolderIds(bookmarkTree);
        setExpandedFolders(new Set(allFolderIds));
    }, [bookmarkTree]);

    const collapseAllFolders = useCallback(() => {
        setExpandedFolders(new Set());
    }, []);

    // For search results, we need to handle them differently since they're flat
    // For bookmark tree, we pass the tree structure
    const displayData = searchQuery.trim() ? searchResults : bookmarkTree;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+F or Cmd+F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
                const searchInput = document.querySelector('.bookmark-search-input') as HTMLInputElement;
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                    searchInput.select();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="bookmark-view">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <BookmarkHeader
                onSearch={handleSearch}
                onCreateBookmark={handleCreateBookmark}
                onCreateFolder={handleCreateFolder}
                searchQuery={searchQuery}
                onExpandAll={expandAllFolders}
                onCollapseAll={collapseAllFolders}
                hasFolders={bookmarkTree.length > 0}
                folders={bookmarkTree}
                onShowToast={showToast}
            />

            {error && <div className="bookmark-error">Error: {error}</div>}

            {isLoading ? (
                <div className="bookmark-loading">
                    <div className="bookmark-loading-skeleton">
                        <div className="bookmark-skeleton-icon"></div>
                        <div className="bookmark-skeleton-text"></div>
                    </div>
                    <div className="bookmark-loading-skeleton">
                        <div className="bookmark-skeleton-icon"></div>
                        <div className="bookmark-skeleton-text short"></div>
                    </div>
                    <div className="bookmark-loading-skeleton">
                        <div className="bookmark-skeleton-icon"></div>
                        <div className="bookmark-skeleton-text"></div>
                    </div>
                </div>
            ) : (
                <BookmarkTree
                    bookmarks={displayData}
                    expandedFolders={expandedFolders}
                    onToggleFolder={toggleFolder}
                    onUpdate={handleUpdateBookmark}
                    onDelete={handleDeleteBookmark}
                    onMove={handleMoveBookmark}
                    onOpenBookmark={(url: string) => {
                        if (url && chrome?.tabs) {
                            chrome.tabs.create({ url }).catch(error => {
                                console.error('Error opening bookmark:', error);
                            });
                        }
                    }}
                    onShowToast={showToast}
                    folders={bookmarkTree}
                />
            )}

            {searchQuery.trim() && searchResults.length === 0 && !isSearching && (
                <div className="bookmark-empty" role="status" aria-live="polite">
                    <div className="bookmark-empty-text">
                        No bookmarks found matching &quot;<strong>{searchQuery}</strong>&quot;
                    </div>
                    <div className="bookmark-empty-hint">Try adjusting your search terms</div>
                </div>
            )}

            {!searchQuery.trim() && bookmarkTree.length === 0 && !isLoading && (
                <div className="bookmark-empty" role="status" aria-live="polite">
                    <div className="bookmark-empty-text">No bookmarks yet</div>
                    <div className="bookmark-empty-hint">
                        Start by creating a bookmark or folder to organize your links
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookmarkView;
