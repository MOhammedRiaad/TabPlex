import React, { useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import MarkdownEditor from './MarkdownEditor';
import { generateNoteId } from '../utils/idGenerator';
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
        id: generateNoteId(),
        content: content.trim(),
        folderId,
        boardId,
        format: 'markdown',
      });

      setContent('');
      setIsExpanded(false);
    }
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setContent('');
  };

  return (
    <div className="add-note-form">
      {isExpanded ? (
        <form onSubmit={handleSubmit}>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your note in markdown..."
            minHeight={150}
            autoFocus
          />
          <div className="note-form-actions">
            <button type="submit" className="add-note-btn" disabled={!content.trim()}>
              ✅ Add Note
            </button>
            <button
              type="button"
              className="cancel-note-btn"
              onClick={handleCancel}
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
          + Add Note with Markdown
        </button>
      )}
    </div>
  );
};

export default AddNoteForm;