// The board the Boards view shows, and every "add to the board" action uses (docs/specs/BOARD_SWITCHER.md)
import { Board } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';

/** The active board if it still exists, else the first board */
export function pickCurrentBoard(boards: Board[], activeBoardId: string | null): Board | undefined {
    return boards.find(board => board.id === activeBoardId) ?? boards[0];
}

/** Current board outside React (actions, shortcuts, palette) */
export function getCurrentBoard(): Board | undefined {
    return pickCurrentBoard(useBoardStore.getState().boards, useUIStore.getState().activeBoardId);
}

/** Current board in a component; re-renders when the boards or the choice change */
export function useCurrentBoard(): Board | undefined {
    const boards = useBoardStore(state => state.boards);
    const activeBoardId = useUIStore(state => state.activeBoardId);
    return pickCurrentBoard(boards, activeBoardId);
}
