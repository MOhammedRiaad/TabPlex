import React from 'react';
import './CanvasStatusBar.css';

interface CanvasStatusBarProps {
    activeTool: string;
    elementCount: number;
    selectedCount: number;
}

export const CanvasStatusBar: React.FC<CanvasStatusBarProps> = ({ activeTool, elementCount, selectedCount }) => {
    return (
        <div className="canvas-status-bar">
            <div className="status-item">
                <span>Tool: {activeTool}</span>
            </div>
            <div className="status-item">
                <span>Elements: {elementCount}</span>
            </div>
            {selectedCount > 0 && (
                <div className="status-item">
                    <span>Selected: {selectedCount}</span>
                </div>
            )}
        </div>
    );
};
