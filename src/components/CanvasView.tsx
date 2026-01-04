import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { CanvasElement, ToolType, Point, RectangleElement, EllipseElement, LineElement, PathElement } from '../types/canvas';
import { snapPointToGrid } from '../utils/geometry';
import { findElementAtPoint } from '../utils/hitTest';
import { exportToPNG } from '../utils/export';
import './CanvasView.css';

const CanvasView: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [showProperties, setShowProperties] = useState(true);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<Point | null>(null);
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const [previewElement, setPreviewElement] = useState<CanvasElement | null>(null);

    // Drag state for moving elements
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Point | null>(null);

    // Selection box state for drag-to-select
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ start: Point; end: Point } | null>(null);

    const {
        canvases,
        activeCanvasId,
        settings,
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
        resetView,
        toggleGrid,
        toggleSnapToGrid,
        undo,
        redo,
        loadFromStorage,
        bringToFront,
        sendToBack,
    } = useCanvasStore();

    const activeCanvas = canvases.find((c) => c.canvasId === activeCanvasId);

    // Initialize canvas
    useEffect(() => {
        loadFromStorage().then(() => {
            // Create default canvas if none exists
            const store = useCanvasStore.getState();
            if (store.canvases.length === 0) {
                createCanvas();
            } else if (!store.activeCanvasId && store.canvases.length > 0) {
                // If there are canvases but none is active, activate the first one
                useCanvasStore.setState({ activeCanvasId: store.canvases[0].canvasId });
            }
        });
    }, [loadFromStorage, createCanvas]);

    // Handle canvas resize with ResizeObserver for reliable size detection
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setCanvasSize({
                    width: rect.width,
                    height: rect.height,
                });
            }
        };

        // Use ResizeObserver for reliable container size detection
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(container);

        // Initial size update
        updateSize();

        return () => resizeObserver.disconnect();
    }, []);

    // Render canvas
    useEffect(() => {
        if (!canvasRef.current || !activeCanvas) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!canvas || !ctx || !activeCanvas) return;

        // Set canvas dimensions to match container exactly
        // This ensures getBoundingClientRect matches the canvas coordinate system
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;
        canvas.style.width = `${canvasSize.width}px`;
        canvas.style.height = `${canvasSize.height}px`;

        // Clear canvas with white background (always white for visibility)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        // Apply transformations for pan and zoom
        ctx.save();
        ctx.translate(activeCanvas.panX, activeCanvas.panY);
        ctx.scale(activeCanvas.zoom, activeCanvas.zoom);

        // Draw grid
        if (activeCanvas.gridEnabled) {
            drawGrid(ctx, activeCanvas.gridSize, canvas.width, canvas.height, activeCanvas);
        }

        // Draw elements
        activeCanvas.elements.forEach((element) => {
            drawElement(ctx, element, activeCanvas.selectedIds.includes(element.id));
        });

        // Draw preview element
        if (previewElement) {
            ctx.globalAlpha = 0.7;
            drawElement(ctx, previewElement, false);
            ctx.globalAlpha = 1;
        }

        // Draw selection box
        if (selectionBox) {
            ctx.strokeStyle = '#3b82f6';
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            ctx.lineWidth = 1 / activeCanvas.zoom;
            ctx.setLineDash([5 / activeCanvas.zoom, 5 / activeCanvas.zoom]);

            const x = Math.min(selectionBox.start.x, selectionBox.end.x);
            const y = Math.min(selectionBox.start.y, selectionBox.end.y);
            const width = Math.abs(selectionBox.end.x - selectionBox.start.x);
            const height = Math.abs(selectionBox.end.y - selectionBox.start.y);

            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);
        }

        ctx.restore();
    }, [activeCanvas, canvasSize, previewElement, selectionBox]);

    const drawGrid = (
        ctx: CanvasRenderingContext2D,
        gridSize: number,
        width: number,
        height: number,
        canvas: typeof activeCanvas
    ) => {
        if (!canvas) return;

        // Get the computed color from CSS variable for dark mode support
        const computedStyle = getComputedStyle(document.documentElement);
        const gridColor = computedStyle.getPropertyValue('--color-border').trim() || '#e5e7eb';

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5; // Thin lines for subtle grid
        ctx.globalAlpha = 0.3; // More transparent for less visual noise

        // Calculate grid bounds to cover entire visible canvas area
        const startX = Math.floor((-canvas.panX / canvas.zoom) / gridSize) * gridSize;
        const startY = Math.floor((-canvas.panY / canvas.zoom) / gridSize) * gridSize;
        const endX = startX + (width / canvas.zoom) + gridSize * 2;
        const endY = startY + (height / canvas.zoom) + gridSize * 2;

        // Draw vertical lines
        for (let x = startX; x < endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY - gridSize);
            ctx.lineTo(x, endY + gridSize);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = startY; y < endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX - gridSize, y);
            ctx.lineTo(endX + gridSize, y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    };
    const drawElement = (
        ctx: CanvasRenderingContext2D,
        element: CanvasElement,
        isSelected: boolean
    ) => {
        ctx.save();

        // Apply element transformations
        if (element.rotation !== 0) {
            const centerX = element.x + element.width / 2;
            const centerY = element.y + element.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(element.rotation);
            ctx.translate(-centerX, -centerY);
        }

        // Set styles
        ctx.strokeStyle = element.style.strokeColor;
        ctx.fillStyle = element.style.fillColor;
        ctx.lineWidth = element.style.strokeWidth;
        ctx.globalAlpha = element.style.opacity;

        // Set line style
        if (element.style.strokeStyle === 'dashed') {
            ctx.setLineDash([5, 5]);
        } else if (element.style.strokeStyle === 'dotted') {
            ctx.setLineDash([2, 2]);
        }

        // Draw based on type
        switch (element.type) {
            case 'rectangle':
                drawRectangle(ctx, element);
                break;
            case 'ellipse':
                drawEllipse(ctx, element);
                break;
            case 'line':
                drawLine(ctx, element);
                break;
            case 'path':
                drawPath(ctx, element);
                break;
            case 'text':
                drawText(ctx, element);
                break;
        }

        // Draw selection outline
        if (isSelected) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);

            // Draw resize handles
            const handleSize = 8;
            const handles = [
                { x: element.x - handleSize / 2, y: element.y - handleSize / 2, cursor: 'nw' }, // top-left
                { x: element.x + element.width / 2 - handleSize / 2, y: element.y - handleSize / 2, cursor: 'n' }, // top-center
                { x: element.x + element.width - handleSize / 2, y: element.y - handleSize / 2, cursor: 'ne' }, // top-right
                { x: element.x + element.width - handleSize / 2, y: element.y + element.height / 2 - handleSize / 2, cursor: 'e' }, // middle-right
                { x: element.x + element.width - handleSize / 2, y: element.y + element.height - handleSize / 2, cursor: 'se' }, // bottom-right
                { x: element.x + element.width / 2 - handleSize / 2, y: element.y + element.height - handleSize / 2, cursor: 's' }, // bottom-center
                { x: element.x - handleSize / 2, y: element.y + element.height - handleSize / 2, cursor: 'sw' }, // bottom-left
                { x: element.x - handleSize / 2, y: element.y + element.height / 2 - handleSize / 2, cursor: 'w' }, // middle-left
            ];

            ctx.fillStyle = '#3b82f6';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);

            handles.forEach(handle => {
                ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
                ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
            });
        }

        ctx.restore();
    };

    const drawRectangle = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
        if ('cornerRadius' in element && element.cornerRadius) {
            // Rounded rectangle
            const radius = element.cornerRadius;
            ctx.beginPath();
            ctx.moveTo(element.x + radius, element.y);
            ctx.lineTo(element.x + element.width - radius, element.y);
            ctx.quadraticCurveTo(
                element.x + element.width,
                element.y,
                element.x + element.width,
                element.y + radius
            );
            ctx.lineTo(element.x + element.width, element.y + element.height - radius);
            ctx.quadraticCurveTo(
                element.x + element.width,
                element.y + element.height,
                element.x + element.width - radius,
                element.y + element.height
            );
            ctx.lineTo(element.x + radius, element.y + element.height);
            ctx.quadraticCurveTo(
                element.x,
                element.y + element.height,
                element.x,
                element.y + element.height - radius
            );
            ctx.lineTo(element.x, element.y + radius);
            ctx.quadraticCurveTo(element.x, element.y, element.x + radius, element.y);
            ctx.closePath();
        } else {
            ctx.beginPath();
            ctx.rect(element.x, element.y, element.width, element.height);
        }

        if (element.style.fillColor !== 'transparent') {
            ctx.fill();
        }
        ctx.stroke();
    };

    const drawEllipse = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        const radiusX = element.width / 2;
        const radiusY = element.height / 2;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

        if (element.style.fillColor !== 'transparent') {
            ctx.fill();
        }
        ctx.stroke();
    };

    const drawLine = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
        if (!('points' in element) || element.points.length < 2) return;

        const points = element.points;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();

        // Draw arrows
        if ('startArrow' in element && element.startArrow) {
            drawArrowHead(ctx, points[1], points[0], element.style.strokeWidth);
        }
        if ('endArrow' in element && element.endArrow) {
            drawArrowHead(
                ctx,
                points[points.length - 2],
                points[points.length - 1],
                element.style.strokeWidth
            );
        }
    };

    const drawArrowHead = (
        ctx: CanvasRenderingContext2D,
        from: { x: number; y: number },
        to: { x: number; y: number },
        strokeWidth: number
    ) => {
        const headLength = 10 + strokeWidth * 2;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);

        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
            to.x - headLength * Math.cos(angle - Math.PI / 6),
            to.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
            to.x - headLength * Math.cos(angle + Math.PI / 6),
            to.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
    };

    const drawPath = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
        if (!('points' in element) || element.points.length < 2) return;

        const points = element.points;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        // Draw smooth curve through points
        for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }

        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
    };

    const drawText = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
        if (!('text' in element)) return;

        ctx.font = `${element.style.fontWeight || 'normal'} ${element.style.fontSize || 16}px ${element.style.fontFamily || 'sans-serif'
            }`;
        ctx.fillStyle = element.style.strokeColor;
        ctx.textAlign = ('textAlign' in element ? element.textAlign : 'left') as CanvasTextAlign;
        ctx.textBaseline = 'top';

        const lines = element.text.split('\n');
        const lineHeight = (element.style.fontSize || 16) * 1.2;

        lines.forEach((line, index) => {
            ctx.fillText(line, element.x, element.y + index * lineHeight);
        });
    };

    // Helper function to convert screen coordinates to canvas coordinates
    const screenToCanvas = (screenX: number, screenY: number): Point => {
        if (!canvasRef.current || !activeCanvas) return { x: 0, y: 0 };

        const rect = canvasRef.current.getBoundingClientRect();

        // Convert screen coordinates to canvas coordinates:
        // 1. First get position relative to canvas element
        // 2. Then undo the pan and zoom transformations
        const relX = screenX - rect.left;
        const relY = screenY - rect.top;

        // Reverse the transformation: ctx.translate(panX, panY); ctx.scale(zoom, zoom);
        // So: canvasPos = (screenPos - panOffset) / zoom
        const canvasX = (relX - activeCanvas.panX) / activeCanvas.zoom;
        const canvasY = (relY - activeCanvas.panY) / activeCanvas.zoom;

        if (activeCanvas.snapToGrid) {
            return snapPointToGrid({ x: canvasX, y: canvasY }, activeCanvas.gridSize);
        }

        return { x: canvasX, y: canvasY };
    };

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeCanvas) return;

        const point = screenToCanvas(e.clientX, e.clientY);

        // Check for panning
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - activeCanvas.panX, y: e.clientY - activeCanvas.panY });
            return;
        }

        // Handle selection tool
        if (activeCanvas.activeTool === 'select') {
            const clickedElement = findElementAtPoint(activeCanvas.elements, point);
            if (clickedElement) {
                // If clicking on an already selected element, prepare to drag
                if (activeCanvas.selectedIds.includes(clickedElement.id)) {
                    setIsDragging(true);
                    setDragStart(point);
                } else {
                    // Otherwise, select the clicked element (Ctrl for multi-select)
                    if (e.ctrlKey) {
                        setSelectedIds([...activeCanvas.selectedIds, clickedElement.id]);
                    } else {
                        setSelectedIds([clickedElement.id]);
                    }
                }
            } else {
                // Clicked on empty space - start selection box
                clearSelection();
                setIsSelecting(true);
                setSelectionBox({ start: point, end: point });
            }
            return;
        }

        // Handle text tool - prompt for text input
        if (activeCanvas.activeTool === 'text') {
            const text = prompt('Enter text:');
            if (text && text.trim()) {
                const textElement: CanvasElement = {
                    id: `element-${Date.now()}`,
                    type: 'text',
                    x: point.x,
                    y: point.y,
                    width: text.length * 12, // Approximate width
                    height: 24,
                    rotation: 0,
                    text: text.trim(),
                    fontSize: 16,
                    fontFamily: 'Arial',
                    textAlign: 'left',
                    style: {
                        strokeColor: settings.defaultStrokeColor,
                        fillColor: settings.defaultStrokeColor,
                        strokeWidth: 1,
                        strokeStyle: 'solid',
                        opacity: 1,
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                addElement(textElement);
            }
            return;
        }

        // Start drawing based on active tool
        setIsDrawing(true);
        setDrawStart(point);

        if (activeCanvas.activeTool === 'pen') {
            setCurrentPoints([point]);
        }
    };

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
                const selectedElements = activeCanvas.elements.filter(el =>
                    activeCanvas.selectedIds.includes(el.id)
                );
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

            // Escape to clear selection
            if (e.key === 'Escape') {
                clearSelection();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeCanvas, deleteElements, clearSelection, undo, redo, addElement, setActiveTool]);

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!activeCanvas) return;

        const point = screenToCanvas(e.clientX, e.clientY);

        // Handle panning
        if (isPanning) {
            const newPanX = e.clientX - panStart.x;
            const newPanY = e.clientY - panStart.y;
            setPan(newPanX, newPanY);
            return;
        }

        // Handle dragging selected elements
        if (isDragging && dragStart && activeCanvas.selectedIds.length > 0) {
            const dx = point.x - dragStart.x;
            const dy = point.y - dragStart.y;

            // Update positions of all selected elements
            activeCanvas.selectedIds.forEach(id => {
                const element = activeCanvas.elements.find(el => el.id === id);
                if (element) {
                    updateElement(id, {
                        x: element.x + dx,
                        y: element.y + dy,
                    });
                }
            });

            setDragStart(point);
            return;
        }

        // Handle selection box dragging
        if (isSelecting && selectionBox) {
            setSelectionBox({ start: selectionBox.start, end: point });
            return;
        }

        // Handle drawing
        if (isDrawing && drawStart) {
            const tool = activeCanvas.activeTool;

            if (tool === 'rectangle') {
                const width = point.x - drawStart.x;
                const height = point.y - drawStart.y;
                const preview: RectangleElement = {
                    id: 'preview',
                    type: 'rectangle',
                    x: width < 0 ? point.x : drawStart.x,
                    y: height < 0 ? point.y : drawStart.y,
                    width: Math.abs(width),
                    height: Math.abs(height),
                    rotation: 0,
                    style: {
                        strokeColor: settings.defaultStrokeColor,
                        fillColor: settings.defaultFillColor,
                        strokeWidth: settings.defaultStrokeWidth,
                        strokeStyle: 'solid',
                        opacity: 1,
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                setPreviewElement(preview);
            } else if (tool === 'ellipse') {
                const width = point.x - drawStart.x;
                const height = point.y - drawStart.y;
                const preview: EllipseElement = {
                    id: 'preview',
                    type: 'ellipse',
                    x: width < 0 ? point.x : drawStart.x,
                    y: height < 0 ? point.y : drawStart.y,
                    width: Math.abs(width),
                    height: Math.abs(height),
                    rotation: 0,
                    style: {
                        strokeColor: settings.defaultStrokeColor,
                        fillColor: settings.defaultFillColor,
                        strokeWidth: settings.defaultStrokeWidth,
                        strokeStyle: 'solid',
                        opacity: 1,
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                setPreviewElement(preview);
            } else if (tool === 'line') {
                const preview: LineElement = {
                    id: 'preview',
                    type: 'line',
                    x: Math.min(drawStart.x, point.x),
                    y: Math.min(drawStart.y, point.y),
                    width: Math.abs(point.x - drawStart.x),
                    height: Math.abs(point.y - drawStart.y),
                    rotation: 0,
                    points: [drawStart, point],
                    startArrow: false,
                    endArrow: true,
                    style: {
                        strokeColor: settings.defaultStrokeColor,
                        fillColor: 'transparent',
                        strokeWidth: settings.defaultStrokeWidth,
                        strokeStyle: 'solid',
                        opacity: 1,
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                setPreviewElement(preview);
            } else if (tool === 'pen') {
                setCurrentPoints(prev => [...prev, point]);
                const preview: PathElement = {
                    id: 'preview',
                    type: 'path',
                    x: Math.min(...currentPoints.map(p => p.x), point.x),
                    y: Math.min(...currentPoints.map(p => p.y), point.y),
                    width: Math.max(...currentPoints.map(p => p.x), point.x) - Math.min(...currentPoints.map(p => p.x), point.x),
                    height: Math.max(...currentPoints.map(p => p.y), point.y) - Math.min(...currentPoints.map(p => p.y), point.y),
                    rotation: 0,
                    points: [...currentPoints, point],
                    style: {
                        strokeColor: settings.defaultStrokeColor,
                        fillColor: 'transparent',
                        strokeWidth: settings.defaultStrokeWidth,
                        strokeStyle: 'solid',
                        opacity: 1,
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                setPreviewElement(preview);
            }
        }
    };

    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (isDragging) {
            setIsDragging(false);
            setDragStart(null);
            return;
        }

        // Complete selection box - select all elements within the box
        if (isSelecting && selectionBox && activeCanvas) {
            const minX = Math.min(selectionBox.start.x, selectionBox.end.x);
            const maxX = Math.max(selectionBox.start.x, selectionBox.end.x);
            const minY = Math.min(selectionBox.start.y, selectionBox.end.y);
            const maxY = Math.max(selectionBox.start.y, selectionBox.end.y);

            // Find all elements that intersect with the selection box
            const selectedIds = activeCanvas.elements
                .filter((el) => {
                    const elRight = el.x + el.width;
                    const elBottom = el.y + el.height;
                    return !(el.x > maxX || elRight < minX || el.y > maxY || elBottom < minY);
                })
                .map((el) => el.id);

            if (selectedIds.length > 0) {
                setSelectedIds(selectedIds);
            }

            setIsSelecting(false);
            setSelectionBox(null);
            return;
        }


        if (isDrawing && previewElement && previewElement.id !== 'preview') {
            // This shouldn't happen, but just in case
            setIsDrawing(false);
            setDrawStart(null);
            setCurrentPoints([]);
            setPreviewElement(null);
            return;
        }

        if (isDrawing && previewElement) {
            // Create the actual element from preview
            const newElement = { ...previewElement, id: `element-${Date.now()}` };
            addElement(newElement);

            // Reset drawing state
            setIsDrawing(false);
            setDrawStart(null);
            setCurrentPoints([]);
            setPreviewElement(null);
        }
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        if (e.ctrlKey && activeCanvas) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(activeCanvas.zoom * delta);
        }
    };

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

    const handleResetView = () => {
        resetView();
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
            <div className="canvas-toolbar">
                <div className="canvas-toolbar-left">
                    <button
                        className="tool-btn"
                        onClick={() => createCanvas()}
                        title="New Canvas"
                        style={{ marginRight: '8px' }}
                    >
                        ➕ New
                    </button>

                    {/* Canvas Selector */}
                    {canvases.length > 1 && (
                        <select
                            className="canvas-selector"
                            value={activeCanvasId || ''}
                            onChange={(e) => setActiveCanvas(e.target.value)}
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
                            onClick={() => {
                                if (activeCanvasId && confirm('Delete this canvas?')) {
                                    deleteCanvas(activeCanvasId);
                                }
                            }}
                            title="Delete Canvas"
                            style={{ marginLeft: '4px', color: '#ef4444' }}
                        >
                            🗑️
                        </button>
                    )}

                    <div className="tool-group">
                        <button
                            className={`tool-btn ${activeCanvas.activeTool === 'select' ? 'active' : ''}`}
                            onClick={() => handleToolChange('select')}
                            title="Select (V)"
                        >
                            ↖️
                        </button>
                        <button
                            className={`tool-btn ${activeCanvas.activeTool === 'rectangle' ? 'active' : ''}`}
                            onClick={() => handleToolChange('rectangle')}
                            title="Rectangle (R)"
                        >
                            ▭
                        </button>
                        <button
                            className={`tool-btn ${activeCanvas.activeTool === 'ellipse' ? 'active' : ''}`}
                            onClick={() => handleToolChange('ellipse')}
                            title="Ellipse (E)"
                        >
                            ⬭
                        </button>
                        <button
                            className={`tool-btn ${activeCanvas.activeTool === 'line' ? 'active' : ''}`}
                            onClick={() => handleToolChange('line')}
                            title="Line (L)"
                        >
                            ⟋
                        </button>
                        <button
                            className={`tool-btn ${activeCanvas.activeTool === 'pen' ? 'active' : ''}`}
                            onClick={() => handleToolChange('pen')}
                            title="Pen (P)"
                        >
                            ✏️
                        </button>
                        <button
                            className={`tool-btn ${activeCanvas.activeTool === 'text' ? 'active' : ''}`}
                            onClick={() => handleToolChange('text')}
                            title="Text (T)"
                        >
                            T
                        </button>
                    </div>
                </div>

                <div className="canvas-toolbar-center">
                    <div className="tool-group">
                        <button className="tool-btn" onClick={toggleGrid} title="Toggle Grid">
                            {activeCanvas.gridEnabled ? '🔲' : '⬜'}
                        </button>
                        <button className="tool-btn" onClick={toggleSnapToGrid} title="Snap to Grid">
                            {activeCanvas.snapToGrid ? '🧲' : '⚪'}
                        </button>
                    </div>
                </div>

                <div className="canvas-toolbar-right">
                    <button
                        className="tool-btn"
                        onClick={() => {
                            if (canvasRef.current && activeCanvas) {
                                exportToPNG(canvasRef.current, `canvas-${activeCanvas.canvasId}.png`);
                            }
                        }}
                        title="Export to PNG"
                    >
                        📥
                    </button>
                    <button
                        className="tool-btn"
                        onClick={() => setShowProperties(!showProperties)}
                        title="Toggle Properties"
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                className={`canvas-container ${isPanning ? 'panning' : ''}`}
            >
                <div className={`canvas-wrapper tool-${activeCanvas.activeTool}`}>
                    <canvas
                        ref={canvasRef}
                        className="main-canvas"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    />
                </div>

                {/* Properties Panel */}
                {showProperties && (
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

                        {activeCanvas.selectedIds.length === 1 && (() => {
                            const selectedElement = activeCanvas.elements.find(
                                el => el.id === activeCanvas.selectedIds[0]
                            );
                            if (!selectedElement) return null;

                            return (
                                <div className="properties-section">
                                    <h3>Element Style</h3>

                                    <div className="property-row">
                                        <span className="property-label">Stroke</span>
                                        <input
                                            type="color"
                                            value={selectedElement.style.strokeColor}
                                            onChange={(e) => updateElement(selectedElement.id, {
                                                style: { ...selectedElement.style, strokeColor: e.target.value }
                                            })}
                                            style={{ width: '60px', height: '30px', cursor: 'pointer' }}
                                        />
                                    </div>

                                    {selectedElement.type !== 'line' && selectedElement.type !== 'path' && (
                                        <div className="property-row">
                                            <span className="property-label">Fill</span>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <input
                                                    type="color"
                                                    value={selectedElement.style.fillColor === 'transparent' ? '#ffffff' : selectedElement.style.fillColor}
                                                    onChange={(e) => updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, fillColor: e.target.value }
                                                    })}
                                                    style={{ width: '60px', height: '30px', cursor: 'pointer' }}
                                                    disabled={selectedElement.style.fillColor === 'transparent'}
                                                />
                                                <button
                                                    className="tool-btn"
                                                    onClick={() => updateElement(selectedElement.id, {
                                                        style: {
                                                            ...selectedElement.style,
                                                            fillColor: selectedElement.style.fillColor === 'transparent' ? '#ffffff' : 'transparent'
                                                        }
                                                    })}
                                                    title={selectedElement.style.fillColor === 'transparent' ? 'Enable Fill' : 'Disable Fill'}
                                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                                >
                                                    {selectedElement.style.fillColor === 'transparent' ? '⬜' : '🎨'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="property-row">
                                        <span className="property-label">Width</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            value={selectedElement.style.strokeWidth}
                                            onChange={(e) => updateElement(selectedElement.id, {
                                                style: { ...selectedElement.style, strokeWidth: parseInt(e.target.value) }
                                            })}
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
                                            onChange={(e) => updateElement(selectedElement.id, {
                                                style: { ...selectedElement.style, opacity: parseInt(e.target.value) / 100 }
                                            })}
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ minWidth: '40px', textAlign: 'right' }}>
                                            {Math.round(selectedElement.style.opacity * 100)}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="canvas-status-bar">
                <div className="status-item">
                    <span>Tool: {activeCanvas.activeTool}</span>
                </div>
                <div className="status-item">
                    <div className="zoom-controls">
                        <button className="zoom-btn" onClick={handleZoomOut}>
                            −
                        </button>
                        <span className="zoom-value">{Math.round(activeCanvas.zoom * 100)}%</span>
                        <button className="zoom-btn" onClick={handleZoomIn}>
                            +
                        </button>
                        <button className="zoom-btn" onClick={handleResetView} title="Reset View">
                            ⟲
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CanvasView;
