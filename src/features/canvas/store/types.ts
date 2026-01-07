import { CanvasState, CanvasSettings, ToolType, CanvasElement, Point } from '../types/canvas';

export interface CanvasSlice {
    canvases: CanvasState[];
    activeCanvasId: string | null;
    settings: CanvasSettings;

    createCanvas: (boardId?: string) => void;
    deleteCanvas: (canvasId: string) => void;
    setActiveCanvas: (canvasId: string) => void;
    getActiveCanvas: () => CanvasState | null;

    setActiveTool: (tool: ToolType) => void;

    updateSettings: (settings: Partial<CanvasSettings>) => void;
    toggleGrid: () => void;
    toggleSnapToGrid: () => void;

    saveToStorage: () => Promise<void>;
    loadFromStorage: () => Promise<void>;
}

export interface ElementSlice {
    addElement: (element: CanvasElement) => void;
    updateElement: (id: string, updates: Partial<CanvasElement>) => void;
    deleteElement: (id: string) => void;
    deleteElements: (ids: string[]) => void;
    bringToFront: (ids: string[]) => void;
    sendToBack: (ids: string[]) => void;
    bringForward: (ids: string[]) => void;
    sendBackward: (ids: string[]) => void;
    groupElements: (ids: string[]) => void;
    ungroupElements: (groupId: string) => void;
    alignElements: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
    distributeElements: (type: 'horizontal' | 'vertical') => void;
    reorderElement: (id: string, newIndex: number) => void;
}

export interface SelectionSlice {
    setSelectedIds: (ids: string[]) => void;
    addToSelection: (id: string) => void;
    removeFromSelection: (id: string) => void;
    clearSelection: () => void;
}

export interface HistorySlice {
    history: { [canvasId: string]: { past: CanvasElement[][]; future: CanvasElement[][] } };
    saveHistory: (canvasId: string, elements: CanvasElement[]) => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

export interface ViewSlice {
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;
    resetView: () => void;
    previewElement: CanvasElement | null;
    setPreviewElement: (element: CanvasElement | null) => void;
    selectionBox: { start: Point; end: Point } | null;
    setSelectionBox: (box: { start: Point; end: Point } | null) => void;
    cursorMode: string | null;
    setCursorMode: (mode: string | null) => void;
}

export type CanvasStoreState = CanvasSlice & ElementSlice & SelectionSlice & HistorySlice & ViewSlice;
