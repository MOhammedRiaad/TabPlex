import React from 'react';
import './ZoomControls.css';

interface ZoomControlsProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitToScreen: () => void;
    onZoomToSelection: () => void;
    hasSelection: boolean;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
    zoom,
    onZoomIn,
    onZoomOut,
    onFitToScreen,
    onZoomToSelection,
    hasSelection,
}) => {
    return (
        <div className="zoom-controls-panel">
            <button onClick={onZoomOut} className="zoom-btn" title="Zoom Out (-)">
                −
            </button>
            <div className="zoom-display">{Math.round(zoom * 100)}%</div>
            <button onClick={onZoomIn} className="zoom-btn" title="Zoom In (+)">
                +
            </button>
            <div className="zoom-divider" />
            <button onClick={onFitToScreen} className="zoom-btn" title="Fit to Screen (0)">
                ⊡
            </button>
            {hasSelection && (
                <button onClick={onZoomToSelection} className="zoom-btn" title="Zoom to Selection">
                    ⊙
                </button>
            )}
        </div>
    );
};
