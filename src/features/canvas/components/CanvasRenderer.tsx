import React, { useEffect, useState, useMemo, forwardRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useShallow } from 'zustand/react/shallow';
import { CanvasElement, Point, CanvasState } from '../types/canvas';
import { snapPointToGrid, getBoundingBox } from '../utils/geometry';
import { SelectTool } from '../tools/SelectTool';
import { RectangleTool } from '../tools/RectangleTool';
import { EllipseTool } from '../tools/EllipseTool';
import { LineTool } from '../tools/LineTool';
import { PenTool } from '../tools/PenTool';
import { TextTool } from '../tools/TextTool';
import { NoteTool } from '../tools/NoteTool';
import { renderElement } from '../utils/render';

interface CanvasRendererProps {
    onEditElement?: (elementId: string, text: string) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const CanvasRenderer = forwardRef<HTMLCanvasElement, CanvasRendererProps>(
    ({ onEditElement, onContextMenu }, ref) => {
        const { activeCanvasId, canvases, setPan, setZoom, previewElement } = useCanvasStore(
            useShallow(state => ({
                activeCanvasId: state.activeCanvasId,
                canvases: state.canvases,
                setPan: state.setPan,
                setZoom: state.setZoom,
                previewElement: state.previewElement,
            }))
        );

        const activeCanvas = useMemo(
            () => canvases.find(c => c.canvasId === activeCanvasId) || null,
            [canvases, activeCanvasId]
        );

        // Local state used for interactions
        const [isPanning, setIsPanning] = useState(false);
        const [panStart, setPanStart] = useState<Point | null>(null);

        // Canvas Size state
        const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

        // Initialize Tools
        const tools = useMemo(
            () => ({
                select: new SelectTool(),
                rectangle: new RectangleTool(),
                ellipse: new EllipseTool(),
                line: new LineTool(),
                pen: new PenTool(),
                text: new TextTool(),
                note: new NoteTool(),
            }),
            []
        );

        // Helper function to convert screen coordinates to canvas coordinates
        const screenToCanvas = (screenX: number, screenY: number): Point => {
            const canvasElement = (ref as React.RefObject<HTMLCanvasElement>)?.current;
            if (!canvasElement || !activeCanvas) return { x: 0, y: 0 };

            const rect = canvasElement.getBoundingClientRect();
            const relX = screenX - rect.left;
            const relY = screenY - rect.top;
            const canvasX = (relX - activeCanvas.panX) / activeCanvas.zoom;
            const canvasY = (relY - activeCanvas.panY) / activeCanvas.zoom;

            if (activeCanvas.snapToGrid) {
                return snapPointToGrid({ x: canvasX, y: canvasY }, activeCanvas.gridSize);
            }
            return { x: canvasX, y: canvasY };
        };

        const drawGrid = (
            ctx: CanvasRenderingContext2D,
            gridSize: number,
            width: number,
            height: number,
            canvas: CanvasState
        ) => {
            if (!canvas) return;

            const computedStyle = getComputedStyle(document.documentElement);
            const gridColor = computedStyle.getPropertyValue('--color-border').trim() || '#e5e7eb';

            ctx.strokeStyle = gridColor;
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.3;

            const startX = Math.floor(-canvas.panX / canvas.zoom / gridSize) * gridSize;
            const startY = Math.floor(-canvas.panY / canvas.zoom / gridSize) * gridSize;
            const endX = startX + width / canvas.zoom + gridSize * 2;
            const endY = startY + height / canvas.zoom + gridSize * 2;

            for (let x = startX; x < endX; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, startY - gridSize);
                ctx.lineTo(x, endY + gridSize);
                ctx.stroke();
            }

            for (let y = startY; y < endY; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(startX - gridSize, y);
                ctx.lineTo(endX + gridSize, y);
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
        };

        const drawElement = (ctx: CanvasRenderingContext2D, element: CanvasElement, isSelected: boolean) => {
            renderElement(ctx, element);

            if (isSelected) {
                ctx.save();

                // Use getBoundingBox for accurate bounds (especially for lines/paths)
                const bbox = getBoundingBox(element);

                if (element.rotation) {
                    const cx = bbox.x + bbox.width / 2;
                    const cy = bbox.y + bbox.height / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate((element.rotation * Math.PI) / 180);
                    ctx.translate(-cx, -cy);
                }

                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(bbox.x - 2, bbox.y - 2, bbox.width + 4, bbox.height + 4);

                const handleSize = 8;
                const handles = [
                    { x: bbox.x - handleSize / 2, y: bbox.y - handleSize / 2, cursor: 'nw' },
                    { x: bbox.x + bbox.width / 2 - handleSize / 2, y: bbox.y - handleSize / 2, cursor: 'n' },
                    { x: bbox.x + bbox.width - handleSize / 2, y: bbox.y - handleSize / 2, cursor: 'ne' },
                    {
                        x: bbox.x + bbox.width - handleSize / 2,
                        y: bbox.y + bbox.height / 2 - handleSize / 2,
                        cursor: 'e',
                    },
                    { x: bbox.x + bbox.width - handleSize / 2, y: bbox.y + bbox.height - handleSize / 2, cursor: 'se' },
                    {
                        x: bbox.x + bbox.width / 2 - handleSize / 2,
                        y: bbox.y + bbox.height - handleSize / 2,
                        cursor: 's',
                    },
                    { x: bbox.x - handleSize / 2, y: bbox.y + bbox.height - handleSize / 2, cursor: 'sw' },
                    { x: bbox.x - handleSize / 2, y: bbox.y + bbox.height / 2 - handleSize / 2, cursor: 'w' },
                ];

                // Rotation Handle
                const rotateHandleY = bbox.y - 20;
                const rotateHandleX = bbox.x + bbox.width / 2;

                // Draw line to rotation handle
                ctx.beginPath();
                ctx.moveTo(rotateHandleX, bbox.y);
                ctx.lineTo(rotateHandleX, rotateHandleY);
                ctx.stroke();

                // Draw rotation handle circle
                ctx.beginPath();
                ctx.arc(rotateHandleX, rotateHandleY, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);

                handles.forEach(handle => {
                    ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
                    ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
                });

                ctx.restore();
            }
        };

        // Render loop
        useEffect(() => {
            const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
            if (!canvas || !activeCanvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = canvasSize.width;
            canvas.height = canvasSize.height;
            canvas.style.width = `${canvasSize.width}px`;
            canvas.style.height = `${canvasSize.height}px`;

            const render = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                if (activeCanvas.gridEnabled) {
                    drawGrid(ctx, activeCanvas.gridSize, canvas.width, canvas.height, activeCanvas);
                }

                ctx.translate(activeCanvas.panX, activeCanvas.panY);
                ctx.scale(activeCanvas.zoom, activeCanvas.zoom);

                // Render existing elements
                activeCanvas.elements.forEach(element => {
                    const isSelected = activeCanvas.selectedIds.includes(element.id);
                    drawElement(ctx, element, isSelected);
                });

                // Render preview element (e.g. while drawing)
                if (previewElement) {
                    drawElement(ctx, previewElement, false);
                }

                ctx.restore();
            };

            render();
        }, [activeCanvas, activeCanvasId, canvases, canvasSize, previewElement]);

        // Resize Observer
        useEffect(() => {
            const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
            const container = canvas?.parentElement;
            if (!container) return;

            const updateSize = () => {
                if (container.clientWidth > 0 && container.clientHeight > 0) {
                    setCanvasSize({
                        width: container.clientWidth,
                        height: container.clientHeight,
                    });
                }
            };

            const resizeObserver = new ResizeObserver(updateSize);
            resizeObserver.observe(container);
            updateSize();

            return () => resizeObserver.disconnect();
        }, []);

        // Interactions
        const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!activeCanvas) return;

            if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                setIsPanning(true);
                setPanStart({ x: e.clientX - activeCanvas.panX, y: e.clientY - activeCanvas.panY });
                return;
            }

            const point = screenToCanvas(e.clientX, e.clientY);
            const tool = tools[activeCanvas.activeTool];
            if (tool) {
                tool.onMouseDown(point, {
                    canvasId: activeCanvas.canvasId,
                    store: useCanvasStore.getState(),
                    modifiers: {
                        shiftKey: e.shiftKey,
                        ctrlKey: e.ctrlKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    },
                });
            }
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!activeCanvas) return;

            if (isPanning && panStart) {
                setPan(e.clientX - panStart.x, e.clientY - panStart.y);
                return;
            }

            const point = screenToCanvas(e.clientX, e.clientY);
            const tool = tools[activeCanvas.activeTool];
            if (tool) {
                tool.onMouseMove(point, {
                    canvasId: activeCanvas.canvasId,
                    store: useCanvasStore.getState(),
                    modifiers: {
                        shiftKey: e.shiftKey,
                        ctrlKey: e.ctrlKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    },
                });
            }
        };

        const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!activeCanvas) return;

            if (isPanning) {
                setIsPanning(false);
                setPanStart(null);
                return;
            }

            const point = screenToCanvas(e.clientX, e.clientY);
            const tool = tools[activeCanvas.activeTool];
            if (tool) {
                tool.onMouseUp(point, {
                    canvasId: activeCanvas.canvasId,
                    store: useCanvasStore.getState(),
                    modifiers: {
                        shiftKey: e.shiftKey,
                        ctrlKey: e.ctrlKey,
                        altKey: e.altKey,
                        metaKey: e.metaKey,
                    },
                });
            }
        };

        const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
            if (e.ctrlKey && activeCanvas) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                setZoom(activeCanvas.zoom * delta);
            }
        };

        return (
            <canvas
                ref={ref}
                className="main-canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onDoubleClick={e => {
                    if (!activeCanvas) return;
                    const canvasElement = (ref as React.RefObject<HTMLCanvasElement>)?.current;
                    if (!canvasElement) return;

                    const rect = canvasElement.getBoundingClientRect();
                    const canvasX = (e.clientX - rect.left - activeCanvas.panX) / activeCanvas.zoom;
                    const canvasY = (e.clientY - rect.top - activeCanvas.panY) / activeCanvas.zoom;

                    const clickedElement = activeCanvas.elements.find(el => {
                        if (el.type !== 'text' && el.type !== 'note') return false;
                        return (
                            canvasX >= el.x &&
                            canvasX <= el.x + el.width &&
                            canvasY >= el.y &&
                            canvasY <= el.y + el.height
                        );
                    });

                    if (clickedElement && (clickedElement.type === 'text' || clickedElement.type === 'note')) {
                        const text = 'text' in clickedElement ? clickedElement.text : '';
                        if (onEditElement) onEditElement(clickedElement.id, text);
                    }
                }}
                onContextMenu={e => {
                    e.preventDefault();
                    if (onContextMenu) onContextMenu(e);
                }}
            />
        );
    }
);

CanvasRenderer.displayName = 'CanvasRenderer';
