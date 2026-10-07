import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { generateBoardId } from '../../../utils/idGenerator';
import { useCurrentBoard } from '../utils/currentBoard';
import { BoardDeleteDialog, BoardNameDialog } from './BoardDialogs';
import './BoardSwitcherStyles.css';

type Toast = (message: string, type: 'success' | 'error' | 'info') => void;

export interface BoardStats {
    folders: number;
    tabs: number;
}

export interface BoardActions {
    boards: Board[];
    current: Board | undefined;
    stats: (boardId: string) => BoardStats;
    select: (boardId: string) => void;
    /** Move to the next (+1) or previous (-1) board, wrapping around */
    cycle: (delta: number) => void;
    openNew: () => void;
    openRename: (boardId?: string) => void;
    openDelete: (boardId?: string) => void;
    /** Right-click menu for any board: Open, Rename, Delete */
    openContextMenu: (boardId: string, x: number, y: number) => void;
}

const BoardActionsContext = createContext<BoardActions | null>(null);

/** The board actions from the nearest BoardActionsProvider, or null outside one */
export function useBoardActions(): BoardActions | null {
    return useContext(BoardActionsContext);
}

type Dialog = { kind: 'new' } | { kind: 'rename' | 'delete'; boardId: string } | null;

/** Context menu for one board, at the pointer */
const BoardContextMenu: React.FC<{
    board: Board;
    isCurrent: boolean;
    canDelete: boolean;
    x: number;
    y: number;
    onOpen: () => void;
    onRename: () => void;
    onDelete: () => void;
    onClose: () => void;
}> = ({ board, isCurrent, canDelete, x, y, onOpen, onRename, onDelete, onClose }) => {
    const ref = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        // Page scroll only: inner scrollers (the tab strip nudging a focused tab into view) must not close it
        window.addEventListener('scroll', onClose);
        ref.current?.querySelector('button')?.focus();
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onClose);
        };
    }, [onClose]);

    const item = (
        label: string,
        onClick: () => void,
        extra: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>> = {}
    ) => (
        <li role="none">
            <button type="button" role="menuitem" onClick={onClick} {...extra}>
                {label}
            </button>
        </li>
    );

    return (
        <ul
            ref={ref}
            className="bsw-context-menu"
            role="menu"
            aria-label={`${board.name} actions`}
            style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 140) }}
        >
            {!isCurrent && item(`Open “${board.name}”`, onOpen)}
            {item('Rename board', onRename)}
            {item('Delete board', onDelete, {
                disabled: !canDelete,
                title: canDelete ? undefined : 'You need at least one board',
                className: 'danger',
            })}
        </ul>
    );
};

/** Switch, create, rename and delete boards, shared by every board style (docs/specs/BOARD_VIEWS.md) */
export const BoardActionsProvider: React.FC<{ onShowToast?: Toast; children: React.ReactNode }> = ({
    onShowToast,
    children,
}) => {
    const boards = useBoardStore(state => state.boards);
    const folders = useBoardStore(state => state.folders);
    const tabs = useBoardStore(state => state.tabs);
    const setActiveBoard = useUIStore(state => state.actions.setActiveBoard);
    const current = useCurrentBoard();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [menu, setMenu] = useState<{ boardId: string; x: number; y: number } | null>(null);

    const statsById = useMemo(() => {
        const folderBoard = new Map(folders.map(folder => [folder.id, folder.boardId]));
        const map = new Map<string, BoardStats>();
        const entry = (id: string) => {
            if (!map.has(id)) map.set(id, { folders: 0, tabs: 0 });
            return map.get(id) as BoardStats;
        };
        folders.forEach(folder => entry(folder.boardId).folders++);
        tabs.forEach(tab => {
            const boardId = tab.folderId ? folderBoard.get(tab.folderId) : undefined;
            if (boardId) entry(boardId).tabs++;
        });
        return map;
    }, [folders, tabs]);

    const stats = useCallback((boardId: string) => statsById.get(boardId) ?? { folders: 0, tabs: 0 }, [statsById]);

    const cycle = useCallback(
        (delta: number) => {
            if (!current || boards.length < 2) return;
            const index = boards.findIndex(board => board.id === current.id);
            setActiveBoard(boards[(index + delta + boards.length) % boards.length].id);
        },
        [boards, current, setActiveBoard]
    );

    const closeMenu = useCallback(() => setMenu(null), []);

    const actions = useMemo<BoardActions>(
        () => ({
            boards,
            current,
            stats,
            select: setActiveBoard,
            cycle,
            openNew: () => setDialog({ kind: 'new' }),
            openRename: boardId => current && setDialog({ kind: 'rename', boardId: boardId ?? current.id }),
            openDelete: boardId => current && setDialog({ kind: 'delete', boardId: boardId ?? current.id }),
            openContextMenu: (boardId, x, y) => setMenu({ boardId, x, y }),
        }),
        [boards, current, stats, setActiveBoard, cycle]
    );

    const target = dialog && dialog.kind !== 'new' ? boards.find(board => board.id === dialog.boardId) : undefined;
    const menuBoard = menu ? boards.find(board => board.id === menu.boardId) : undefined;

    return (
        <BoardActionsContext.Provider value={actions}>
            {children}

            {menu && menuBoard && (
                <BoardContextMenu
                    board={menuBoard}
                    isCurrent={menuBoard.id === current?.id}
                    canDelete={boards.length > 1}
                    x={menu.x}
                    y={menu.y}
                    onClose={closeMenu}
                    onOpen={() => {
                        closeMenu();
                        setActiveBoard(menuBoard.id);
                    }}
                    onRename={() => {
                        closeMenu();
                        setDialog({ kind: 'rename', boardId: menuBoard.id });
                    }}
                    onDelete={() => {
                        closeMenu();
                        setDialog({ kind: 'delete', boardId: menuBoard.id });
                    }}
                />
            )}

            {dialog?.kind === 'new' && (
                <BoardNameDialog
                    onClose={() => setDialog(null)}
                    onSave={(name, color) => {
                        const id = generateBoardId();
                        useBoardStore.getState().addBoard({ id, name, color });
                        setActiveBoard(id);
                        setDialog(null);
                        onShowToast?.(`Created board “${name}”`, 'success');
                    }}
                />
            )}
            {dialog?.kind === 'rename' && target && (
                <BoardNameDialog
                    board={target}
                    onClose={() => setDialog(null)}
                    onSave={(name, color) => {
                        useBoardStore.getState().updateBoard(target.id, { name, color });
                        setDialog(null);
                        onShowToast?.(`Renamed board to “${name}”`, 'success');
                    }}
                />
            )}
            {dialog?.kind === 'delete' && target && (
                <BoardDeleteDialog
                    board={target}
                    others={boards.filter(board => board.id !== target.id)}
                    folderCount={stats(target.id).folders}
                    tabCount={stats(target.id).tabs}
                    onClose={() => setDialog(null)}
                    onDelete={moveTo => {
                        const others = boards.filter(board => board.id !== target.id);
                        useBoardStore.getState().deleteBoardWithContents(target.id, { moveTo });
                        if (target.id === current?.id) setActiveBoard(moveTo ?? others[0]?.id ?? null);
                        setDialog(null);
                        onShowToast?.(`Deleted board “${target.name}”`, 'info');
                    }}
                />
            )}
        </BoardActionsContext.Provider>
    );
};
