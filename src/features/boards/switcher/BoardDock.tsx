import React from 'react';
import { useBoardActions } from './BoardActions';
import { boardColorVars, boardInitials, plural } from './boardVisuals';
import { useSwitchDirection } from './useSwitchDirection';

/** Side dock: a slim rail of board avatars that widens on hover to show names and counts */
const BoardDock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const actions = useBoardActions();
    const index = actions?.current ? actions.boards.findIndex(board => board.id === actions.current?.id) : 0;
    const direction = useSwitchDirection(index);
    if (!actions?.current) return <>{children}</>;

    const { boards, current, stats, select, openNew, openRename, openContextMenu } = actions;

    return (
        <div className="bsw-dock-layout">
            <div className="bsw-dock-rail">
                <nav className="bsw-dock" aria-label="Boards">
                    <div className="bsw-dock-list">
                        {boards.map(board => {
                            const active = board.id === current.id;
                            const { folders, tabs } = stats(board.id);
                            return (
                                <button
                                    key={board.id}
                                    type="button"
                                    className={`bsw-dock-item${active ? ' is-active' : ''}`}
                                    style={boardColorVars(board)}
                                    aria-current={active ? 'true' : undefined}
                                    aria-label={board.name}
                                    title={`${board.name} · double-click to rename`}
                                    onClick={() => select(board.id)}
                                    onDoubleClick={() => openRename(board.id)}
                                    onContextMenu={e => {
                                        e.preventDefault();
                                        openContextMenu(board.id, e.clientX, e.clientY);
                                    }}
                                >
                                    <span className="bsw-avatar" aria-hidden="true">
                                        {boardInitials(board.name)}
                                    </span>
                                    <span className="bsw-dock-text" aria-hidden="true">
                                        <span className="bsw-dock-name">{board.name}</span>
                                        <span className="bsw-dock-meta">
                                            {plural(folders, 'folder', 'folders')} · {plural(tabs, 'tab', 'tabs')}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        className="bsw-dock-item bsw-dock-add"
                        aria-label="New board"
                        onClick={openNew}
                    >
                        <span className="bsw-avatar bsw-avatar-new" aria-hidden="true">
                            +
                        </span>
                        <span className="bsw-dock-text" aria-hidden="true">
                            <span className="bsw-dock-name">New board</span>
                            <span className="bsw-dock-meta">Name it and pick a colour</span>
                        </span>
                    </button>
                </nav>
            </div>
            <section
                key={current.id}
                className={`bsw-dock-main bsw-rise-${direction}`}
                style={boardColorVars(current)}
                aria-label={current.name}
            >
                {children}
            </section>
        </div>
    );
};

export default BoardDock;
