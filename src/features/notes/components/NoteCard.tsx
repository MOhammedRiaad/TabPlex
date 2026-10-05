import React, { useState } from 'react';
import { Note } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import MarkdownEditor from '../../ui/components/MarkdownEditor';
import TagInput, { TagList } from '../../ui/components/TagInput';
import { collectTags } from '../../../utils/tags';
import { escapeHtml, renderMarkdownLinks } from '../../../utils/markdown';
import './NoteCard.css';

interface NoteCardProps {
    note: Note;
}

// Simple markdown parser for display
const parseMarkdownToHtml = (text: string): string => {
    const html = escapeHtml(text)
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
        // Checkboxes
        .replace(/^\s*\[x\] (.+)$/gm, '☑ $1')
        .replace(/^\s*\[ \] (.+)$/gm, '☐ $1')
        // Line breaks (simple)
        .replace(/\n/g, '<br />');

    // Links: only web and mail URLs
    return renderMarkdownLinks(html);
};

const NoteCard: React.FC<NoteCardProps> = ({ note }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(note.content);
    const [editTags, setEditTags] = useState<string[]>(note.tags ?? []);
    const allNotes = useBoardStore(state => state.notes);

    const updateNote = useBoardStore(state => state.updateNote);
    const deleteNote = useBoardStore(state => state.deleteNote);

    const handleSave = () => {
        updateNote(note.id, { content: editContent, format: 'markdown', tags: editTags });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(note.content);
        setEditTags(note.tags ?? []);
        setIsEditing(false);
    };

    // Start from the latest content and tags (they may have changed in another tab)
    const startEditing = () => {
        setEditContent(note.content);
        setEditTags(note.tags ?? []);
        setIsEditing(true);
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete this note?`)) {
            deleteNote(note.id);
        }
    };

    return (
        <div className={`note-card ${isEditing ? 'editing' : ''} ${note.pinned ? 'is-pinned' : ''}`}>
            {isEditing ? (
                <div className="note-edit">
                    <MarkdownEditor
                        value={editContent}
                        onChange={setEditContent}
                        minHeight={200}
                        autoFocus
                        placeholder="Write your note in markdown..."
                    />
                    <TagInput
                        tags={editTags}
                        onChange={setEditTags}
                        suggestions={collectTags(allNotes).map(t => t.tag)}
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
                    <h3 className="note-title">{note.title}</h3>
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
                    <TagList tags={note.tags} />
                    <div className="note-meta">
                        Created:{' '}
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {note.updatedAt && (
                            <span>
                                , Updated:{' '}
                                {new Date(note.updatedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </span>
                        )}
                        {note.format === 'markdown' && <span className="format-badge">MD</span>}
                    </div>
                    <div className="note-actions">
                        <button
                            onClick={() => updateNote(note.id, { pinned: !note.pinned })}
                            className={`pin-btn ${note.pinned ? 'active' : ''}`}
                            aria-pressed={Boolean(note.pinned)}
                            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                            title={note.pinned ? 'Unpin note' : 'Pin note to the top'}
                        >
                            📌
                        </button>
                        <button onClick={startEditing} className="edit-btn" aria-label="Edit note">
                            ✏️
                        </button>
                        <button onClick={handleDelete} className="delete-btn" aria-label="Delete note">
                            🗑️
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NoteCard;
