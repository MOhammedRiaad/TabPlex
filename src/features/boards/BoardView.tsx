import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    closestCenter,
} from '@dnd-kit/core';
import { useBoardStore } from '../../store/boardStore';
import HistorySidePanel from './components/HistorySidePanel';
import BoardHeader from './components/BoardHeader';
import BoardList from './components/BoardList';
import BoardToast from './components/BoardToast';
import { HistoryItem } from '../../types';
import './BoardView.css';

const BoardView: React.FC = () => {
    const {
        boards,
        folders,
        tabs,
        addBoard,
        addFolder,
        addTab,
        updateFolder,
        updateTab,
        deleteFolder,
        deleteTab,
        moveTab,
        reorderTab,
    } = useBoardStore();
    const hasCheckedForDefaultBoard = useRef(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggedHistoryItem, setDraggedHistoryItem] = useState<HistoryItem | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Create a default board if none exists
    const currentBoard =
        boards.length > 0
            ? boards[0]
            : {
                  id: 'default_board',
                  name: 'My Board',
                  color: '#3b82f6',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
              };

    useEffect(() => {
        // Check if default_board already exists in the boards array
        const defaultBoardExists = boards.some(board => board.id === 'default_board');

        // Only create default board if:
        // 1. We haven't checked yet in this mount
        // 2. No boards exist at all
        // 3. The default board doesn't already exist
        if (!hasCheckedForDefaultBoard.current) {
            if (boards.length === 0 && !defaultBoardExists) {
                // Wait a bit for data to load from IndexedDB before creating default board
                const timeoutId = setTimeout(() => {
                    // Double-check that boards are still empty and default doesn't exist
                    const currentBoards = useBoardStore.getState().boards;
                    const stillNoDefault = !currentBoards.some(board => board.id === 'default_board');

                    if (currentBoards.length === 0 && stillNoDefault) {
                        addBoard({
                            id: 'default_board',
                            name: 'My Board',
                            color: '#3b82f6',
                        });
                    }
                    hasCheckedForDefaultBoard.current = true;
                }, 500); // Wait 500ms for data to load

                return () => clearTimeout(timeoutId);
            } else {
                // Boards exist or default board already exists, mark as checked
                hasCheckedForDefaultBoard.current = true;
            }
        }
    }, [boards, addBoard]);

    const boardFolders = folders.filter(folder => folder.boardId === currentBoard.id);

    // Get set of valid folder IDs in this board
    const boardFolderIds = new Set(boardFolders.map(f => f.id));

    const boardTabs = tabs.filter(tab => {
        // Include tabs that belong to folders in this board
        if (tab.folderId && tab.folderId !== '' && boardFolderIds.has(tab.folderId)) {
            return true;
        }
        // Include tabs without folders (they belong to the board but not a specific folder)
        if (!tab.folderId || tab.folderId === '') {
            return true;
        }
        // Include orphaned tabs (tabs with folder IDs that no longer exist in ANY folder)
        // This handles migration from old designs where folders may have been restructured
        const folderStillExists = folders.some(f => f.id === tab.folderId);
        if (!folderStillExists) {
            // Clear the orphaned folderId so the tab shows in "uncategorized"
            return true;
        }
        // Tab belongs to a folder in a different board
        return false;
    });

    // Search functionality
    const filteredFolders = useMemo(() => {
        if (!searchQuery.trim()) return boardFolders;

        const query = searchQuery.toLowerCase();
        return boardFolders.filter(folder => {
            const folderMatches = folder.name.toLowerCase().includes(query);
            const tabsInFolder = boardTabs.filter(tab => tab.folderId === folder.id);
            const tabsMatch = tabsInFolder.some(
                tab => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)
            );
            return folderMatches || tabsMatch;
        });
    }, [boardFolders, boardTabs, searchQuery]);

    const filteredTabs = useMemo(() => {
        if (!searchQuery.trim()) return boardTabs;

        const query = searchQuery.toLowerCase();
        return boardTabs.filter(
            tab => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)
        );
    }, [boardTabs, searchQuery]);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
    }, []);

    const handleCreateFolder = useCallback(
        (data: { name: string; color: string }) => {
            if (currentBoard?.id) {
                addFolder({
                    id: `folder_${Date.now()}`,
                    name: data.name,
                    boardId: currentBoard.id,
                    color: data.color,
                    order: 0,
                });
                showToast('Folder created successfully!', 'success');
            }
        },
        [addFolder, currentBoard, showToast]
    );

    const handleCreateTab = useCallback(
        (data: { title: string; url: string; folderId?: string }) => {
            const tabToAdd = {
                id: `tab_${Date.now()}`,
                title: data.title,
                url: data.url,
                favicon: undefined,
                folderId: data.folderId || '',
                tabId: null,
                lastAccessed: new Date().toISOString(),
                status: 'closed' as const,
            };
            addTab(tabToAdd);
            showToast('Tab created successfully!', 'success');
        },
        [addTab, showToast]
    );

    const handleUpdateFolder = useCallback(
        (id: string, changes: { name?: string; color?: string }) => {
            updateFolder(id, changes);
            showToast('Folder updated successfully!', 'success');
        },
        [updateFolder, showToast]
    );

    const handleUpdateTab = useCallback(
        (id: string, changes: { title?: string; url?: string; folderId?: string }) => {
            updateTab(id, changes);
            showToast('Tab updated successfully!', 'success');
        },
        [updateTab, showToast]
    );

    const handleDeleteFolder = useCallback(
        (id: string) => {
            deleteFolder(id);
            showToast('Folder deleted successfully!', 'success');
        },
        [deleteFolder, showToast]
    );

    const handleDeleteTab = useCallback(
        (id: string) => {
            deleteTab(id);
            showToast('Tab deleted successfully!', 'success');
        },
        [deleteTab, showToast]
    );

    const handleOpenTab = useCallback((url: string) => {
        if (url && chrome?.tabs) {
            chrome.tabs.create({ url }).catch(error => {
                console.error('Error opening tab:', error);
            });
        }
    }, []);

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        if (event.active) {
            setActiveId(event.active.id as string);
            if (event.active.data.current?.type === 'HistoryItem') {
                setDraggedHistoryItem(event.active.data.current.item as HistoryItem);
            }
        }
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;

            if (!over) {
                setActiveId(null);
                setDraggedHistoryItem(null);
                return;
            }

            // Handle History Item Drop
            if (active.data.current?.type === 'HistoryItem') {
                const historyItem = active.data.current.item as HistoryItem;
                // Find target folder
                const targetFolderId = folders.find(f => f.id === over.id)?.id;

                // Check if dropped on a tab (find its folder)
                const targetTab = tabs.find(t => t.id === over.id);
                const folderIdFromTab = targetTab?.folderId;

                const finalFolderId = targetFolderId || folderIdFromTab;

                if (finalFolderId) {
                    const tabToAdd = {
                        id: `tab_${Date.now()}_${historyItem.id}`,
                        title: historyItem.title,
                        url: historyItem.url,
                        favicon: historyItem.favicon,
                        folderId: finalFolderId,
                        tabId: null,
                        lastAccessed: new Date().toISOString(),
                        status: 'closed' as const,
                    };
                    addTab(tabToAdd);
                    showToast('History item added to folder!', 'success');
                }

                setActiveId(null);
                setDraggedHistoryItem(null);
                return;
            }

            // Handle Tab Reorder/Move
            if (active.id !== over.id) {
                const activeTab = tabs.find(t => t.id === active.id);
                const overTab = tabs.find(t => t.id === over.id);
                const overFolder = folders.find(f => f.id === over.id);

                if (activeTab) {
                    if (overTab) {
                        // Dropped on another tab
                        if (activeTab.folderId === overTab.folderId) {
                            // Same folder - reorder
                            const folderTabs = tabs.filter(t => t.folderId === activeTab.folderId);
                            const newIndex = folderTabs.findIndex(t => t.id === over.id);
                            if (newIndex !== -1 && activeTab.folderId) {
                                reorderTab(active.id as string, newIndex, activeTab.folderId);
                            }
                        } else {
                            // Different folder - move to that folder
                            moveTab(active.id as string, overTab.folderId || '');
                            showToast('Tab moved to folder!', 'success');
                        }
                    } else if (overFolder) {
                        // Dropped on a folder (empty area)
                        moveTab(active.id as string, overFolder.id);
                        showToast('Tab moved to folder!', 'success');
                    }
                }
            }
            setActiveId(null);
            setDraggedHistoryItem(null);
        },
        [folders, tabs, addTab, moveTab, reorderTab, showToast]
    );

    const activeTab = activeId ? tabs.find(t => t.id === activeId) : null;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+F or Cmd+F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
                const searchInput = document.querySelector('.board-search-input-modern') as HTMLInputElement;
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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="board-view">
                {toast && <BoardToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <BoardHeader
                    boardName={currentBoard?.name || 'Default Board'}
                    folders={boardFolders}
                    tabs={boardTabs}
                    searchQuery={searchQuery}
                    onSearch={handleSearch}
                    onCreateFolder={handleCreateFolder}
                    onCreateTab={handleCreateTab}
                    onShowHistory={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
                    isHistoryOpen={isHistoryPanelOpen}
                    onShowToast={showToast}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />

                {boardFolders.length === 0 && !hasCheckedForDefaultBoard.current ? (
                    <div className="board-loading">
                        <div className="board-loading-skeleton">
                            <div className="board-skeleton-item"></div>
                            <div className="board-skeleton-item"></div>
                            <div className="board-skeleton-item"></div>
                        </div>
                    </div>
                ) : filteredFolders.length === 0 && filteredTabs.length === 0 && searchQuery.trim() ? (
                    <div className="board-empty" role="status" aria-live="polite">
                        <div className="board-empty-text">
                            No folders or tabs found matching &quot;<strong>{searchQuery}</strong>&quot;
                        </div>
                        <div className="board-empty-hint">Try adjusting your search terms</div>
                    </div>
                ) : (
                    <BoardList
                        folders={filteredFolders}
                        tabs={filteredTabs}
                        onUpdateFolder={handleUpdateFolder}
                        onUpdateTab={handleUpdateTab}
                        onDeleteFolder={handleDeleteFolder}
                        onDeleteTab={handleDeleteTab}
                        onOpenTab={handleOpenTab}
                        onCreateTab={handleCreateTab}
                        onShowToast={showToast}
                        viewMode={viewMode}
                    />
                )}

                <HistorySidePanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} />

                <DragOverlay>
                    {activeTab ? (
                        <div className="board-node board-item board-drag-overlay">
                            <div className="board-node-content">
                                <div className="board-node-main">
                                    <span className="board-icon board-favicon">
                                        <span className="board-default-icon">🌐</span>
                                    </span>
                                    <div className="board-node-info">
                                        <div className="board-node-title-row">
                                            <span className="board-title">{activeTab.title}</span>
                                        </div>
                                        <span className="board-url">{activeTab.url}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : draggedHistoryItem ? (
                        <div className="board-node board-item board-drag-overlay">
                            <div className="board-node-content">
                                <div className="board-node-main">
                                    <span className="board-icon board-favicon">
                                        {draggedHistoryItem.favicon ? (
                                            <img
                                                src={draggedHistoryItem.favicon}
                                                alt=""
                                                className="board-favicon-img"
                                            />
                                        ) : (
                                            <span className="board-default-icon">🌐</span>
                                        )}
                                    </span>
                                    <div className="board-node-info">
                                        <div className="board-node-title-row">
                                            <span className="board-title">{draggedHistoryItem.title}</span>
                                        </div>
                                        <span className="board-url">{draggedHistoryItem.url}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
};

export default BoardView;
