import React from 'react';
import { Board } from '../../../types';
import { useBoardActions } from './BoardActions';
import { boardColorVars, plural, stableVariation } from './boardVisuals';
import { useSwitchDirection } from './useSwitchDirection';
import { useNarrowScreen } from './useNarrowScreen';

type ShelfVariant = 'accordion' | 'bookshelf';

/**
 * Accordion and Bookshelf: closed boards are spines on either side of the open board.
 * Accordion spines are full-height strips; Bookshelf spines are slim books of varying height on a shelf.
 */
const BoardShelf: React.FC<{ variant: ShelfVariant; children: React.ReactNode }> = ({ variant, children }) => {
    const actions = useBoardActions();
    const index = actions?.current ? actions.boards.findIndex(board => board.id === actions.current?.id) : 0;
    const direction = useSwitchDirection(index);
    const narrow = useNarrowScreen();
    if (!actions?.current) return <>{children}</>;

    const { boards, current, stats, select, openNew, openContextMenu } = actions;
    const before = boards.slice(0, index);
    const after = boards.slice(index + 1);

    const spine = (board: Board) => {
        const count = stats(board.id).tabs;
        const height = variant === 'bookshelf' ? `${78 + stableVariation(board.id, 23)}%` : '100%';
        return (
            <button
                key={board.id}
                type="button"
                className="bsw-spine"
                style={boardColorVars(board, { '--book-height': height })}
                aria-label={`Open ${board.name}, ${plural(count, 'tab', 'tabs')}`}
                title={`${board.name} · right-click to rename or delete`}
                onClick={() => select(board.id)}
                onContextMenu={e => {
                    e.preventDefault();
                    openContextMenu(board.id, e.clientX, e.clientY);
                }}
            >
                <span className="bsw-spine-count">{count}</span>
                <span className="bsw-spine-name">{board.name}</span>
            </button>
        );
    };

    const newSpine = (
        <button
            key="__new__"
            type="button"
            className="bsw-spine bsw-spine-new"
            aria-label="New board"
            title="New board"
            onClick={openNew}
        >
            <span className="bsw-spine-plus" aria-hidden="true">
                +
            </span>
            <span className="bsw-spine-name">New board</span>
        </button>
    );

    if (narrow) {
        // No room beside the board: every spine sits in one scrolling row above it, the open one marked
        return (
            <div className={`bsw-shelf bsw-shelf--${variant} bsw-shelf--narrow`}>
                <div className="bsw-spine-group" role="group" aria-label="Boards">
                    {boards.map(board =>
                        board.id === current.id ? (
                            <span
                                key={board.id}
                                className="bsw-spine is-open"
                                style={boardColorVars(board, { '--book-height': '100%' })}
                                aria-current="true"
                                title={board.name}
                            >
                                <span className="bsw-spine-count">{stats(board.id).tabs}</span>
                                <span className="bsw-spine-name">{board.name}</span>
                            </span>
                        ) : (
                            spine(board)
                        )
                    )}
                    {newSpine}
                </div>
                <section
                    key={current.id}
                    className={`bsw-shelf-open bsw-enter-${direction}`}
                    style={boardColorVars(current)}
                    aria-label={current.name}
                >
                    {children}
                </section>
            </div>
        );
    }

    return (
        <div className={`bsw-shelf bsw-shelf--${variant}`}>
            {before.length > 0 && <div className="bsw-spine-group">{before.map(spine)}</div>}
            <section
                key={current.id}
                className={`bsw-shelf-open bsw-enter-${direction}`}
                style={boardColorVars(current)}
                aria-label={current.name}
            >
                {children}
            </section>
            <div className="bsw-spine-group">
                {after.map(spine)}
                {newSpine}
            </div>
        </div>
    );
};

export default BoardShelf;
