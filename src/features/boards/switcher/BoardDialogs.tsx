import React, { useState } from 'react';
import { Board } from '../../../types';
import { validateRequiredText } from '../../../utils/formValidation';
import '../components/BoardSwitcher.css';

export const BOARD_NAME_MAX = 60;

/** Name + colour dialog, for a new board or a rename */
export const BoardNameDialog: React.FC<{
    board?: Board;
    onSave: (name: string, color: string) => void;
    onClose: () => void;
}> = ({ board, onSave, onClose }) => {
    const [name, setName] = useState(board?.name ?? '');
    const [color, setColor] = useState(board?.color ?? '#3b82f6');
    const [error, setError] = useState<string>();
    const title = board ? 'Rename board' : 'New board';

    return (
        <div className="board-switcher-overlay" onClick={onClose}>
            <form
                className="board-switcher-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.key === 'Escape' && onClose()}
                onSubmit={e => {
                    e.preventDefault();
                    const problem = validateRequiredText(name, 'Name', BOARD_NAME_MAX);
                    if (problem) return setError(problem);
                    onSave(name.trim(), color);
                }}
                noValidate
            >
                <h2>{title}</h2>
                <label>
                    Name
                    <input
                        autoFocus
                        value={name}
                        maxLength={BOARD_NAME_MAX}
                        onChange={e => {
                            setName(e.target.value);
                            setError(undefined);
                        }}
                        aria-invalid={Boolean(error)}
                    />
                </label>
                {error && (
                    <p className="board-switcher-error" role="alert">
                        {error}
                    </p>
                )}
                <label>
                    Colour
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} />
                </label>
                <div className="board-switcher-actions">
                    <button type="button" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" className="primary">
                        {board ? 'Save' : 'Create board'}
                    </button>
                </div>
            </form>
        </div>
    );
};

/** Delete a board: move its folders to another board, or delete them with their tabs */
export const BoardDeleteDialog: React.FC<{
    board: Board;
    others: Board[];
    folderCount: number;
    tabCount: number;
    onDelete: (moveTo?: string) => void;
    onClose: () => void;
}> = ({ board, others, folderCount, tabCount, onDelete, onClose }) => {
    const [mode, setMode] = useState<'move' | 'delete'>('move');
    const [target, setTarget] = useState(others[0]?.id ?? '');
    const empty = folderCount === 0 && tabCount === 0;

    return (
        <div className="board-switcher-overlay" onClick={onClose}>
            <div
                className="board-switcher-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={`Delete “${board.name}”`}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.key === 'Escape' && onClose()}
            >
                <h2>Delete “{board.name}”?</h2>
                {empty ? (
                    <p>This board has no folders or tabs.</p>
                ) : (
                    <>
                        <p>
                            It has {folderCount} {folderCount === 1 ? 'folder' : 'folders'} and {tabCount} saved{' '}
                            {tabCount === 1 ? 'tab' : 'tabs'}.
                        </p>
                        <label className="board-switcher-choice">
                            <input type="radio" checked={mode === 'move'} onChange={() => setMode('move')} />
                            Move them to
                            <select
                                value={target}
                                onChange={e => setTarget(e.target.value)}
                                aria-label="Move to board"
                                disabled={mode !== 'move'}
                            >
                                {others.map(other => (
                                    <option key={other.id} value={other.id}>
                                        {other.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="board-switcher-choice">
                            <input type="radio" checked={mode === 'delete'} onChange={() => setMode('delete')} />
                            Delete them too
                        </label>
                    </>
                )}
                <div className="board-switcher-actions">
                    <button type="button" onClick={onClose} autoFocus>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="danger"
                        onClick={() => onDelete(!empty && mode === 'move' ? target : undefined)}
                    >
                        Delete board
                    </button>
                </div>
            </div>
        </div>
    );
};
