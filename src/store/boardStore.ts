import { create } from 'zustand';
import { BoardState } from './slices/board/types';
import { createBoardSlice } from './slices/board/boardSlice';
import { createTabSlice } from './slices/board/tabSlice';
import { createTaskSlice } from './slices/board/taskSlice';
import { createNoteSlice } from './slices/board/noteSlice';
import { createSessionSlice } from './slices/board/sessionSlice';
import { createHistorySlice } from './slices/board/historySlice';

export const useBoardStore = create<BoardState>()((...a) => ({
    ...createBoardSlice(...a),
    ...createTabSlice(...a),
    ...createTaskSlice(...a),
    ...createNoteSlice(...a),
    ...createSessionSlice(...a),
    ...createHistorySlice(...a),
}));
