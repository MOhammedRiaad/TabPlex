import React, { useEffect, useRef, useState } from 'react';
import { Note } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import MarkdownEditor from '../../ui/components/MarkdownEditor';
import TagInput, { TagList } from '../../ui/components/TagInput';
import { collectTags } from '../../../utils/tags';
import { escapeHtml, renderMarkdownLinks } from '../../../utils/markdown';
import NoteAiMenu from './NoteAiMenu';
import NoteAiDialog from './NoteAiDialog';
import { ActionItem, NoteAiAction, NoteHelper, insertSummary, startNoteHelper } from '../utils/aiNoteHelpers';
import { generateTaskId } from '../../../utils/idGenerator';
import { useUIStore } from '../../ui/store/uiStore';
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

    // ✨ AI helpers: the running helper, the model download progress, and the text before the last Replace (Undo)
    const [aiRun, setAiRun] = useState<{ action: NoteAiAction; helper: NoteHelper; text: string } | null>(null);
    const [aiProgress, setAiProgress] = useState<number | null>(null);
    const [undo, setUndo] = useState<{ before: string; after: string; label: string } | null>(null);
    const helperRef = useRef<NoteHelper | null>(null);

    // Free the model if the card goes away while a helper is open
    useEffect(() => () => helperRef.current?.release(), []);

    /** Runs in the menu click (and Try again): the model is created with user activation */
    const startAi = (action: NoteAiAction) => {
        helperRef.current?.release();
        setAiProgress(null);
        const helper = startNoteHelper(action, setAiProgress);
        helperRef.current = helper;
        setAiRun({ action, helper, text: editContent });
    };

    const closeAi = () => {
        helperRef.current?.release();
        helperRef.current = null;
        setAiRun(null);
    };

    const applyAiText = (next: string, label: string) => {
        setUndo({ before: editContent, after: next, label });
        setEditContent(next);
        closeAi();
    };

    const createTasks = (items: ActionItem[]) => {
        const { addTask } = useBoardStore.getState();
        for (const item of items) {
            addTask({
                id: generateTaskId(),
                title: item.title,
                status: 'todo',
                priority: item.priority,
                description: `From note “${note.title}”`,
                tags: note.tags?.length ? [...note.tags] : undefined,
            });
        }
        useUIStore
            .getState()
            .actions.showToast(`Created ${items.length} ${items.length === 1 ? 'task' : 'tasks'}`, 'success');
        closeAi();
    };

    // Undo only makes sense until the text is edited again
    const changeContent = (value: string) => {
        setEditContent(value);
        if (undo && value !== undo.after) setUndo(null);
    };

    const handleSave = () => {
        updateNote(note.id, { content: editContent, format: 'markdown', tags: editTags });
        setUndo(null);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(note.content);
        setEditTags(note.tags ?? []);
        setUndo(null);
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
                        onChange={changeContent}
                        minHeight={200}
                        autoFocus
                        placeholder="Write your note in markdown..."
                        aiMenu={<NoteAiMenu text={editContent} onStart={startAi} />}
                    />
                    {undo && (
                        <div className="note-ai-undo" role="status">
                            {undo.label}
                            <button
                                type="button"
                                onClick={() => {
                                    setEditContent(undo.before);
                                    setUndo(null);
                                }}
                            >
                                Undo
                            </button>
                        </div>
                    )}
                    {aiRun && (
                        <NoteAiDialog
                            action={aiRun.action}
                            helper={aiRun.helper}
                            text={aiRun.text}
                            existingTaskTitles={useBoardStore.getState().tasks.map(task => task.title)}
                            progress={aiProgress}
                            onRetry={() => startAi(aiRun.action)}
                            onReplace={text =>
                                applyAiText(text, aiRun.action === 'proofread' ? 'Note proofread' : 'Note rewritten')
                            }
                            onInsertSummary={summary =>
                                applyAiText(insertSummary(editContent, summary), 'Summary added')
                            }
                            onCreateTasks={createTasks}
                            onClose={closeAi}
                        />
                    )}
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
