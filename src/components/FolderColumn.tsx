import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Folder, Tab } from '../types';
import { useBoardStore } from '../store/boardStore';
import TabCard from './TabCard';
import AddTabForm from './AddTabForm';
import './FolderColumn.css';

interface FolderColumnProps {
  folder: Folder;
  tabs: Tab[];
}

const FolderColumn: React.FC<FolderColumnProps> = ({ folder, tabs }) => {
  const { setNodeRef, isOver } = useDroppable({ id: folder.id });
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  
  const updateFolder = useBoardStore(state => state.updateFolder);

  const handleEdit = () => {
    setIsEditing(true);
    setEditName(folder.name);
  };
  
  const handleSave = () => {
    updateFolder(folder.id, { name: editName });
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditName(folder.name);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };
  
  return (
    <div 
      ref={setNodeRef} 
      className={`folder-column ${isOver ? 'dropping' : ''}`}
      style={{ backgroundColor: folder.color + '20' }}
    >
      <div className="folder-header">
        {isEditing ? (
          <div className="folder-edit">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="folder-name-input"
            />
            <div className="folder-edit-actions">
              <button onClick={handleSave} className="save-btn">✓</button>
              <button onClick={handleCancel} className="cancel-btn">✕</button>
            </div>
          </div>
        ) : (
          <div className="folder-display">
            <h3 onClick={handleEdit}>{folder.name}</h3>
            <button onClick={handleEdit} className="edit-folder-btn">✏️</button>
          </div>
        )}
      </div>
      <div className="tabs-container">
        {tabs.map(tab => (
          <TabCard key={tab.id} tab={tab} />
        ))}
        <AddTabForm folderId={folder.id} />
      </div>
    </div>
  );
};

export default FolderColumn;