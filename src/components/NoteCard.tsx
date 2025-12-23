import React, { useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import './NoteCard.css';

interface NoteCardProps {
  note: {
    id: string;
    content: string;
    createdAt: string;
    updatedAt?: string;
    format?: 'markdown' | 'text';
  };
}

const NoteCard: React.FC<NoteCardProps> = ({ note }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  
  const updateNote = useBoardStore(state => state.updateNote);
  const deleteNote = useBoardStore(state => state.deleteNote);

  const handleSave = () => {
    updateNote(note.id, { content: editContent });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete this note?`)) {
      deleteNote(note.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="note-card">
      {isEditing ? (
        <div className="note-edit">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="note-edit-input"
            autoFocus
          />
          <div className="note-edit-actions">
            <button onClick={handleSave} className="save-btn">
              Save
            </button>
            <button onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
            <button onClick={handleDelete} className="delete-btn">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="note-display">
          <div className="note-content">
            <p className="note-text">{note.content}</p>
          </div>
          <div className="note-meta">
            Created: {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {note.updatedAt && (
              <span>, Updated: {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
          <div className="note-actions">
            <button onClick={() => setIsEditing(true)} className="edit-btn">
              ✏️
            </button>
            <button onClick={handleDelete} className="delete-btn">
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCard;