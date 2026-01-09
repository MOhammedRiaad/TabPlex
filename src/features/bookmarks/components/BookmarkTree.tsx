import React from 'react';
import { Bookmark } from '../../../types';
import '../BookmarkView.css';
import BookmarkNode from './BookmarkNode';

interface BookmarkTreeProps {
    bookmarks: Bookmark[];
    expandedFolders: Set<string>;
    onToggleFolder: (folderId: string) => void;
    onUpdate: (id: string, changes: { title?: string; url?: string }) => void;
    onDelete: (id: string, isFolder: boolean) => void;
    onMove: (id: string, destination: { parentId?: string; index?: number }) => void;
    onOpenBookmark: (url: string) => void;
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
    folders?: Bookmark[];
    level?: number;
    parentId?: string;
}

const BookmarkTree: React.FC<BookmarkTreeProps> = ({
    bookmarks,
    expandedFolders,
    onToggleFolder,
    onUpdate,
    onDelete,
    onMove,
    onOpenBookmark,
    onShowToast,
    folders = [],
    level = 0,
    parentId,
}) => {
    // Helper to recursively find bookmarks by parent ID
    const findChildren = (bookmarkList: Bookmark[], targetParentId: string): Bookmark[] => {
        const result: Bookmark[] = [];
        for (const bookmark of bookmarkList) {
            if (bookmark.parentId === targetParentId) {
                result.push(bookmark);
            }
            if (bookmark.children && bookmark.children.length > 0) {
                result.push(...findChildren(bookmark.children, targetParentId));
            }
        }
        return result;
    };

    // Get the bookmarks to display at this level
    let bookmarksToDisplay: Bookmark[] = [];

    if (level === 0) {
        // Root level - Chrome bookmark structure:
        // Root (id: "0") contains Bookmarks Bar (id: "1") and Other Bookmarks (id: "2")
        // We want to show children of "1" and "2"

        // Find the root node (id: "0")
        const rootNode = bookmarks.find(b => b.id === '0');

        if (rootNode && rootNode.children) {
            // Get children of Bookmarks Bar (id: "1") and Other Bookmarks (id: "2")
            rootNode.children.forEach(folder => {
                if (folder.children && folder.children.length > 0) {
                    bookmarksToDisplay = [...bookmarksToDisplay, ...folder.children];
                }
            });
        } else {
            // Fallback: search the entire tree for bookmarks with parentId "1" or "2"
            const bookmarksBarChildren = findChildren(bookmarks, '1');
            const otherBookmarksChildren = findChildren(bookmarks, '2');
            bookmarksToDisplay = [...bookmarksBarChildren, ...otherBookmarksChildren];
        }
    } else {
        // Child level - find items with matching parentId
        bookmarksToDisplay = findChildren(bookmarks, parentId!);
    }

    if (bookmarksToDisplay.length === 0) {
        return null;
    }

    return (
        <div className="bookmark-tree" style={{ marginLeft: `${level * 20}px` }}>
            {bookmarksToDisplay.map(bookmark => {
                const isFolder = !bookmark.url;
                const isExpanded = expandedFolders.has(bookmark.id);
                const hasChildren = !!(bookmark.children && bookmark.children.length > 0);

                return (
                    <div key={bookmark.id} className="bookmark-tree-item">
                        <BookmarkNode
                            bookmark={bookmark}
                            isFolder={isFolder}
                            isExpanded={isExpanded}
                            hasChildren={hasChildren}
                            level={level}
                            onToggleFolder={() => onToggleFolder(bookmark.id)}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onMove={onMove}
                            onOpenBookmark={onOpenBookmark}
                            onShowToast={onShowToast}
                            folders={folders}
                        />
                        {isFolder && isExpanded && hasChildren && (
                            <BookmarkTree
                                bookmarks={bookmarks}
                                expandedFolders={expandedFolders}
                                onToggleFolder={onToggleFolder}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onMove={onMove}
                                onOpenBookmark={onOpenBookmark}
                                onShowToast={onShowToast}
                                folders={folders}
                                level={level + 1}
                                parentId={bookmark.id}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default BookmarkTree;
