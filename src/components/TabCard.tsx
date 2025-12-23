import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Tab } from '../types';
import { useBoardStore } from '../store/boardStore';
import './TabCard.css';

interface TabCardProps {
  tab: Tab;
}

const TabCard: React.FC<TabCardProps> = ({ tab }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(tab.title);
  const [editUrl, setEditUrl] = useState(tab.url);
  
  const updateTab = useBoardStore(state => state.updateTab);
  const deleteTab = useBoardStore(state => state.deleteTab);
  
  const handleTabClick = () => {
    // Open the tab in a new browser tab
    window.open(tab.url, '_blank');
  };
  
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${tab.title}"?`)) {
      deleteTab(tab.id);
    }
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = () => {
    updateTab(tab.id, { title: editTitle, url: editUrl });
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditTitle(tab.title);
    setEditUrl(tab.url);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    const { attributes, listeners, setNodeRef, transform } = 
      useDraggable({ id: tab.id });
    
    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;
    
    return (
      <div 
        ref={setNodeRef}
        style={style}
        className="tab-card editing"
      >
        <div className="tab-header" {...listeners} {...attributes}>
          <div className="drag-handle" {...listeners} {...attributes}>⋮⋮</div>
          <div className="tab-icon">
            {tab.favicon ? (
              <img src={tab.favicon} alt="" />
            ) : (
              <div className="default-icon">🌐</div>
            )}
          </div>
        </div>
        <div className="tab-edit">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="edit-title"
          />
          <input
            type="text"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="edit-url"
          />
          <div className="edit-actions">
            <button onClick={handleSave}>Save</button>
            <button onClick={handleCancel}>Cancel</button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="delete-btn">
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { attributes, listeners, setNodeRef, transform } = 
    useDraggable({ id: tab.id });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;
  
  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="tab-card"
    >
      <div className="tab-header" {...listeners} {...attributes}>
        <div className="drag-handle" {...listeners} {...attributes}>⋮⋮</div>
        <div className="tab-icon" onClick={handleTabClick}>
          {tab.favicon ? (
            <img src={tab.favicon} alt="" />
          ) : (
            <div className="default-icon" onClick={handleTabClick}>🌐</div>
          )}
        </div>
      </div>
      <div className="tab-content">
        <h4 className="tab-title" onClick={(e) => { e.stopPropagation(); handleTabClick(); }}>{tab.title}</h4>
        <p className="tab-url" onClick={(e) => { e.stopPropagation(); handleTabClick(); }}>{tab.url}</p>
        <div className="tab-actions">
          <button className="edit-btn" onClick={(e) => { e.stopPropagation(); handleEdit(); }}>
            ✏️
          </button>
          <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

export default TabCard;