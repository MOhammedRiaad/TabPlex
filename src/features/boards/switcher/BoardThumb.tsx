import React, { useMemo } from 'react';
import { Board } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { plural } from './boardVisuals';

const MAX_COLUMNS = 4;
const MAX_LINES = 5;

/** Miniature of a board: its folders as small columns with one line per saved tab */
const BoardThumb: React.FC<{ board: Board; tabCount: number }> = ({ board, tabCount }) => {
    const folders = useBoardStore(state => state.folders);
    const tabs = useBoardStore(state => state.tabs);
    const columns = useMemo(
        () =>
            folders
                .filter(folder => folder.boardId === board.id)
                .map(folder => ({ folder, lines: tabs.filter(tab => tab.folderId === folder.id).length })),
        [board.id, folders, tabs]
    );

    return (
        <span className="bsw-thumb">
            <span className="bsw-thumb-band" />
            <span className="bsw-thumb-title">
                <span className="bsw-thumb-name">{board.name}</span>
                <span className="bsw-count">{tabCount}</span>
            </span>
            <span className="bsw-thumb-mini" aria-hidden="true">
                {columns.length === 0 ? (
                    <span className="bsw-thumb-empty">Empty board</span>
                ) : (
                    columns.slice(0, MAX_COLUMNS).map(({ folder, lines }) => (
                        <span key={folder.id} className="bsw-thumb-col">
                            <span className="bsw-thumb-colhead" style={{ background: folder.color }} />
                            {Array.from({ length: Math.min(lines, MAX_LINES) }, (_, i) => (
                                <span key={i} className="bsw-thumb-line" />
                            ))}
                        </span>
                    ))
                )}
            </span>
            <span className="bsw-thumb-meta">
                {plural(columns.length, 'folder', 'folders')}
                {columns.length > MAX_COLUMNS ? ` · showing ${MAX_COLUMNS}` : ''}
            </span>
        </span>
    );
};

export default BoardThumb;
