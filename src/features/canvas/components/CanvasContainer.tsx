import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useShallow } from 'zustand/react/shallow';
// import { exportToPNG } from '../../../utils/export'; // Used in toolbar
import { exportToPNG, copyToClipboard } from '../../../utils/export';

import { ContextMenu } from './ContextMenu';
import { ZoomControls } from './ZoomControls';
import { CanvasStatusBar } from './CanvasStatusBar';
import { CanvasToolbar } from './CanvasToolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { TextEditor } from './TextEditor';
import AlignmentToolbar from './AlignmentToolbar';
import { CanvasRenderer } from './CanvasRenderer';
import { LayerPanel } from './LayerPanel';
import { Minimap } from './Minimap';
import { CanvasElement, ToolType, TextElement } from '../types/canvas';
import './CanvasContainer.css';

const CanvasContainer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Global component state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [editingText, setEditingText] = useState<{ elementId: string; text: string } | null>(null);
    const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);

    // Store subscriptions
    const activeCanvasId = useCanvasStore(useShallow(state => state.activeCanvasId));
    const canvases = useCanvasStore(useShallow(state => state.canvases));
    const cursorMode = useCanvasStore(state => state.cursorMode);
    // Don't use useShallow for activeCanvas to ensure re-renders on element updates
    const activeCanvas = useCanvasStore(state => state.canvases.find(c => c.canvasId === state.activeCanvasId) || null);

    // Actions
    const {
        createCanvas,
        deleteCanvas,
        setActiveCanvas,
        addElement,
        updateElement,
        deleteElements,
        setSelectedIds,
        clearSelection,
        setActiveTool,
        setZoom,
        setPan,

        toggleGrid,
        toggleSnapToGrid,
        undo,
        redo,
        loadFromStorage,
        bringToFront,
        sendToBack,
        groupElements,
        ungroupElements,
    } = useCanvasStore(
        useShallow(state => ({
            createCanvas: state.createCanvas,
            deleteCanvas: state.deleteCanvas,
            setActiveCanvas: state.setActiveCanvas,
            addElement: state.addElement,
            updateElement: state.updateElement,
            deleteElements: state.deleteElements,
            setSelectedIds: state.setSelectedIds,
            clearSelection: state.clearSelection,
            setActiveTool: state.setActiveTool,
            setZoom: state.setZoom,
            setPan: state.setPan,
            resetView: state.resetView,
            toggleGrid: state.toggleGrid,
            toggleSnapToGrid: state.toggleSnapToGrid,
            undo: state.undo,
            redo: state.redo,
            loadFromStorage: state.loadFromStorage,
            bringToFront: state.bringToFront,
            sendToBack: state.sendToBack,
            groupElements: state.groupElements,
            ungroupElements: state.ungroupElements,
        }))
    );

    // Initialize Tools

    // Initialize canvas
    useEffect(() => {
        loadFromStorage().then(() => {
            const store = useCanvasStore.getState();
            if (store.canvases.length === 0) {
                createCanvas();
            } else if (!store.activeCanvasId && store.canvases.length > 0) {
                useCanvasStore.setState({ activeCanvasId: store.canvases[0].canvasId });
            }
        });
    }, [loadFromStorage, createCanvas]);

    // Keyboard event handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeCanvas) return;

            // Ignore if typing in an input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Copy (Ctrl+C)
            if (e.ctrlKey && e.key === 'c' && activeCanvas.selectedIds.length > 0) {
                e.preventDefault();
                const selectedElements = activeCanvas.elements.filter(el => activeCanvas.selectedIds.includes(el.id));
                localStorage.setItem('canvas-clipboard', JSON.stringify(selectedElements));
                return;
            }

            // Paste (Ctrl+V)
            if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                const clipboardData = localStorage.getItem('canvas-clipboard');
                if (clipboardData) {
                    try {
                        const elements = JSON.parse(clipboardData) as CanvasElement[];
                        elements.forEach((el, index) => {
                            const newElement = {
                                ...el,
                                id: `element-${Date.now()}-${index}`,
                                x: el.x + 20, // Offset to avoid overlap
                                y: el.y + 20,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            };
                            addElement(newElement);
                        });
                    } catch (error) {
                        console.error('Failed to paste:', error);
                    }
                }
                return;
            }

            // Select All (Ctrl+A)
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                const allIds = activeCanvas.elements.map(el => el.id);
                setSelectedIds(allIds);
                return;
            }

            // Undo (Ctrl+Z)
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo (Ctrl+Y or Ctrl+Shift+Z)
            if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                redo();
                return;
            }

            // Tool shortcuts (only if no modifier keys)
            if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'v':
                        e.preventDefault();
                        setActiveTool('select');
                        return;
                    case 'r':
                        e.preventDefault();
                        setActiveTool('rectangle');
                        return;
                    case 'e':
                        e.preventDefault();
                        setActiveTool('ellipse');
                        return;
                    case 'l':
                        e.preventDefault();
                        setActiveTool('line');
                        return;
                    case 'p':
                        e.preventDefault();
                        setActiveTool('pen');
                        return;
                    case 't':
                        e.preventDefault();
                        setActiveTool('text');
                        return;
                    case 'n':
                        e.preventDefault();
                        setActiveTool('note');
                        return;
                }
            }

            // Delete selected elements
            if ((e.key === 'Delete' || e.key === 'Backspace') && activeCanvas.selectedIds.length > 0) {
                e.preventDefault();
                deleteElements(activeCanvas.selectedIds);
            }

            // Layering shortcuts
            if (e.ctrlKey && e.key === ']' && activeCanvas.selectedIds.length > 0) {
                e.preventDefault();
                bringToFront(activeCanvas.selectedIds);
            }
            if (e.ctrlKey && e.key === '[' && activeCanvas.selectedIds.length > 0) {
                e.preventDefault();
                sendToBack(activeCanvas.selectedIds);
            }

            // Group/Ungroup shortcuts
            if (e.ctrlKey && e.key === 'g' && !e.shiftKey && activeCanvas.selectedIds.length >= 2) {
                e.preventDefault();
                groupElements(activeCanvas.selectedIds);
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'G' && activeCanvas.groups.length > 0) {
                e.preventDefault();
                // Find if any selected elements belong to a group
                const selectedGroup = activeCanvas.groups.find(group =>
                    group.elementIds.some(id => activeCanvas.selectedIds.includes(id))
                );
                if (selectedGroup) {
                    ungroupElements(selectedGroup.id);
                }
            }

            // Escape to clear selection
            if (e.key === 'Escape') {
                clearSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        activeCanvas,
        deleteElements,
        clearSelection,
        undo,
        redo,
        addElement,
        setActiveTool,
        bringToFront,
        sendToBack,
        setSelectedIds,
    ]);

    // Local UI state
    const [showProperties, setShowProperties] = useState(true);

    const handleToolChange = (tool: ToolType) => {
        setActiveTool(tool);
    };

    const handleZoomIn = () => {
        if (activeCanvas) {
            setZoom(activeCanvas.zoom * 1.2);
        }
    };

    const handleZoomOut = () => {
        if (activeCanvas) {
            setZoom(activeCanvas.zoom * 0.8);
        }
    };

    const handleFitToScreen = () => {
        if (!activeCanvas || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const elements = activeCanvas.elements;

        if (elements.length === 0) {
            setZoom(1);
            setPan(0, 0);
            return;
        }

        // Calculate bounding box of all elements
        const minX = Math.min(...elements.map(el => el.x));
        const minY = Math.min(...elements.map(el => el.y));
        const maxX = Math.max(...elements.map(el => el.x + el.width));
        const maxY = Math.max(...elements.map(el => el.y + el.height));

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Calculate zoom to fit (with 10% padding)
        const zoomX = (canvas.width * 0.9) / contentWidth;
        const zoomY = (canvas.height * 0.9) / contentHeight;
        const newZoom = Math.min(zoomX, zoomY, 1);

        // Center content
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const newPanX = canvas.width / 2 - centerX * newZoom;
        const newPanY = canvas.height / 2 - centerY * newZoom;

        setZoom(newZoom);
        setPan(newPanX, newPanY);
    };

    const handleZoomToSelection = () => {
        if (!activeCanvas || !canvasRef.current || activeCanvas.selectedIds.length === 0) return;

        const canvas = canvasRef.current;
        const selectedElements = activeCanvas.elements.filter(el => activeCanvas.selectedIds.includes(el.id));

        if (selectedElements.length === 0) return;

        // Calculate bounding box of selected elements
        const minX = Math.min(...selectedElements.map(el => el.x));
        const minY = Math.min(...selectedElements.map(el => el.y));
        const maxX = Math.max(...selectedElements.map(el => el.x + el.width));
        const maxY = Math.max(...selectedElements.map(el => el.y + el.height));

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        // Calculate zoom to fit selection (with 20% padding)
        const zoomX = (canvas.width * 0.8) / contentWidth;
        const zoomY = (canvas.height * 0.8) / contentHeight;
        const newZoom = Math.min(zoomX, zoomY, 2); // Max 2x zoom

        // Center selection
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const newPanX = canvas.width / 2 - centerX * newZoom;
        const newPanY = canvas.height / 2 - centerY * newZoom;

        setZoom(newZoom);
        setPan(newPanX, newPanY);
    };

    if (!activeCanvas) {
        return (
            <div className="canvas-view">
                <div className="canvas-empty-state">
                    <h2>No Canvas Available</h2>
                    <p>Create a canvas to start drawing</p>
                    <button
                        className="tool-btn"
                        onClick={() => createCanvas()}
                        style={{ marginTop: '16px', padding: '12px 24px' }}
                    >
                        ➕ Create Canvas
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="canvas-view">
            {/* Toolbar */}
            <CanvasToolbar
                canvases={canvases}
                activeCanvasId={activeCanvasId}
                activeTool={activeCanvas.activeTool}
                gridEnabled={activeCanvas.gridEnabled}
                snapToGrid={activeCanvas.snapToGrid}
                showProperties={showProperties}
                onCanvasChange={setActiveCanvas}
                onCreateCanvas={createCanvas}
                onDeleteCanvas={() => {
                    if (activeCanvasId) {
                        const shouldDelete = window.confirm('Delete this canvas? This action cannot be undone.');
                        if (shouldDelete) {
                            deleteCanvas(activeCanvasId);
                        }
                    }
                }}
                onToolChange={handleToolChange}
                onToggleGrid={toggleGrid}
                onToggleSnap={toggleSnapToGrid}
                onExport={() => {
                    if (canvasRef.current && activeCanvas) {
                        exportToPNG(canvasRef.current, `canvas-${activeCanvas.canvasId}.png`);
                    }
                }}
                onToggleProperties={() => setShowProperties(!showProperties)}
                onUndo={undo}
                onRedo={redo}
                canUndo={!!(activeCanvasId && useCanvasStore.getState().history[activeCanvasId]?.past.length > 0)}
                canRedo={!!(activeCanvasId && useCanvasStore.getState().history[activeCanvasId]?.future.length > 0)}
                isLayersOpen={isLayerPanelOpen}
                onToggleLayers={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
            />

            {/* Canvas Container */}
            <div ref={containerRef} className="canvas-container">
                <div className={`canvas-wrapper tool-${activeCanvas.activeTool}${cursorMode ? ` ${cursorMode}` : ''}`}>
                    <CanvasRenderer
                        ref={canvasRef}
                        onEditElement={(id, text) => setEditingText({ elementId: id, text })}
                        onContextMenu={e => setContextMenu({ x: e.clientX, y: e.clientY })}
                    />
                </div>

                {/* Properties Panel */}
                {showProperties && (
                    <PropertiesPanel
                        activeCanvas={activeCanvas}
                        onUpdateElement={updateElement}
                        onBringToFront={bringToFront}
                        onSendToBack={sendToBack}
                    />
                )}
            </div>

            {/* Status Bar */}
            <CanvasStatusBar
                activeTool={activeCanvas.activeTool}
                elementCount={activeCanvas.elements.length}
                selectedCount={activeCanvas.selectedIds.length}
            />

            {/* Context Menu */}
            {contextMenu && activeCanvas && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    hasSelection={activeCanvas.selectedIds.length > 0}
                    hasClipboard={!!localStorage.getItem('canvas-clipboard')}
                    onCut={() => {
                        const selectedElements = activeCanvas.elements.filter(el =>
                            activeCanvas.selectedIds.includes(el.id)
                        );
                        localStorage.setItem('canvas-clipboard', JSON.stringify(selectedElements));
                        deleteElements(activeCanvas.selectedIds);
                    }}
                    onCopy={() => {
                        const selectedElements = activeCanvas.elements.filter(el =>
                            activeCanvas.selectedIds.includes(el.id)
                        );
                        localStorage.setItem('canvas-clipboard', JSON.stringify(selectedElements));
                    }}
                    onPaste={() => {
                        const clipboardData = localStorage.getItem('canvas-clipboard');
                        if (clipboardData) {
                            try {
                                const elements = JSON.parse(clipboardData) as CanvasElement[];
                                elements.forEach((el, index) => {
                                    const newElement = {
                                        ...el,
                                        id: `element - ${Date.now()} -${index} `,
                                        x: el.x + 20,
                                        y: el.y + 20,
                                        createdAt: Date.now(),
                                        updatedAt: Date.now(),
                                    };
                                    addElement(newElement);
                                });
                            } catch (error) {
                                console.error('Failed to paste:', error);
                            }
                        }
                    }}
                    onDuplicate={() => {
                        const selectedElements = activeCanvas.elements.filter(el =>
                            activeCanvas.selectedIds.includes(el.id)
                        );
                        selectedElements.forEach((el, index) => {
                            const newElement = {
                                ...el,
                                id: `element - ${Date.now()} -${index} `,
                                x: el.x + 20,
                                y: el.y + 20,
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            };
                            addElement(newElement);
                        });
                    }}
                    onDelete={() => deleteElements(activeCanvas.selectedIds)}
                    onBringToFront={() => bringToFront(activeCanvas.selectedIds)}
                    onSendToBack={() => sendToBack(activeCanvas.selectedIds)}
                    canGroup={activeCanvas.selectedIds.length >= 2}
                    canUngroup={activeCanvas.groups.some(group =>
                        group.elementIds.some(id => activeCanvas.selectedIds.includes(id))
                    )}
                    onGroup={() => groupElements(activeCanvas.selectedIds)}
                    onUngroup={() => {
                        const selectedGroup = activeCanvas.groups.find(group =>
                            group.elementIds.some(id => activeCanvas.selectedIds.includes(id))
                        );
                        if (selectedGroup) {
                            ungroupElements(selectedGroup.id);
                        }
                    }}
                    onExportSelection={() => {
                        if (canvasRef.current && activeCanvas) {
                            const selectedElements = activeCanvas.elements.filter(el =>
                                activeCanvas.selectedIds.includes(el.id)
                            );
                            exportToPNG(canvasRef.current, `selection-${activeCanvas.canvasId}.png`, selectedElements);
                        }
                    }}
                    onCopyImage={() => {
                        if (canvasRef.current && activeCanvas) {
                            const selectedElements = activeCanvas.elements.filter(el =>
                                activeCanvas.selectedIds.includes(el.id)
                            );
                            copyToClipboard(canvasRef.current, selectedElements);
                        }
                    }}
                />
            )}

            {/* Text Editing Overlay */}
            {editingText &&
                activeCanvas &&
                (() => {
                    const element = activeCanvas.elements.find(el => el.id === editingText.elementId);
                    if (!element || (element.type !== 'text' && element.type !== 'note')) return null;

                    return (
                        <TextEditor
                            element={element as TextElement}
                            canvasRect={canvasRef.current?.getBoundingClientRect() || null}
                            zoom={activeCanvas.zoom}
                            panX={activeCanvas.panX}
                            panY={activeCanvas.panY}
                            text={editingText.text}
                            onChange={text => setEditingText({ ...editingText, text })}
                            onFinish={text => {
                                updateElement(editingText.elementId, { text } as Partial<TextElement>);
                                setEditingText(null);
                            }}
                            onCancel={() => setEditingText(null)}
                        />
                    );
                })()}

            {/* Zoom Controls */}
            <div
                style={{
                    position: 'absolute',
                    bottom: 20,
                    right: 20,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-end',
                }}
            >
                <Minimap />
                <ZoomControls
                    zoom={activeCanvas.zoom}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onFitToScreen={handleFitToScreen}
                    onZoomToSelection={handleZoomToSelection}
                    hasSelection={activeCanvas.selectedIds.length > 0}
                />
            </div>

            <AlignmentToolbar />

            <LayerPanel isOpen={isLayerPanelOpen} onClose={() => setIsLayerPanelOpen(false)} />
        </div>
    );
};

export default CanvasContainer;
