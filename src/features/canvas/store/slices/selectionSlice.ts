import { StateCreator } from 'zustand';
import { CanvasStoreState, SelectionSlice } from '../types';

export const createSelectionSlice: StateCreator<CanvasStoreState, [], [], SelectionSlice> = set => ({
    setSelectedIds: ids => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId ? { ...canvas, selectedIds: ids } : canvas
            ),
        }));
    },

    addToSelection: id => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
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

    removeFromSelection: id => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId
                    ? {
                          ...canvas,
                          selectedIds: canvas.selectedIds.filter(selectedId => selectedId !== id),
                      }
                    : canvas
            ),
        }));
    },

    clearSelection: () => {
        set(state => ({
            canvases: state.canvases.map(canvas =>
                canvas.canvasId === state.activeCanvasId ? { ...canvas, selectedIds: [] } : canvas
            ),
        }));
    },
});
