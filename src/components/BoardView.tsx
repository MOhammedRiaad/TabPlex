import React, { useEffect, useRef } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { useBoardStore } from '../store/boardStore';
import FolderColumn from './FolderColumn';
import AddFolderForm from './AddFolderForm';
import './BoardView.css';

const BoardView: React.FC = () => {
  const { boards, folders, tabs, moveTab, addBoard } = useBoardStore();
  const hasCheckedForDefaultBoard = useRef(false);

  // Create a default board if none exists
  const currentBoard = boards.length > 0 ? boards[0] : {
    id: 'default_board',
    name: 'My Board',
    color: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
              color: '#3b82f6'
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Check if the drop target is a folder
      const targetFolder = folders.find(f => f.id === over.id);
      
      if (targetFolder) {
        // Move tab to the target folder
        moveTab(active.id as string, targetFolder.id);
        
        // Notify background script
        chrome.runtime.sendMessage({
          type: 'MOVE_TAB',
          payload: {
            tabId: active.id,
            newFolderId: targetFolder.id
          }
        });
      }
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
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
      </div>
    </DndContext>
  );
};

export default BoardView;