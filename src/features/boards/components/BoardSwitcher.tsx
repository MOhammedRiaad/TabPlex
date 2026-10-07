import React, { useEffect, useRef, useState } from 'react';
import { BoardActionsProvider, useBoardActions } from '../switcher/BoardActions';
import './BoardSwitcher.css';

const NEW_BOARD = '__new__';

type Toast = (message: string, type: 'success' | 'error' | 'info') => void;

interface BoardSwitcherProps {
    onShowToast?: Toast;
    /** Show the board select (the Dropdown style). Other styles switch boards outside the header. */
    showSelect?: boolean;
}

const BoardSwitcherInner: React.FC<{ showSelect: boolean }> = ({ showSelect }) => {
    const actions = useBoardActions();
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

    if (!actions?.current) return null;
    const { boards, current } = actions;
    const solo = boards.length < 2;
    const pick = (run: () => void) => () => {
        setMenuOpen(false);
        run();
    };

    return (
        <div className="board-switcher">
            {showSelect && (
                <select
                    className="board-switcher-select"
                    aria-label="Board"
                    value={current.id}
                    onChange={e => {
                        if (e.target.value === NEW_BOARD) actions.openNew();
                        else actions.select(e.target.value);
                    }}
                >
                    {boards.map(board => (
                        <option key={board.id} value={board.id}>
                            {board.name}
                        </option>
                    ))}
                    <option value={NEW_BOARD}>+ New board…</option>
                </select>
            )}

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
                            <button type="button" role="menuitem" onClick={pick(actions.openNew)}>
                                New board
                            </button>
                        </li>
                        <li role="none">
                            <button type="button" role="menuitem" onClick={pick(() => actions.openRename())}>
                                Rename board
                            </button>
                        </li>
                        <li role="none">
                            <button
                                type="button"
                                role="menuitem"
                                disabled={solo}
                                title={solo ? 'You need at least one board' : undefined}
                                onClick={pick(() => actions.openDelete())}
                            >
                                Delete board
                            </button>
                        </li>
                    </ul>
                )}
            </div>
        </div>
    );
};

/** Board picker in the Boards header: switch, create, rename and delete boards (docs/specs/BOARD_SWITCHER.md) */
const BoardSwitcher: React.FC<BoardSwitcherProps> = ({ onShowToast, showSelect = true }) => {
    const actions = useBoardActions();
    // Inside the Boards view the provider already exists; standalone (tests, other hosts) bring our own
    if (actions) return <BoardSwitcherInner showSelect={showSelect} />;
    return (
        <BoardActionsProvider onShowToast={onShowToast}>
            <BoardSwitcherInner showSelect={showSelect} />
        </BoardActionsProvider>
    );
};

export default BoardSwitcher;
