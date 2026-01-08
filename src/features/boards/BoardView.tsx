import React, { useEffect, useRef, useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
} from '@dnd-kit/core';
import { useBoardStore } from '../../store/boardStore';
import TabCard from './components/TabCard';
import FolderColumn from './components/FolderColumn';
import AddFolderForm from './components/AddFolderForm';
import HistorySidePanel from './components/HistorySidePanel';
import './BoardView.css';
import { HistoryItem } from '../../types';

const BoardView: React.FC = () => {
    const { boards, folders, tabs, moveTab, reorderTab, addBoard, addTab } = useBoardStore();
    const hasCheckedForDefaultBoard = useRef(false);
    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

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

    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [draggedHistoryItem, setDraggedHistoryItem] = React.useState<HistoryItem | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        if (event.active) {
            setActiveId(event.active.id as string);
            if (event.active.data.current?.type === 'HistoryItem') {
                setDraggedHistoryItem(event.active.data.current.item as HistoryItem);
            }
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
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
            // 1. Dropped directly on a folder
            const targetFolderId = folders.find(f => f.id === over.id)?.id;

            // 2. Dropped on a tab (find its folder)
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
                    createdAt: new Date().toISOString(),
                };
                addTab(tabToAdd);
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
                        if (newIndex !== -1) {
                            reorderTab(active.id as string, newIndex, activeTab.folderId);
                        }
                    } else {
                        // Different folder - move to that folder
                        moveTab(active.id as string, overTab.folderId);
                    }
                } else if (overFolder) {
                    // Dropped on a folder (empty area)
                    moveTab(active.id as string, overFolder.id);
                }
            }
        }
        setActiveId(null);
        setDraggedHistoryItem(null);
    };

    const activeTab = activeId ? tabs.find(t => t.id === activeId) : null;

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
            <div className="board-view">
                <div className="board-header">
                    <h2>{currentBoard?.name || 'Default Board'}</h2>
                </div>
                <div className="folders-container">
                    {boardFolders.map(folder => (
                        <FolderColumn
                            key={folder.id}
                            folder={folder}
                            tabs={tabs.filter(tab => tab.folderId === folder.id)}
                        />
                    ))}
                    <AddFolderForm boardId={currentBoard?.id} />
                </div>

                <HistorySidePanel isOpen={isHistoryPanelOpen} onClose={() => setIsHistoryPanelOpen(false)} />

                <div className={`history-toggle-wrapper ${isHistoryPanelOpen ? 'open' : ''}`}>
                    <button
                        className="history-toggle-btn"
                        onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
                        title={isHistoryPanelOpen ? 'Close History' : 'Open History'}
                    >
                        <span>Load History</span>
                    </button>
                </div>

                <DragOverlay>
                    {activeTab ? <TabCard tab={activeTab} isOverlay /> : null}
                    {draggedHistoryItem ? (
                        <div className="history-drag-overlay">
                            <div className="history-item">
                                <div className="history-content">
                                    {draggedHistoryItem.favicon && (
                                        <img src={draggedHistoryItem.favicon} alt="" className="history-favicon" />
                                    )}
                                    <div className="history-text">
                                        <h3 className="history-title">{draggedHistoryItem.title}</h3>
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
