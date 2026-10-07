import React from 'react';
import { BOARD_STYLES, DEFAULT_BOARD_STYLE } from '../../boards/switcher/boardStyle';
import { useBoardStyle } from '../../boards/switcher/useBoardStyle';
import BoardStyleIcon from '../../boards/switcher/BoardStyleIcon';

/** Settings → Boards: how the Boards view lets you move between boards */
const BoardStyleSetting: React.FC = () => {
    const { style, updateStyle } = useBoardStyle();

    return (
        <div className="setting-item setting-item-stacked">
            <div className="setting-info">
                <h4 id="board-style-label">Board switcher</h4>
                <p>How you move between boards in the Boards view. Each TabPlex tab picks up the change.</p>
            </div>
            <div className="board-style-grid" role="radiogroup" aria-labelledby="board-style-label">
                {BOARD_STYLES.map(option => (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={style === option.id}
                        className="board-style-option"
                        onClick={() => updateStyle(option.id)}
                    >
                        <span className="board-style-icon">
                            <BoardStyleIcon style={option.id} />
                        </span>
                        <span className="board-style-name">
                            {option.label}
                            {option.id === DEFAULT_BOARD_STYLE && <span className="board-style-tag">Default</span>}
                        </span>
                        <span className="board-style-desc">{option.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BoardStyleSetting;
