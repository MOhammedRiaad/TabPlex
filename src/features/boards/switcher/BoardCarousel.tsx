import React, { useRef } from 'react';
import { useBoardActions } from './BoardActions';
import { boardColorVars } from './boardVisuals';
import { useSwitchDirection } from './useSwitchDirection';

/** Horizontal trackpad scroll needed to move one board */
export const SWIPE_WHEEL_DISTANCE = 120;
/** Finger travel needed to move one board */
export const SWIPE_TOUCH_DISTANCE = 60;
const SWIPE_COOLDOWN_MS = 450;

/** Spaces carousel: swipe between boards side by side, neighbours peek in at the edges */
const BoardCarousel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const actions = useBoardActions();
    const index = actions?.current ? actions.boards.findIndex(board => board.id === actions.current?.id) : 0;
    const direction = useSwitchDirection(index);
    const wheel = useRef({ total: 0, lockedUntil: 0 });
    const touch = useRef<{ x: number; y: number } | null>(null);
    if (!actions?.current) return <>{children}</>;

    const { boards, current, stats, select, cycle, openNew } = actions;
    const previous = boards[index - 1];
    const next = boards[index + 1];

    const onWheel = (e: React.WheelEvent) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.timeStamp < wheel.current.lockedUntil) return;
        wheel.current.total += e.deltaX;
        if (Math.abs(wheel.current.total) >= SWIPE_WHEEL_DISTANCE) {
            cycle(wheel.current.total > 0 ? 1 : -1);
            wheel.current = { total: 0, lockedUntil: e.timeStamp + SWIPE_COOLDOWN_MS };
        }
    };
    const onPointerDown = (e: React.PointerEvent) => {
        touch.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
    };
    const onPointerUp = (e: React.PointerEvent) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) >= SWIPE_TOUCH_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) cycle(dx < 0 ? 1 : -1);
    };

    return (
        <div className="bsw-carousel" onWheel={onWheel} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
            <div className="bsw-dots" role="tablist" aria-label="Boards">
                {boards.map(board => (
                    <button
                        key={board.id}
                        type="button"
                        role="tab"
                        aria-selected={board.id === current.id}
                        aria-label={board.name}
                        className={`bsw-dot-btn${board.id === current.id ? ' is-active' : ''}`}
                        style={boardColorVars(board)}
                        onClick={() => select(board.id)}
                    >
                        <span>{board.name}</span>
                    </button>
                ))}
                <button
                    type="button"
                    className="bsw-dot-btn bsw-dot-new"
                    aria-label="New board"
                    title="New board"
                    onClick={openNew}
                >
                    +
                </button>
            </div>

            <div className="bsw-carousel-row">
                {previous ? (
                    <button
                        type="button"
                        className="bsw-peek bsw-peek--previous"
                        style={boardColorVars(previous)}
                        aria-label={`Previous board: ${previous.name}`}
                        onClick={() => select(previous.id)}
                    >
                        <span className="bsw-peek-arrow" aria-hidden="true">
                            ‹
                        </span>
                        <span className="bsw-peek-count">{stats(previous.id).tabs}</span>
                        <span className="bsw-peek-name">{previous.name}</span>
                    </button>
                ) : (
                    <span className="bsw-peek bsw-peek--blank" />
                )}

                <section
                    key={current.id}
                    className={`bsw-carousel-current bsw-enter-${direction}`}
                    style={boardColorVars(current)}
                    aria-label={current.name}
                >
                    {children}
                </section>

                {next ? (
                    <button
                        type="button"
                        className="bsw-peek bsw-peek--next"
                        style={boardColorVars(next)}
                        aria-label={`Next board: ${next.name}`}
                        onClick={() => select(next.id)}
                    >
                        <span className="bsw-peek-arrow" aria-hidden="true">
                            ›
                        </span>
                        <span className="bsw-peek-count">{stats(next.id).tabs}</span>
                        <span className="bsw-peek-name">{next.name}</span>
                    </button>
                ) : (
                    <button type="button" className="bsw-peek bsw-peek--new" aria-label="New board" onClick={openNew}>
                        <span className="bsw-peek-plus" aria-hidden="true">
                            +
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default BoardCarousel;
