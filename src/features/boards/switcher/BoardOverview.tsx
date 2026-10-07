import React, { useEffect, useRef, useState } from 'react';
import { useBoardActions } from './BoardActions';
import BoardThumb from './BoardThumb';
import { boardColorVars, plural } from './boardVisuals';

/** Overview: zoom out to every board as a live thumbnail, then zoom into the one you pick */
const BoardOverview: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({
    open,
    onClose,
    children,
}) => {
    const actions = useBoardActions();
    const gridRef = useRef<HTMLDivElement>(null);
    const [zoomOrigin, setZoomOrigin] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        // Keep the page where it is so the All boards heading stays in view
        gridRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus({ preventScroll: true });
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (e.target instanceof Element && e.target.closest('[role="dialog"], [role="menu"]')) return;
            onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!actions?.current || !open) {
        return (
            <div
                className={`bsw-ov-board${zoomOrigin ? ' bsw-zoom-in' : ''}`}
                style={zoomOrigin ? { transformOrigin: zoomOrigin } : undefined}
                onAnimationEnd={() => setZoomOrigin(null)}
            >
                {children}
            </div>
        );
    }

    const { boards, current, stats, select, openNew, openContextMenu } = actions;
    const total = boards.reduce((sum, board) => sum + stats(board.id).tabs, 0);

    const pick = (boardId: string, card: HTMLElement) => {
        const grid = gridRef.current?.getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        if (grid && grid.width > 0) {
            const x = ((rect.left + rect.width / 2 - grid.left) / grid.width) * 100;
            setZoomOrigin(`${x.toFixed(1)}% ${Math.round(rect.top + rect.height / 2 - grid.top)}px`);
        }
        select(boardId);
        onClose();
    };

    return (
        <div className="bsw-overview" ref={gridRef}>
            <div className="bsw-ov-head">
                <h2>All boards</h2>
                <span className="bsw-ov-meta">
                    {plural(boards.length, 'board', 'boards')} · {plural(total, 'tab', 'tabs')}
                </span>
                <span className="bsw-ov-spacer" />
                <button type="button" className="board-action-btn" onClick={onClose}>
                    Back to {current.name}
                </button>
            </div>
            <div className="bsw-ov-grid">
                {boards.map((board, i) => (
                    <button
                        key={board.id}
                        type="button"
                        className={`bsw-ov-card${board.id === current.id ? ' is-active' : ''}`}
                        style={{ ...boardColorVars(board), animationDelay: `${Math.min(i, 12) * 30}ms` }}
                        aria-current={board.id === current.id ? 'true' : undefined}
                        aria-label={`Open ${board.name}`}
                        onClick={e => pick(board.id, e.currentTarget)}
                        onContextMenu={e => {
                            e.preventDefault();
                            openContextMenu(board.id, e.clientX, e.clientY);
                        }}
                    >
                        <BoardThumb board={board} tabCount={stats(board.id).tabs} />
                    </button>
                ))}
                <button type="button" className="bsw-ov-card bsw-ov-new" onClick={openNew}>
                    + New board
                </button>
            </div>
        </div>
    );
};

export default BoardOverview;
