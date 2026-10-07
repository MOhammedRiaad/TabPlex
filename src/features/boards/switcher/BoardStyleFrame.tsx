import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BoardStyle } from './boardStyle';
import { BoardActions, useBoardActions } from './BoardActions';
import BoardTabs from './BoardTabs';
import BoardShelf from './BoardShelf';
import BoardCarousel from './BoardCarousel';
import BoardDock from './BoardDock';
import BoardOverview from './BoardOverview';

interface BoardFrame {
    style: BoardStyle;
    /** Opens the Overview grid; only set in the Overview style */
    showAllBoards?: () => void;
}

const BoardFrameContext = createContext<BoardFrame>({ style: 'dropdown' });

/** The active board style, for the header (board select, All boards button) */
export function useBoardFrame(): BoardFrame {
    return useContext(BoardFrameContext);
}

const TYPING = 'input, textarea, select, [contenteditable="true"], [role="dialog"]';

/** `[` / `]` move to the previous / next board; Alt+1…9 jump to a board */
export function useBoardHotkeys(actions: BoardActions | null): void {
    useEffect(() => {
        if (!actions) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey) return;
            if (e.target instanceof Element && e.target.closest(TYPING)) return;
            if (!e.altKey && (e.key === '[' || e.key === ']')) {
                e.preventDefault();
                actions.cycle(e.key === ']' ? 1 : -1);
                return;
            }
            const digit = /^Digit([1-9])$/.exec(e.code);
            if (e.altKey && !e.shiftKey && digit) {
                const board = actions.boards[Number(digit[1]) - 1];
                if (board) {
                    e.preventDefault();
                    actions.select(board.id);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [actions]);
}

/** Wraps the board (header + folders) in the chosen style (docs/specs/BOARD_VIEWS.md) */
const BoardStyleFrame: React.FC<{ style: BoardStyle; children: React.ReactNode }> = ({ style, children }) => {
    const actions = useBoardActions();
    const [overviewOpen, setOverviewOpen] = useState(false);
    const frameRef = useRef<HTMLDivElement>(null);
    const closeOverview = useCallback(() => setOverviewOpen(false), []);
    useBoardHotkeys(actions);

    // Pinch on a trackpad (Ctrl + wheel) zooms out to the overview and back in. Needs a non-passive listener.
    useEffect(() => {
        const el = frameRef.current;
        if (style !== 'overview' || !el) return;
        let lockedUntil = 0;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            if (e.timeStamp < lockedUntil) return;
            if (e.deltaY > 2) setOverviewOpen(true);
            else if (e.deltaY < -2) setOverviewOpen(false);
            else return;
            lockedUntil = e.timeStamp + 600;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [style]);

    const frame = useMemo<BoardFrame>(
        () => ({ style, showAllBoards: style === 'overview' ? () => setOverviewOpen(true) : undefined }),
        [style]
    );

    let body: React.ReactNode;
    switch (style) {
        case 'tabs':
            body = (
                <>
                    <BoardTabs />
                    {children}
                </>
            );
            break;
        case 'accordion':
        case 'bookshelf':
            body = <BoardShelf variant={style}>{children}</BoardShelf>;
            break;
        case 'carousel':
            body = <BoardCarousel>{children}</BoardCarousel>;
            break;
        case 'dock':
            body = <BoardDock>{children}</BoardDock>;
            break;
        case 'overview':
            body = (
                <BoardOverview open={overviewOpen} onClose={closeOverview}>
                    {children}
                </BoardOverview>
            );
            break;
        default:
            body = children;
    }

    return (
        <BoardFrameContext.Provider value={frame}>
            <div ref={frameRef} className={`bsw-frame bsw-frame--${style}`}>
                {body}
            </div>
        </BoardFrameContext.Provider>
    );
};

export default BoardStyleFrame;
