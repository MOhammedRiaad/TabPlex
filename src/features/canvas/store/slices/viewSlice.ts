import { StateCreator } from 'zustand';
import { CanvasStoreState, ViewSlice } from '../types';

export const createViewSlice: StateCreator<CanvasStoreState, [], [], ViewSlice> = set => ({
    previewElement: null,
    selectionBox: null,
    cursorMode: null,

    setZoom: zoom => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? { ...canvas, zoom: Math.max(0.1, Math.min(5, zoom)) }
                    : canvas
            ),
        }));
    },

    setPan: (x, y) => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId ? { ...canvas, panX: x, panY: y } : canvas
            ),
        }));
    },

    resetView: () => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId ? { ...canvas, zoom: 1, panX: 0, panY: 0 } : canvas
            ),
        }));
    },

    setPreviewElement: element => {
        set({ previewElement: element });
    },

    setSelectionBox: box => {
        set({ selectionBox: box });
    },

    setCursorMode: mode => {
        set({ cursorMode: mode });
    },
});
