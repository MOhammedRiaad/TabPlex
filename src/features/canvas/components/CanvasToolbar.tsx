import React from 'react';
import { ToolType } from '../types/canvas';
import './CanvasToolbar.css'; // Reusing existing CSS or should I make a new one? Plan said CanvasToolbar.css

// Minimal interface for props
interface CanvasToolbarProps {
    canvases: { canvasId: string }[];
    activeCanvasId: string | null;
    activeTool: string;
    gridEnabled: boolean;
    snapToGrid: boolean;
    showProperties: boolean;
    onCanvasChange: (id: string) => void;
    onCreateCanvas: () => void;
    onDeleteCanvas: () => void;
    onToolChange: (tool: ToolType) => void;
    onToggleGrid: () => void;
    onToggleSnap: () => void;
    onExport: () => void;
    onToggleProperties: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    isLayersOpen: boolean;
    onToggleLayers: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    canvases,
    activeCanvasId,
    activeTool,
    gridEnabled,
    snapToGrid,
    showProperties,
    onCanvasChange,
    onCreateCanvas,
    onDeleteCanvas,
    onToolChange,
    onToggleGrid,
    onToggleSnap,
    onExport,
    onToggleProperties,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    isLayersOpen,
    onToggleLayers,
}) => {
    return (
        <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
            <div className="canvas-toolbar-left">
                <button
                    className="tool-btn"
                    onClick={onCreateCanvas}
                    title="New Canvas"
                    aria-label="Create new canvas"
                    style={{ marginRight: '8px' }}
                >
                    ➕ New
                </button>

                {/* Canvas Selector */}
                {canvases.length > 1 && (
                    <select
                        className="canvas-selector"
                        value={activeCanvasId || ''}
                        onChange={e => onCanvasChange(e.target.value)}
                        title="Switch Canvas"
                    >
                        {canvases.map((canvas, index) => (
                            <option key={canvas.canvasId} value={canvas.canvasId}>
                                Canvas {index + 1}
                            </option>
                        ))}
                    </select>
                )}

                {/* Delete Canvas Button */}
                {canvases.length > 1 && (
                    <button
                        className="tool-btn"
                        onClick={onDeleteCanvas}
                        title="Delete Canvas"
                        style={{ marginLeft: '4px', color: '#ef4444' }}
                    >
                        🗑️
                    </button>
                )}

                <div className="separator" />

                {/* Undo/Redo */}
                <div className="tool-group">
                    <button
                        className="tool-btn"
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Undo (Ctrl+Z)"
                        style={{ opacity: canUndo ? 1 : 0.4 }}
                    >
                        ↩️
                    </button>
                    <button
                        className="tool-btn"
                        onClick={onRedo}
                        disabled={!canRedo}
                        title="Redo (Ctrl+Y)"
                        style={{ opacity: canRedo ? 1 : 0.4 }}
                    >
                        ↪️
                    </button>
                </div>

                <div className="separator" />

                {/* Selection Tools */}
                <div className="tool-group">
                    <button
                        className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
                        onClick={() => onToolChange('select')}
                        title="Select (V)"
                    >
                        ↖️
                    </button>
                </div>

                {/* Shape Tools */}
                <div className="tool-group">
                    <button
                        className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`}
                        onClick={() => onToolChange('rectangle')}
                        title="Rectangle (R)"
                    >
                        ▭
                    </button>
                    <button
                        className={`tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`}
                        onClick={() => onToolChange('ellipse')}
                        title="Ellipse (E)"
                    >
                        ⬭
                    </button>
                    <button
                        className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`}
                        onClick={() => onToolChange('line')}
                        title="Line (L)"
                    >
                        ⟋
                    </button>
                </div>

                {/* Drawing Tools */}
                <div className="tool-group">
                    <button
                        className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`}
                        onClick={() => onToolChange('pen')}
                        title="Pen (P)"
                    >
                        ✏️
                    </button>
                </div>

                {/* Text Tools */}
                <div className="tool-group">
                    <button
                        className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
                        onClick={() => onToolChange('text')}
                        title="Text (T)"
                    >
                        T
                    </button>
                    <button
                        className={`tool-btn ${activeTool === 'note' ? 'active' : ''}`}
                        onClick={() => onToolChange('note')}
                        title="Sticky Note (N)"
                    >
                        📝
                    </button>
                </div>
            </div>

            <div className="canvas-toolbar-center">
                <div className="tool-group">
                    <button className="tool-btn" onClick={onToggleGrid} title="Toggle Grid">
                        {gridEnabled ? '🔲' : '⬜'}
                    </button>
                    <button className="tool-btn" onClick={onToggleSnap} title="Snap to Grid">
                        {snapToGrid ? '🧲' : '⚪'}
                    </button>
                </div>
            </div>

            <div className="canvas-toolbar-right">
                <button className="tool-btn" onClick={onExport} title="Export to PNG">
                    📥
                </button>
                <button
                    className={`tool-btn ${isLayersOpen ? 'active' : ''}`}
                    onClick={onToggleLayers}
                    title="Toggle Layers"
                >
                    📑
                </button>
                <button
                    className={`tool-btn ${showProperties ? 'active' : ''}`}
                    onClick={onToggleProperties}
                    title="Toggle Properties"
                >
                    ⚙️
                </button>
            </div>
        </div>
    );
};
