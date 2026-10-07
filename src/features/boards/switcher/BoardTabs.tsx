import React, { useEffect, useRef, useState } from 'react';
import { useBoardActions } from './BoardActions';
import { boardColorVars, plural } from './boardVisuals';

/** ▾ list of every board with a search box, for when the tab strip overflows */
const AllBoardsButton: React.FC = () => {
    const actions = useBoardActions();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    if (!actions) return null;
    const matches = actions.boards.filter(board => board.name.toLowerCase().includes(query.trim().toLowerCase()));
    const choose = (id: string) => {
        actions.select(id);
        setOpen(false);
        setQuery('');
    };

    return (
        <div className="bsw-all" ref={ref}>
            <button
                type="button"
                className="bsw-tab-icon"
                aria-label="All boards"
                title="All boards"
                aria-expanded={open}
                onClick={() => setOpen(value => !value)}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                >
                    <path d="m3.5 5.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {open && (
                <div className="bsw-all-pop" onKeyDown={e => e.key === 'Escape' && setOpen(false)}>
                    <input
                        autoFocus
                        className="bsw-all-find"
                        placeholder="Find a board"
                        aria-label="Find a board"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && matches[0] && choose(matches[0].id)}
                    />
                    <ul aria-label="Boards">
                        {matches.map(board => (
                            <li key={board.id}>
                                <button
                                    type="button"
                                    className={board.id === actions.current?.id ? 'is-active' : undefined}
                                    style={boardColorVars(board)}
                                    onClick={() => choose(board.id)}
                                >
                                    <span className="bsw-dot" />
                                    <span className="bsw-all-name">{board.name}</span>
                                    <span className="bsw-count">{actions.stats(board.id).tabs}</span>
                                </button>
                            </li>
                        ))}
                        {matches.length === 0 && <li className="bsw-all-empty">No board matches “{query}”</li>}
                    </ul>
                </div>
            )}
        </div>
    );
};

/** Board tabs: browser-style tabs above the board (default style) */
const BoardTabs: React.FC = () => {
    const actions = useBoardActions();
    const stripRef = useRef<HTMLDivElement>(null);
    const currentId = actions?.current?.id;

    // Keep the active tab in view when it changes (scrolls the strip only, never the page)
    useEffect(() => {
        const strip = stripRef.current;
        const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (!strip || !tab) return;
        const left = tab.offsetLeft;
        const right = left + tab.offsetWidth;
        if (left < strip.scrollLeft) strip.scrollLeft = left - 12;
        else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 12;
    }, [currentId]);

    if (!actions?.current) return null;
    const { boards, current, stats, select, openNew, openRename, openContextMenu } = actions;

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const index = boards.findIndex(board => board.id === current.id);
        const next = boards[(index + (e.key === 'ArrowRight' ? 1 : -1) + boards.length) % boards.length];
        select(next.id);
        requestAnimationFrame(() =>
            stripRef.current?.querySelector<HTMLElement>(`[data-board-id="${next.id}"]`)?.focus()
        );
    };

    return (
        <div className="bsw-tabs">
            <div className="bsw-tabs-strip" role="tablist" aria-label="Boards" ref={stripRef} onKeyDown={onKeyDown}>
                {boards.map(board => {
                    const active = board.id === current.id;
                    const count = stats(board.id).tabs;
                    return (
                        <button
                            key={board.id}
                            type="button"
                            role="tab"
                            data-board-id={board.id}
                            aria-selected={active}
                            tabIndex={active ? 0 : -1}
                            className={`bsw-tab${active ? ' is-active' : ''}`}
                            style={boardColorVars(board)}
                            title={`${board.name} · ${plural(count, 'tab', 'tabs')} · double-click to rename`}
                            onClick={() => select(board.id)}
                            onDoubleClick={() => openRename(board.id)}
                            onContextMenu={e => {
                                e.preventDefault();
                                openContextMenu(board.id, e.clientX, e.clientY);
                            }}
                        >
                            <span className="bsw-dot" />
                            <span className="bsw-tab-name">{board.name}</span>
                            <span className="bsw-count">{count}</span>
                        </button>
                    );
                })}
                <button
                    type="button"
                    className="bsw-tab-icon bsw-tab-add"
                    aria-label="New board"
                    title="New board"
                    onClick={openNew}
                >
                    +
                </button>
            </div>
            <AllBoardsButton />
        </div>
    );
};

export default BoardTabs;
