import { create } from 'zustand';
import { CanvasStoreState } from './types';
import { createCanvasSlice } from './slices/canvasSlice';
import { createElementSlice } from './slices/elementSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createHistorySlice } from './slices/historySlice';
import { createViewSlice } from './slices/viewSlice';

export type { CanvasStoreState } from './types';

export const useCanvasStore = create<CanvasStoreState>((...a) => ({
    ...createCanvasSlice(...a),
    ...createElementSlice(...a),
    ...createSelectionSlice(...a),
    ...createHistorySlice(...a),
    ...createViewSlice(...a),
}));
