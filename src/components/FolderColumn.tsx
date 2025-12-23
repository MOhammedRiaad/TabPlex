import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Folder, Tab } from '../types';
import TabCard from './TabCard';
import AddTabForm from './AddTabForm';
import './FolderColumn.css';

interface FolderColumnProps {
  folder: Folder;
  tabs: Tab[];
}

const FolderColumn: React.FC<FolderColumnProps> = ({ folder, tabs }) => {
  const { setNodeRef, isOver } = useDroppable({ id: folder.id });

  return (
    <div 
      ref={setNodeRef} 
      className={`folder-column ${isOver ? 'dropping' : ''}`}
      style={{ backgroundColor: folder.color + '20' }}
    >
      <div className="folder-header">
        <h3>{folder.name}</h3>
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