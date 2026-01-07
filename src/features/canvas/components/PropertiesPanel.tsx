import React from 'react';
import { CanvasState, CanvasElement, StrokeStyle } from '../types/canvas';
import ColorPicker from './ColorPicker';
import './CanvasContainer.css';

interface PropertiesPanelProps {
    activeCanvas: CanvasState;
    onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
    onBringToFront: (ids: string[]) => void;
    onSendToBack: (ids: string[]) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    activeCanvas,
    onUpdateElement,
    onBringToFront,
    onSendToBack,
}) => {
    return (
        <div className="properties-panel">
            <div className="properties-section">
                <h3>Canvas</h3>
                <div className="property-row">
                    <span className="property-label">Elements</span>
                    <span>{activeCanvas.elements.length}</span>
                </div>
                <div className="property-row">
                    <span className="property-label">Selected</span>
                    <span>{activeCanvas.selectedIds.length}</span>
                </div>
            </div>

            {activeCanvas.selectedIds.length === 1 &&
                (() => {
                    const selectedElement = activeCanvas.elements.find(el => el.id === activeCanvas.selectedIds[0]);
                    if (!selectedElement) return null;

                    return (
                        <div className="properties-section">
                            <h3>Element Style</h3>

                            <div className="property-row">
                                <ColorPicker
                                    label="Stroke Color"
                                    color={selectedElement.style.strokeColor}
                                    onChange={color =>
                                        onUpdateElement(selectedElement.id, {
                                            style: {
                                                ...selectedElement.style,
                                                strokeColor: color,
                                            },
                                        })
                                    }
                                />
                            </div>

                            {selectedElement.type !== 'line' && selectedElement.type !== 'path' && (
                                <div className="property-row">
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                            <ColorPicker
                                                label="Fill Color"
                                                color={
                                                    selectedElement.style.fillColor === 'transparent'
                                                        ? '#ffffff'
                                                        : selectedElement.style.fillColor
                                                }
                                                onChange={color =>
                                                    onUpdateElement(selectedElement.id, {
                                                        style: {
                                                            ...selectedElement.style,
                                                            fillColor: color,
                                                        },
                                                    })
                                                }
                                            />
                                        </div>
                                        <button
                                            className="tool-btn"
                                            onClick={() =>
                                                onUpdateElement(selectedElement.id, {
                                                    style: {
                                                        ...selectedElement.style,
                                                        fillColor:
                                                            selectedElement.style.fillColor === 'transparent'
                                                                ? '#ffffff'
                                                                : 'transparent',
                                                    },
                                                })
                                            }
                                            title={
                                                selectedElement.style.fillColor === 'transparent'
                                                    ? 'Enable Fill'
                                                    : 'Disable Fill'
                                            }
                                            style={{
                                                padding: '8px 12px',
                                                fontSize: '14px',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            {selectedElement.style.fillColor === 'transparent' ? '⬜' : '🎨'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="property-row">
                                <span className="property-label">Style</span>
                                <select
                                    value={selectedElement.style.strokeStyle || 'solid'}
                                    onChange={e =>
                                        onUpdateElement(selectedElement.id, {
                                            style: {
                                                ...selectedElement.style,
                                                strokeStyle: e.target.value as StrokeStyle,
                                            },
                                        })
                                    }
                                    style={{
                                        flex: 1,
                                        padding: '4px',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#f9fafb',
                                        fontSize: '13px',
                                    }}
                                >
                                    <option value="solid">Solid ────</option>
                                    <option value="dashed">Dashed ╌╌╌╌</option>
                                    <option value="dotted">Dotted ••••••</option>
                                </select>
                            </div>

                            <div className="property-row">
                                <span className="property-label">Width</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={selectedElement.style.strokeWidth}
                                    onChange={e =>
                                        onUpdateElement(selectedElement.id, {
                                            style: {
                                                ...selectedElement.style,
                                                strokeWidth: parseInt(e.target.value),
                                            },
                                        })
                                    }
                                    style={{ flex: 1 }}
                                />
                                <span style={{ minWidth: '30px', textAlign: 'right' }}>
                                    {selectedElement.style.strokeWidth}px
                                </span>
                            </div>

                            <div className="property-row">
                                <span className="property-label">Opacity</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={selectedElement.style.opacity * 100}
                                    onChange={e =>
                                        onUpdateElement(selectedElement.id, {
                                            style: {
                                                ...selectedElement.style,
                                                opacity: parseInt(e.target.value) / 100,
                                            },
                                        })
                                    }
                                    style={{ flex: 1 }}
                                />
                                <span style={{ minWidth: '40px', textAlign: 'right' }}>
                                    {Math.round(selectedElement.style.opacity * 100)}%
                                </span>
                            </div>

                            {/* Layer Management */}
                            <div className="properties-section" style={{ marginTop: '1rem' }}>
                                <h4
                                    style={{
                                        fontSize: '0.875rem',
                                        marginBottom: '0.5rem',
                                        color: '#6b7280',
                                    }}
                                >
                                    Layer Order
                                </h4>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="tool-btn"
                                        onClick={() => onBringToFront([selectedElement.id])}
                                        title="Bring to Front (Ctrl+])"
                                        style={{ flex: 1, padding: '0.5rem' }}
                                    >
                                        ⬆️ Front
                                    </button>
                                    <button
                                        className="tool-btn"
                                        onClick={() => onSendToBack([selectedElement.id])}
                                        title="Send to Back (Ctrl+[)"
                                        style={{ flex: 1, padding: '0.5rem' }}
                                    >
                                        ⬇️ Back
                                    </button>
                                </div>
                            </div>

                            {selectedElement.type === 'text' && (
                                <>
                                    <div className="property-row">
                                        <span className="property-label">Text Color</span>
                                        <input
                                            type="color"
                                            value={selectedElement.style.strokeColor}
                                            onChange={e =>
                                                onUpdateElement(selectedElement.id, {
                                                    style: {
                                                        ...selectedElement.style,
                                                        strokeColor: e.target.value,
                                                    },
                                                })
                                            }
                                            style={{ width: '60px', height: '30px', cursor: 'pointer' }}
                                        />
                                    </div>

                                    <div className="property-row">
                                        <span className="property-label">Font Size</span>
                                        <input
                                            type="range"
                                            min="8"
                                            max="72"
                                            value={selectedElement.fontSize || 16}
                                            onChange={e => {
                                                const newFontSize = parseInt(e.target.value);
                                                const element = selectedElement as { text?: string };
                                                const textLength = element.text ? element.text.length : 10;

                                                onUpdateElement(selectedElement.id, {
                                                    fontSize: newFontSize,
                                                    width: textLength * (newFontSize * 0.6),
                                                    height: newFontSize * 1.5,
                                                });
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ minWidth: '30px', textAlign: 'right' }}>
                                            {selectedElement.fontSize || 16}px
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })()}
        </div>
    );
};
