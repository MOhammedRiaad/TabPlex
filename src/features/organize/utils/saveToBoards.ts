import { BoardState } from '../../../store/slices/board/types';
import { generateFolderId, generateTabId } from '../../../utils/idGenerator';
import { CreatedGroup, FOLDER_HEX_FOR_GROUP_COLOR } from '../../../utils/organizeTabs';
import { OrganizableTab } from '../../ai/types';

/** The board BoardView creates when there is none */
export const DEFAULT_BOARD = { id: 'default_board', name: 'My Board', color: '#3b82f6' };

/**
 * Save the groups just created to Boards: one folder per group, one saved tab per browser tab, added to the board
 * the Boards view shows (TabPlex shows a single board). The store actions persist and sync; the background ADD_TAB
 * only stores the record, it opens no tab.
 */
export function saveGroupsToBoards(
    created: CreatedGroup[],
    tabsById: Record<number, OrganizableTab>,
    store: Pick<BoardState, 'boards' | 'folders' | 'addBoard' | 'addFolder' | 'addTab'>,
    now = new Date()
): { boardId: string; folderCount: number; tabCount: number } {
    let boardId = store.boards[0]?.id;
    if (!boardId) {
        store.addBoard(DEFAULT_BOARD);
        boardId = DEFAULT_BOARD.id;
    }
    const firstOrder = store.folders.filter(f => f.boardId === boardId).length;

    let tabCount = 0;
    created.forEach((group, i) => {
        const folderId = generateFolderId();
        store.addFolder({
            id: folderId,
            name: group.title,
            boardId: boardId as string,
            color: FOLDER_HEX_FOR_GROUP_COLOR[group.color],
            order: firstOrder + i,
        });
        for (const chromeTabId of group.tabIds) {
            const tab = tabsById[chromeTabId];
            if (!tab) continue;
            store.addTab({
                id: generateTabId(),
                title: tab.title,
                url: tab.url,
                favicon: tab.favicon,
                folderId,
                tabId: chromeTabId,
                lastAccessed: now.toISOString(),
                status: 'open',
            });
            tabCount++;
        }
    });

    return { boardId, folderCount: created.length, tabCount };
}
