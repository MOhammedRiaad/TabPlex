import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Folder, Tab } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import BoardModal from './BoardModal';
import FolderDeleteModal from './FolderDeleteModal';
import { getFaviconUrl } from '../../../utils/favicon';
import '../BoardView.css';

interface BoardNodeProps {
    folder?: Folder;
    tab?: Tab;
    tabs?: Tab[];
    onUpdateFolder?: (id: string, changes: { name?: string; color?: string }) => void;
    onUpdateTab?: (id: string, changes: { title?: string; url?: string; folderId?: string }) => void;
    onDeleteFolder?: (id: string) => void;
    onDeleteTab?: (id: string) => void;
    onOpenTab?: (url: string) => void;
    onCreateTab?: (data: { title: string; url: string; folderId?: string }) => void;
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
    folders?: Folder[];
}

const BoardNode: React.FC<BoardNodeProps> = ({
    folder,
    tab,
    tabs = [],
    onUpdateFolder,
    onUpdateTab,
    onDeleteFolder,
    onDeleteTab,
    onOpenTab,
    onCreateTab,
    onShowToast,
    folders = [],
}) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddTabModal, setShowAddTabModal] = useState(false);
    const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const { moveAllTabsToFolder } = useBoardStore();

    const isFolder = !!folder;
    const folderTabs = isFolder && folder ? tabs.filter(t => t.folderId === folder.id) : [];

    // Make folders droppable
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: folder?.id || '',
        disabled: !isFolder,
        data: {
            type: 'Folder',
            folder,
        },
    });

    // Make tabs sortable/draggable
    const sortable = useSortable({
        id: tab?.id || '',
        disabled: !tab || isFolder,
        data: {
            type: 'Tab',
            tab,
        },
    });

    const {
        attributes: sortableAttributes,
        listeners: sortableListeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging,
    } = tab && !isFolder
        ? sortable
        : { attributes: {}, listeners: {}, setNodeRef: null, transform: null, transition: null, isDragging: false };

    const dragStyle: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    // Get favicon for tab
    useEffect(() => {
        if (tab && tab.url) {
            setFaviconUrl(tab.favicon || getFaviconUrl(tab.url));
        }
    }, [tab]);

    const handleEditSubmit = (data: {
        name?: string;
        title?: string;
        url?: string;
        color?: string;
        folderId?: string;
    }) => {
        if (isFolder && folder && onUpdateFolder) {
            onUpdateFolder(folder.id, {
                name: data.name,
                color: data.color,
            });
        } else if (tab && onUpdateTab) {
            onUpdateTab(tab.id, {
                title: data.title,
                url: data.url,
                folderId: data.folderId || '',
            });
        }
    };

    const handleClick = () => {
        if (isFolder) {
            setIsExpanded(!isExpanded);
        } else if (tab && tab.url && onOpenTab) {
            onOpenTab(tab.url);
        }
    };

    const handleDelete = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (isFolder && folder && onDeleteFolder) {
            // Check if folder has tabs
            if (folderTabs.length > 0) {
                // Show the delete modal for folders with tabs
                setShowDeleteModal(true);
            } else {
                // Simple confirmation for empty folders
                if (window.confirm(`Are you sure you want to delete the empty folder "${folder.name}"?`)) {
                    onDeleteFolder(folder.id);
                }
            }
        } else if (tab && onDeleteTab) {
            if (window.confirm(`Are you sure you want to delete "${tab.title}"?`)) {
                onDeleteTab(tab.id);
            }
        }
    };

    const handleMoveAndDelete = (targetFolderId: string) => {
        if (folder && onDeleteFolder) {
            // Move all tabs to the target folder
            moveAllTabsToFolder(folder.id, targetFolderId);
            // Delete the folder
            onDeleteFolder(folder.id);
            onShowToast?.(`Moved ${folderTabs.length} tabs and deleted folder "${folder.name}"`, 'success');
        }
    };

    const handleForceDelete = () => {
        if (folder && onDeleteFolder) {
            onDeleteFolder(folder.id);
            onShowToast?.(`Deleted folder "${folder.name}" and ${folderTabs.length} tabs`, 'info');
        }
    };

    const handleCopyUrl = async () => {
        if (tab && tab.url) {
            try {
                await navigator.clipboard.writeText(tab.url);
                onShowToast?.('URL copied to clipboard!', 'success');
            } catch (error) {
                console.error('Failed to copy URL:', error);
                onShowToast?.('Failed to copy URL', 'error');
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        } else if (e.key === 'Delete') {
            e.preventDefault();
            handleDelete();
        }
    };

    const nodeRef = isFolder ? setDroppableRef : setSortableRef || null;

    // Folder color styling
    // Check if dark mode is enabled
    const isDarkMode =
        typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

    const folderColorStyle: React.CSSProperties =
        isFolder && folder?.color
            ? {
                  borderLeftColor: folder.color,
                  background: isDarkMode
                      ? `linear-gradient(135deg, ${folder.color}15 0%, rgba(31, 41, 55, 0.6) 100%)`
                      : `linear-gradient(135deg, ${folder.color}08 0%, var(--color-bg-primary, #ffffff) 100%)`,
              }
            : {};

    return (
        <>
            <div
                ref={nodeRef}
                style={{
                    ...(!isFolder ? dragStyle : undefined),
                    ...folderColorStyle,
                }}
                className={`board-node ${isFolder ? 'board-folder' : 'board-item'} ${isOver ? 'board-dropping' : ''} ${isDragging ? 'board-dragging' : ''}`}
                aria-label={isFolder ? `Folder: ${folder?.name}` : `Tab: ${tab?.title}`}
                aria-expanded={isFolder ? isExpanded : undefined}
                onKeyDown={handleKeyDown}
                {...(!isFolder && tab
                    ? { tabIndex: 0, role: 'button', ...sortableAttributes }
                    : { tabIndex: 0, role: 'button' })}
            >
                <div className="board-node-content">
                    <div
                        className="board-node-main"
                        onClick={handleClick}
                        style={{ cursor: !isFolder ? 'grab' : 'pointer' }}
                    >
                        {!isFolder && tab && (
                            <span className="board-drag-handle" {...sortableListeners} {...sortableAttributes}>
                                ⋮⋮
                            </span>
                        )}
                        {isFolder ? (
                            <span
                                className="board-icon board-folder-icon"
                                aria-hidden="true"
                                style={
                                    folder?.color
                                        ? {
                                              background: `linear-gradient(135deg, ${folder.color}15 0%, ${folder.color}08 100%)`,
                                              color: folder.color,
                                          }
                                        : undefined
                                }
                            >
                                {isExpanded ? '📂' : '📁'}
                            </span>
                        ) : (
                            <span className="board-icon board-favicon" aria-hidden="true">
                                {faviconUrl ? (
                                    <img
                                        src={faviconUrl}
                                        alt=""
                                        className="board-favicon-img"
                                        onError={() => setFaviconUrl(null)}
                                    />
                                ) : (
                                    <span className="board-default-icon">🌐</span>
                                )}
                            </span>
                        )}
                        <div className="board-node-info">
                            <div className="board-node-title-row">
                                <span className="board-title" title={isFolder ? folder?.name : tab?.title}>
                                    {isFolder ? folder?.name : tab?.title}
                                </span>
                                {isFolder && folderTabs.length > 0 && (
                                    <span className="board-children-count">{folderTabs.length}</span>
                                )}
                            </div>
                            {!isFolder && tab && tab.url && (
                                <span className="board-url" title={tab.url}>
                                    {(() => {
                                        try {
                                            const url = new URL(tab.url);
                                            return url.hostname.replace('www.', '');
                                        } catch {
                                            return tab.url.length > 50 ? `${tab.url.substring(0, 50)}...` : tab.url;
                                        }
                                    })()}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="board-node-actions">
                        <div className="board-quick-actions">
                            {!isFolder && tab && tab.url && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        if (onOpenTab) onOpenTab(tab.url);
                                    }}
                                    className="board-action-btn"
                                    title="Open in new tab"
                                    aria-label="Open tab in new tab"
                                    type="button"
                                >
                                    🔗
                                </button>
                            )}
                            {isFolder && onCreateTab && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        setShowAddTabModal(true);
                                    }}
                                    className="board-action-btn"
                                    title="Add tab to this folder"
                                    aria-label="Add tab to folder"
                                    type="button"
                                >
                                    ➕
                                </button>
                            )}
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    setShowEditModal(true);
                                }}
                                className="board-action-btn"
                                title={`Edit ${isFolder ? 'folder' : 'tab'}`}
                                aria-label={`Edit ${isFolder ? 'folder' : 'tab'}`}
                                type="button"
                            >
                                ✏️
                            </button>
                            {!isFolder && tab && tab.url && (
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        handleCopyUrl();
                                    }}
                                    className="board-action-btn"
                                    title="Copy URL to clipboard"
                                    aria-label="Copy URL to clipboard"
                                    type="button"
                                >
                                    📋
                                </button>
                            )}
                            <button
                                onClick={handleDelete}
                                className="board-action-btn board-action-btn-danger"
                                title={`Delete ${isFolder ? 'folder' : 'tab'}`}
                                aria-label={`Delete ${isFolder ? 'folder' : 'tab'}`}
                                type="button"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <BoardModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                mode="edit"
                type={isFolder ? 'folder' : 'tab'}
                folder={folder}
                tab={tab}
                folders={folders}
                onSubmit={handleEditSubmit}
                onShowToast={onShowToast}
            />

            {/* Folder Delete Modal */}
            {isFolder && folder && (
                <FolderDeleteModal
                    isOpen={showDeleteModal}
                    folder={folder}
                    folderTabCount={folderTabs.length}
                    availableFolders={folders.filter(f => f.id !== folder.id)}
                    onClose={() => setShowDeleteModal(false)}
                    onMoveAndDelete={handleMoveAndDelete}
                    onForceDelete={handleForceDelete}
                />
            )}

            {/* Add Tab Modal for Folder */}
            {isFolder && folder && (
                <BoardModal
                    isOpen={showAddTabModal}
                    onClose={() => setShowAddTabModal(false)}
                    mode="create"
                    type="tab"
                    folders={folders}
                    initialFolderId={folder.id}
                    onSubmit={data => {
                        if (data.title && data.url && onCreateTab) {
                            onCreateTab({
                                title: data.title,
                                url: data.url,
                                folderId: folder.id,
                            });
                            setShowAddTabModal(false);
                        }
                    }}
                    onShowToast={onShowToast}
                />
            )}

            {/* Render folder children */}
            {isFolder && isExpanded && folderTabs.length > 0 && (
                <div className="board-folder-children">
                    {folderTabs.map(childTab => (
                        <BoardNode
                            key={childTab.id}
                            tab={childTab}
                            tabs={tabs}
                            onUpdateTab={onUpdateTab}
                            onDeleteTab={onDeleteTab}
                            onOpenTab={onOpenTab}
                            onShowToast={onShowToast}
                            folders={folders}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

export default BoardNode;
