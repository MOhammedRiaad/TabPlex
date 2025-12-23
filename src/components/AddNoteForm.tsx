import React, { useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import './AddNoteForm.css';

interface AddNoteFormProps {
  folderId?: string;
  boardId?: string;
}

const AddNoteForm: React.FC<AddNoteFormProps> = ({ folderId, boardId }) => {
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const addNote = useBoardStore(state => state.addNote);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (content.trim()) {
      addNote({
        id: `note_${Date.now()}`,
        content: content.trim(),
        folderId,
        boardId,
        format: 'text',
      });
      
      setContent('');
      setIsExpanded(false);
    }
  };

  return (
    <div className="add-note-form">
      {isExpanded ? (
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here..."
            className="note-input"
            autoFocus
          />
          <div className="note-actions">
            <button type="submit" className="add-note-btn">
              Add Note
            </button>
            <button 
              type="button" 
              className="cancel-note-btn"
              onClick={() => {
                setIsExpanded(false);
                setContent('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button 
          className="expand-note-btn"
          onClick={() => setIsExpanded(true)}
        >
          + Add Note
        </button>
      )}
    </div>
  );
};

export default AddNoteForm;