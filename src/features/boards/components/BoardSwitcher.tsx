import React, { useEffect, useRef, useState } from 'react';
import { Board } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { generateBoardId } from '../../../utils/idGenerator';
import { validateRequiredText } from '../../../utils/formValidation';
import { useCurrentBoard } from '../utils/currentBoard';
import './BoardSwitcher.css';

const BOARD_NAME_MAX = 60;
const NEW_BOARD = '__new__';

type Toast = (message: string, type: 'success' | 'error' | 'info') => void;

/** Name + colour dialog, for a new board or a rename */
const BoardNameDialog: React.FC<{
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
const BoardDeleteDialog: React.FC<{
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

/** Board picker in the Boards header: switch, create, rename and delete boards (docs/specs/BOARD_SWITCHER.md) */
const BoardSwitcher: React.FC<{ onShowToast?: Toast }> = ({ onShowToast }) => {
    const boards = useBoardStore(state => state.boards);
    const folders = useBoardStore(state => state.folders);
    const tabs = useBoardStore(state => state.tabs);
    const { addBoard, updateBoard, deleteBoardWithContents } = useBoardStore.getState();
    const setActiveBoard = useUIStore(state => state.actions.setActiveBoard);
    const current = useCurrentBoard();
    const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const close = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [menuOpen]);

    if (!current) return null;

    const boardFolders = folders.filter(folder => folder.boardId === current.id);
    const boardFolderIds = new Set(boardFolders.map(folder => folder.id));
    const boardTabCount = tabs.filter(tab => tab.folderId && boardFolderIds.has(tab.folderId)).length;
    const others = boards.filter(board => board.id !== current.id);

    return (
        <div className="board-switcher">
            <select
                className="board-switcher-select"
                aria-label="Board"
                value={current.id}
                onChange={e => {
                    if (e.target.value === NEW_BOARD) setDialog('new');
                    else setActiveBoard(e.target.value);
                }}
            >
                {boards.map(board => (
                    <option key={board.id} value={board.id}>
                        {board.name}
                    </option>
                ))}
                <option value={NEW_BOARD}>+ New board…</option>
            </select>

            <div className="board-switcher-menu" ref={menuRef}>
                <button
                    type="button"
                    className="board-icon-btn"
                    aria-label="Board actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(open => !open)}
                >
                    ⋯
                </button>
                {menuOpen && (
                    <ul role="menu" aria-label="Board actions">
                        <li role="none">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setDialog('new');
                                }}
                            >
                                New board
                            </button>
                        </li>
                        <li role="none">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setDialog('rename');
                                }}
                            >
                                Rename board
                            </button>
                        </li>
                        <li role="none">
                            <button
                                type="button"
                                role="menuitem"
                                disabled={others.length === 0}
                                title={others.length === 0 ? 'You need at least one board' : undefined}
                                onClick={() => {
                                    setMenuOpen(false);
                                    setDialog('delete');
                                }}
                            >
                                Delete board
                            </button>
                        </li>
                    </ul>
                )}
            </div>

            {dialog === 'new' && (
                <BoardNameDialog
                    onClose={() => setDialog(null)}
                    onSave={(name, color) => {
                        const id = generateBoardId();
                        addBoard({ id, name, color });
                        setActiveBoard(id);
                        setDialog(null);
                        onShowToast?.(`Created board “${name}”`, 'success');
                    }}
                />
            )}
            {dialog === 'rename' && (
                <BoardNameDialog
                    board={current}
                    onClose={() => setDialog(null)}
                    onSave={(name, color) => {
                        updateBoard(current.id, { name, color });
                        setDialog(null);
                        onShowToast?.(`Renamed board to “${name}”`, 'success');
                    }}
                />
            )}
            {dialog === 'delete' && (
                <BoardDeleteDialog
                    board={current}
                    others={others}
                    folderCount={boardFolders.length}
                    tabCount={boardTabCount}
                    onClose={() => setDialog(null)}
                    onDelete={moveTo => {
                        deleteBoardWithContents(current.id, { moveTo });
                        setActiveBoard(moveTo ?? others[0]?.id ?? null);
                        setDialog(null);
                        onShowToast?.(`Deleted board “${current.name}”`, 'info');
                    }}
                />
            )}
        </div>
    );
};

export default BoardSwitcher;
