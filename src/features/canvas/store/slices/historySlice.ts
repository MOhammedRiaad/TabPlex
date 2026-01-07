import { StateCreator } from 'zustand';

import { CanvasStoreState, HistorySlice } from '../types';

export const createHistorySlice: StateCreator<CanvasStoreState, [], [], HistorySlice> = (set, get) => ({
    history: {},

    saveHistory: (canvasId, elements) => {
        set(state => {
            const canvasHistory = state.history[canvasId] || { past: [], future: [] };
            const newPast = [...canvasHistory.past, elements].slice(-50); // Keep last 50 states
            return {
                history: {
                    ...state.history,
                    [canvasId]: { past: newPast, future: [] },
                },
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

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === activeCanvasId
                    ? { ...canvas, elements: previousState, selectedIds: [], updatedAt: Date.now() }
                    : canvas
            ),
            history: {
                ...state.history,
                [activeCanvasId]: { past: newPast, future: newFuture },
            },
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

        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === activeCanvasId
                    ? { ...canvas, elements: nextState, selectedIds: [], updatedAt: Date.now() }
                    : canvas
            ),
            history: {
                ...state.history,
                [activeCanvasId]: { past: newPast, future: newFuture },
            },
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
});
