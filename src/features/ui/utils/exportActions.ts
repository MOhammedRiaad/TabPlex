// The copy/download actions behind the export menus (task card, Boards header, command palette)
import { Board, Folder, Tab, Task } from '../../../types';
import { downloadText, slugify } from '../../../utils/download';
import { boardToCsv, boardToMarkdown, taskToMarkdown } from '../../../utils/exportFormats';
import { useUIStore } from '../store/uiStore';
import { useBoardStore } from '../../../store/boardStore';
import { boardContents } from '../../../utils/boards';

const toast = (message: string, type: 'success' | 'error') => useUIStore.getState().actions.showToast(message, type);
const date = () => new Date().toISOString().slice(0, 10);

async function copy(text: string, what: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast(`Copied “${what}” as Markdown`, 'success');
    } catch (error) {
        toast(`Couldn't copy: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
}

export const copyTaskMarkdown = (task: Task, tabs: Tab[]) => copy(taskToMarkdown(task, tabs), task.title);

export const downloadTaskMarkdown = (task: Task, tabs: Tab[]) =>
    downloadText(`${slugify(task.title)}.md`, taskToMarkdown(task, tabs), 'text/markdown;charset=utf-8');

export const copyBoardMarkdown = (board: Board, folders: Folder[], tabs: Tab[]) =>
    copy(boardToMarkdown(board, folders, tabs), board.name);

export const downloadBoardMarkdown = (board: Board, folders: Folder[], tabs: Tab[]) =>
    downloadText(
        `${slugify(board.name)}-${date()}.md`,
        boardToMarkdown(board, folders, tabs),
        'text/markdown;charset=utf-8'
    );

export const downloadBoardCsv = (board: Board, folders: Folder[], tabs: Tab[]) =>
    downloadText(`${slugify(board.name)}-${date()}.csv`, boardToCsv(board, folders, tabs), 'text/csv;charset=utf-8');

/** Export the board the Boards view shows (the first board), as the command palette does */
export function exportCurrentBoard(format: 'md' | 'csv') {
    const { boards, folders, tabs, sessions } = useBoardStore.getState();
    const board = boards[0];
    if (!board) {
        toast('No board to export yet', 'error');
        return;
    }
    const contents = boardContents(board, folders, tabs, sessions);
    if (format === 'csv') downloadBoardCsv(board, contents.folders, contents.tabs);
    else downloadBoardMarkdown(board, contents.folders, contents.tabs);
}
