import React, { useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import MarkdownEditor from './MarkdownEditor';
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

// Simple markdown parser for display
const parseMarkdownToHtml = (text: string): string => {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Checkboxes
    .replace(/^\s*\[x\] (.+)$/gm, '☑ $1')
    .replace(/^\s*\[ \] (.+)$/gm, '☐ $1')
    // Line breaks (simple)
    .replace(/\n/g, '<br />');

  return html;
};

const NoteCard: React.FC<NoteCardProps> = ({ note }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const updateNote = useBoardStore(state => state.updateNote);
  const deleteNote = useBoardStore(state => state.deleteNote);

  const handleSave = () => {
    updateNote(note.id, { content: editContent, format: 'markdown' });
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



  return (
    <div className={`note-card ${isEditing ? 'editing' : ''}`}>
      {isEditing ? (
        <div className="note-edit">
          <MarkdownEditor
            value={editContent}
            onChange={setEditContent}
            minHeight={200}
            autoFocus
            placeholder="Write your note in markdown..."
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
            {note.format === 'markdown' ? (
              <div
                className="note-markdown"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(note.content) }}
              />
            ) : (
              <p className="note-text">{note.content}</p>
            )}
          </div>
          <div className="note-meta">
            Created: {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {note.updatedAt && (
              <span>, Updated: {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            {note.format === 'markdown' && <span className="format-badge">MD</span>}
          </div>
          <div className="note-actions">
            <button
              onClick={() => setIsEditing(true)}
              className="edit-btn"
              aria-label="Edit note"
            >
              ✏️
            </button>
            <button
              onClick={handleDelete}
              className="delete-btn"
              aria-label="Delete note"
            >
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteCard;