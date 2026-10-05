// Which folders and saved tabs a board shows. Shared by the Boards view and the board exports.
import { Board, Folder, Session, Tab } from '../types';

/** The board's folders, and the tabs it shows: its folders' tabs, plus unfiled tabs that aren't part of a session */
export function boardContents(
    board: Pick<Board, 'id'>,
    folders: Folder[],
    tabs: Tab[],
    sessions: Pick<Session, 'tabIds'>[]
): { folders: Folder[]; tabs: Tab[] } {
    const boardFolders = folders.filter(folder => folder.boardId === board.id);
    const boardFolderIds = new Set(boardFolders.map(folder => folder.id));
    const sessionTabIds = new Set(sessions.flatMap(session => session.tabIds));

    const boardTabs = tabs.filter(tab => {
        // Tabs in this board's folders
        if (tab.folderId && boardFolderIds.has(tab.folderId)) return true;
        // Tabs saved as part of a session belong to the Sessions view
        if (sessionTabIds.has(tab.id)) return false;
        // Unfiled tabs belong to the board but not to a folder
        if (!tab.folderId) return true;
        // Orphaned tabs (their folder no longer exists anywhere) show as unfiled
        return !folders.some(folder => folder.id === tab.folderId);
    });

    return { folders: boardFolders, tabs: boardTabs };
}
