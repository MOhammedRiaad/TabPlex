import { StateCreator } from 'zustand';
import { CanvasState, CanvasSettings } from '../../types/canvas';
import { CanvasStoreState, CanvasSlice } from '../types';
import { storageService } from '../../../../services/storage';

export const DEFAULT_SETTINGS: CanvasSettings = {
    gridEnabled: true,
    snapToGrid: false,
    gridSize: 10,
    defaultStrokeColor: '#93c5fd',
    defaultFillColor: 'transparent',
    defaultStrokeWidth: 2,
    defaultTextColor: '#1f2937',
    defaultFontSize: 24,
};

// We define the slice type in ../types.ts to avoid circular deps,
// but we implement it here.
export const createCanvasSlice: StateCreator<CanvasStoreState, [], [], CanvasSlice> = (set, get) => ({
    canvases: [],
    activeCanvasId: null,
    settings: DEFAULT_SETTINGS,

    createCanvas: boardId => {
        const newCanvas: CanvasState = {
            canvasId: `canvas-${Date.now()}`,
            boardId,
            elements: [],
            selectedIds: [],
            groups: [],
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

        set(state => ({
            canvases: [...state.canvases, newCanvas],
            activeCanvasId: newCanvas.canvasId,
        }));

        get().saveToStorage();
    },

    deleteCanvas: canvasId => {
        const { canvases, activeCanvasId } = get();
        const remainingCanvases = canvases.filter(c => c.canvasId !== canvasId);

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

    setActiveCanvas: canvasId => {
        set({ activeCanvasId: canvasId });
    },

    getActiveCanvas: () => {
        const { canvases, activeCanvasId } = get();
        return canvases.find(c => c.canvasId === activeCanvasId) || null;
    },

    setActiveTool: tool => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId ? { ...canvas, activeTool: tool } : canvas
            ),
        }));
    },

    updateSettings: newSettings => {
        set(state => ({
            settings: { ...state.settings, ...newSettings },
        }));

        get().saveToStorage();
    },

    toggleGrid: () => {
        set(state => ({
            settings: { ...state.settings, gridEnabled: !state.settings.gridEnabled },
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, gridEnabled: !state.settings.gridEnabled }
                    : canvas
            ),
        }));
    },

    toggleSnapToGrid: () => {
        set(state => ({
            settings: { ...state.settings, snapToGrid: !state.settings.snapToGrid },
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, snapToGrid: !state.settings.snapToGrid }
                    : canvas
            ),
        }));
    },

    saveToStorage: async () => {
        const { canvases, settings } = get();
        try {
            await storageService.set('canvases', canvases);
            await storageService.set('canvasSettings', settings);
        } catch (error) {
            console.error('Failed to save canvas data:', error);
        }
    },

    loadFromStorage: async () => {
        try {
            const canvases = await storageService.get<CanvasState[]>('canvases');
            const settings = await storageService.get<CanvasSettings>('canvasSettings');

            if (canvases && Array.isArray(canvases)) {
                // Migrate old canvases to include groups array if missing
                const migratedCanvases = canvases.map(canvas => ({
                    ...canvas,
                    groups: canvas.groups || [],
                }));
                set({ canvases: migratedCanvases });
            }

            if (settings && typeof settings === 'object') {
                // Merge with defaults to ensure new properties are available
                set({ settings: { ...DEFAULT_SETTINGS, ...settings } });
            }
        } catch (error) {
            console.error('Failed to load canvas data:', error);
        }
    },
});
