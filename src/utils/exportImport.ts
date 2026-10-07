import { downloadText } from './download';
import { Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';
import {
    getAllBoards,
    getAllFolders,
    getAllTabs,
    getAllTasks,
    getAllNotes,
    getAllSessions,
    addBoard,
    addFolder,
    addTab,
    addTask,
    addNote,
    addSession,
    clearAllData,
} from './storage';

export interface ExportData {
    version: string;
    timestamp: string;
    data: {
        boards: Board[];
        folders: Folder[];
        tabs: Tab[];
        tasks: Task[];
        notes: Note[];
        sessions: Session[];
        history: HistoryItem[];
    };
}

/**
 * True in the tab that is importing. The background broadcasts STORAGE_DATA_IMPORTED to every TabPlex tab
 * so they reload; the importing tab ignores it and reloads itself after showing its success toast.
 */
let importInThisTab = false;
export const isImportInThisTab = () => importInThisTab;
export const markImportInThisTab = (value: boolean) => {
    importInThisTab = value;
};

/** History (the History view) lives only in the background's chrome.storage copy, not in IndexedDB */
async function getBackgroundHistory(): Promise<HistoryItem[]> {
    try {
        const response = (await chrome.runtime.sendMessage({ type: 'GET_HISTORY' })) as unknown;
        return Array.isArray(response) ? (response as HistoryItem[]) : [];
    } catch {
        return []; // Background unavailable: export everything else rather than fail
    }
}

export const exportData = async (): Promise<string> => {
    try {
        // Get all data directly from IndexedDB
        const [boards, folders, tabs, tasks, notes, sessions, history] = await Promise.all([
            getAllBoards(),
            getAllFolders(),
            getAllTabs(),
            getAllTasks(),
            getAllNotes(),
            getAllSessions(),
            getBackgroundHistory(),
        ]);

        const exportData: ExportData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            data: {
                boards,
                folders,
                tabs,
                tasks,
                notes,
                sessions,
                history,
            },
        };

        return JSON.stringify(exportData, null, 2);
    } catch (error) {
        console.error('Error exporting data:', error);
        throw error;
    }
};

export const importData = async (jsonData: string): Promise<void> => {
    try {
        const parsedData = JSON.parse(jsonData) as ExportData;

        if (parsedData.version !== '1.0.0') {
            throw new Error(`Unsupported export version: ${parsedData.version}`);
        }

        // Clear existing data in IndexedDB
        await clearAllData();

        // Older or hand-edited exports may omit collections; treat them as empty
        const { boards = [], folders = [], tabs = [], tasks = [], notes = [], sessions = [] } = parsedData.data ?? {};

        // Import data into IndexedDB
        await Promise.all([
            ...boards.map(b => addBoard(b)),
            ...folders.map(f => addFolder(f)),
            ...tabs.map(t => addTab(t)),
            ...tasks.map(t => addTask(t)),
            ...notes.map(n => addNote(n)),
            ...sessions.map(s => addSession(s)),
        ]);

        // Replace the background's copy too. Otherwise, on reload, useStorageSync merges tasks with the
        // background's newer pre-import versions (undoing the restore), and Park & Resume keeps acting on
        // the old data. The background then broadcasts STORAGE_DATA_IMPORTED so other TabPlex tabs reload.
        // Exports made before history was included carry an empty list: keep the current history then.
        const history = parsedData.data?.history?.length ? parsedData.data.history : await getBackgroundHistory();
        markImportInThisTab(true);
        try {
            const response = (await chrome.runtime.sendMessage({
                type: 'IMPORT_ALL_DATA',
                payload: { boards, folders, tabs, tasks, notes, sessions, history },
            })) as { error?: string } | undefined;
            if (response?.error) throw new Error(`The background could not import the data: ${response.error}`);
        } catch (error) {
            markImportInThisTab(false);
            throw error;
        }
    } catch (error) {
        console.error('Error importing data:', error);
        throw error;
    }
};

export const downloadExportFile = async (): Promise<void> => {
    try {
        const data = await exportData();
        downloadText(`tabplex-export-${new Date().toISOString().split('T')[0]}.json`, data, 'application/json');
    } catch (error) {
        console.error('Error downloading export file:', error);
        throw error;
    }
};

export const importFromFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async e => {
            try {
                const content = e.target?.result as string;
                await importData(content);
                resolve();
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
};
