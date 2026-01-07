import React, { useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { useBoardStore } from '../../store/boardStore';
import TabCard from './components/TabCard';
import FolderColumn from './components/FolderColumn';
import AddFolderForm from './components/AddFolderForm';
import './BoardView.css';

const BoardView: React.FC = () => {
    const { boards, folders, tabs, moveTab, reorderTab, addBoard } = useBoardStore();
    const hasCheckedForDefaultBoard = useRef(false);

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

    const handleDragStart = (event: DragStartEvent) => {
        if (event.active) {
            setActiveId(event.active.id as string);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
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
                        // Note: For simple move, we just set the folderId.
                        // To insert at specific position would require moveTab to support index or a separate call.
                        // Users asked for sorting "under the same folder", so basic move is fine here for now.
                        moveTab(active.id as string, overTab.folderId);
                    }
                } else if (overFolder) {
                    // Dropped on a folder (empty area)
                    moveTab(active.id as string, overFolder.id);
                }
            }

            // Sync with background if needed (store handles it mostly, but moveTab syncs. reorderTab needs to sync too?
            // reorderTab in store doesn't seem to sync to background/storage explicitly in my implementation earlier?
            // Wait, I didn't add persistence to reorderTab in the slice! I need to fix that.)
        }
        setActiveId(null);
    };

    const activeTab = activeId ? tabs.find(t => t.id === activeId) : null;

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                <DragOverlay>{activeTab ? <TabCard tab={activeTab} isOverlay /> : null}</DragOverlay>
            </div>
        </DndContext>
    );
};

export default BoardView;
