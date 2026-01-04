import { create } from 'zustand';
import { CanvasElement, CanvasState, ToolType, CanvasSettings } from '../types/canvas';

interface CanvasStoreState {
    canvases: CanvasState[];
    activeCanvasId: string | null;
    settings: CanvasSettings;
    history: { [canvasId: string]: { past: CanvasElement[][], future: CanvasElement[][] } };

    // Canvas management
    createCanvas: (boardId?: string) => void;
    deleteCanvas: (canvasId: string) => void;
    setActiveCanvas: (canvasId: string) => void;
    getActiveCanvas: () => CanvasState | null;

    // Element operations
    addElement: (element: CanvasElement) => void;
    updateElement: (id: string, updates: Partial<CanvasElement>) => void;
    deleteElement: (id: string) => void;
    deleteElements: (ids: string[]) => void;
    bringToFront: (ids: string[]) => void;
    sendToBack: (ids: string[]) => void;
    bringForward: (ids: string[]) => void;
    sendBackward: (ids: string[]) => void;

    // Selection
    setSelectedIds: (ids: string[]) => void;
    addToSelection: (id: string) => void;
    removeFromSelection: (id: string) => void;
    clearSelection: () => void;

    // Tool
    setActiveTool: (tool: ToolType) => void;

    // View
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;
    resetView: () => void;

    // Settings
    updateSettings: (settings: Partial<CanvasSettings>) => void;
    toggleGrid: () => void;
    toggleSnapToGrid: () => void;

    // Undo/Redo
    saveHistory: (canvasId: string, elements: CanvasElement[]) => void;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;

    // Storage
    saveToStorage: () => Promise<void>;
    loadFromStorage: () => Promise<void>;
}

const DEFAULT_SETTINGS: CanvasSettings = {
    gridEnabled: true,
    snapToGrid: false,
    gridSize: 10, // Small grid for detailed work
    defaultStrokeColor: '#93c5fd', // Brighter blue for dark mode visibility
    defaultFillColor: 'transparent',
    defaultStrokeWidth: 2,
};

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
    canvases: [],
    activeCanvasId: null,
    settings: DEFAULT_SETTINGS,
    history: {},

    createCanvas: (boardId) => {
        const newCanvas: CanvasState = {
            canvasId: `canvas-${Date.now()}`,
            boardId,
            elements: [],
            selectedIds: [],
            activeTool: 'select',
            gridEnabled: get().settings.gridEnabled,
            snapToGrid: get().settings.snapToGrid,
            gridSize: get().settings.gridSize,
            zoom: 1,
            panX: 0,
            panY: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        set((state) => ({
            canvases: [...state.canvases, newCanvas],
            activeCanvasId: newCanvas.canvasId,
        }));

        get().saveToStorage();
    },

    deleteCanvas: (canvasId) => {
        const { canvases, activeCanvasId } = get();
        const remainingCanvases = canvases.filter((c) => c.canvasId !== canvasId);

        // If deleting the active canvas, switch to another one
        let newActiveId = activeCanvasId;
        if (activeCanvasId === canvasId) {
            newActiveId = remainingCanvases.length > 0 ? remainingCanvases[0].canvasId : null;
        }

        set({
            canvases: remainingCanvases,
            activeCanvasId: newActiveId,
        });

        get().saveToStorage();
    },

    setActiveCanvas: (canvasId) => {
        set({ activeCanvasId: canvasId });
    },

    getActiveCanvas: () => {
        const { canvases, activeCanvasId } = get();
        return canvases.find((c) => c.canvasId === activeCanvasId) || null;
    },

    addElement: (element) => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        // Save current state to history before making changes
        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        elements: [...canvas.elements, element],
                        updatedAt: Date.now(),
                    }
                    : canvas
            ),
        }));

        get().saveToStorage();
    },

    updateElement: (id, updates) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        elements: canvas.elements.map((el) =>
                            el.id === id ? ({ ...el, ...updates, updatedAt: Date.now() } as CanvasElement) : el
                        ),
                        updatedAt: Date.now(),
                    }
                    : canvas
            ),
        }));

        get().saveToStorage();
    },

    deleteElement: (id) => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        elements: canvas.elements.filter((el) => el.id !== id),
                        selectedIds: canvas.selectedIds.filter((sid) => sid !== id),
                        updatedAt: Date.now(),
                    }
                    : canvas
            ),
        }));

        get().saveToStorage();
    },

    deleteElements: (ids) => {
        const { activeCanvasId, canvases } = get();
        if (!activeCanvasId) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (currentCanvas) {
            get().saveHistory(activeCanvasId, [...currentCanvas.elements]);
        }

        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        elements: canvas.elements.filter((el) => !ids.includes(el.id)),
                        selectedIds: [],
                        updatedAt: Date.now(),
                    }
                    : canvas
            ),
        }));

        get().saveToStorage();
    },

    bringToFront: (ids) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        elements: [
                            ...canvas.elements.filter((el) => !ids.includes(el.id)),
                            ...canvas.elements.filter((el) => ids.includes(el.id)),
                        ],
                        updatedAt: Date.now(),
                    }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    sendToBack: (ids) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        elements: [
                            ...canvas.elements.filter((el) => ids.includes(el.id)),
                            ...canvas.elements.filter((el) => !ids.includes(el.id)),
                        ],
                        updatedAt: Date.now(),
                    }
                    : canvas
            ),
        }));
        get().saveToStorage();
    },

    bringForward: (ids) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) => {
                if (canvas.canvasId !== state.activeCanvasId) return canvas;
                const elements = [...canvas.elements];
                ids.forEach(id => {
                    const index = elements.findIndex(el => el.id === id);
                    if (index < elements.length - 1) {
                        [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]];
                    }
                });
                return { ...canvas, elements, updatedAt: Date.now() };
            }),
        }));
        get().saveToStorage();
    },

    sendBackward: (ids) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) => {
                if (canvas.canvasId !== state.activeCanvasId) return canvas;
                const elements = [...canvas.elements];
                [...ids].reverse().forEach(id => {
                    const index = elements.findIndex(el => el.id === id);
                    if (index > 0) {
                        [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]];
                    }
                });
                return { ...canvas, elements, updatedAt: Date.now() };
            }),
        }));
        get().saveToStorage();
    },

    setSelectedIds: (ids) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, selectedIds: ids }
                    : canvas
            ),
        }));
    },

    addToSelection: (id) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        selectedIds: canvas.selectedIds.includes(id)
                            ? canvas.selectedIds
                            : [...canvas.selectedIds, id],
                    }
                    : canvas
            ),
        }));
    },

    removeFromSelection: (id) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                        ...canvas,
                        selectedIds: canvas.selectedIds.filter((selectedId) => selectedId !== id),
                    }
                    : canvas
            ),
        }));
    },

    clearSelection: () => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, selectedIds: [] }
                    : canvas
            ),
        }));
    },

    setActiveTool: (tool) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, activeTool: tool }
                    : canvas
            ),
        }));
    },

    setZoom: (zoom) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, zoom: Math.max(0.1, Math.min(5, zoom)) }
                    : canvas
            ),
        }));
    },

    setPan: (x, y) => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, panX: x, panY: y }
                    : canvas
            ),
        }));
    },

    resetView: () => {
        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, zoom: 1, panX: 0, panY: 0 }
                    : canvas
            ),
        }));
    },

    updateSettings: (newSettings) => {
        set((state) => ({
            settings: { ...state.settings, ...newSettings },
        }));

        get().saveToStorage();
    },

    toggleGrid: () => {
        set((state) => ({
            settings: { ...state.settings, gridEnabled: !state.settings.gridEnabled },
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, gridEnabled: !state.settings.gridEnabled }
                    : canvas
            ),
        }));
    },

    toggleSnapToGrid: () => {
        set((state) => ({
            settings: { ...state.settings, snapToGrid: !state.settings.snapToGrid },
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, snapToGrid: !state.settings.snapToGrid }
                    : canvas
            ),
        }));
    },

    // Helper to save current state to history
    saveHistory: (canvasId: string, elements: CanvasElement[]) => {
        set((state) => {
            const canvasHistory = state.history[canvasId] || { past: [], future: [] };
            const newPast = [...canvasHistory.past, elements].slice(-50); // Keep last 50 states
            return {
                history: {
                    ...state.history,
                    [canvasId]: { past: newPast, future: [] }
                }
            };
        });
    },

    undo: () => {
        const { activeCanvasId, history, canvases } = get();
        if (!activeCanvasId) return;

        const canvasHistory = history[activeCanvasId];
        if (!canvasHistory || canvasHistory.past.length === 0) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (!currentCanvas) return;

        const previousState = canvasHistory.past[canvasHistory.past.length - 1];
        const newPast = canvasHistory.past.slice(0, -1);
        const newFuture = [currentCanvas.elements, ...canvasHistory.future];

        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === activeCanvasId
                    ? { ...canvas, elements: previousState, selectedIds: [], updatedAt: Date.now() }
                    : canvas
            ),
            history: {
                ...state.history,
                [activeCanvasId]: { past: newPast, future: newFuture }
            }
        }));

        get().saveToStorage();
    },

    redo: () => {
        const { activeCanvasId, history, canvases } = get();
        if (!activeCanvasId) return;

        const canvasHistory = history[activeCanvasId];
        if (!canvasHistory || canvasHistory.future.length === 0) return;

        const currentCanvas = canvases.find(c => c.canvasId === activeCanvasId);
        if (!currentCanvas) return;

        const nextState = canvasHistory.future[0];
        const newFuture = canvasHistory.future.slice(1);
        const newPast = [...canvasHistory.past, currentCanvas.elements];

        set((state) => ({
            canvases: state.canvases.map((canvas) =>
                canvas.canvasId === activeCanvasId
                    ? { ...canvas, elements: nextState, selectedIds: [], updatedAt: Date.now() }
                    : canvas
            ),
            history: {
                ...state.history,
                [activeCanvasId]: { past: newPast, future: newFuture }
            }
        }));

        get().saveToStorage();
    },

    canUndo: () => {
        const { activeCanvasId, history } = get();
        if (!activeCanvasId) return false;
        const canvasHistory = history[activeCanvasId];
        return canvasHistory ? canvasHistory.past.length > 0 : false;
    },

    canRedo: () => {
        const { activeCanvasId, history } = get();
        if (!activeCanvasId) return false;
        const canvasHistory = history[activeCanvasId];
        return canvasHistory ? canvasHistory.future.length > 0 : false;
    },

    saveToStorage: async () => {
        const { canvases, settings } = get();
        try {
            await chrome.storage.local.set({
                canvases,
                canvasSettings: settings,
            });
        } catch (error) {
            console.error('Failed to save canvas data:', error);
        }
    },

    loadFromStorage: async () => {
        try {
            const result = await chrome.storage.local.get(['canvases', 'canvasSettings']);

            if (result.canvases && Array.isArray(result.canvases)) {
                set({ canvases: result.canvases as CanvasState[] });
            }

            if (result.canvasSettings && typeof result.canvasSettings === 'object') {
                set({ settings: result.canvasSettings as CanvasSettings });
            }
        } catch (error) {
            console.error('Failed to load canvas data:', error);
        }
    },
}));
