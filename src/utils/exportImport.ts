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

export const exportData = async (): Promise<string> => {
    try {
        // Get all data directly from IndexedDB
        const [boards, folders, tabs, tasks, notes, sessions] = await Promise.all([
            getAllBoards(),
            getAllFolders(),
            getAllTabs(),
            getAllTasks(),
            getAllNotes(),
            getAllSessions(),
        ]);

        // History is not currently stored in IndexedDB in the same way, but we can return empty or implement if needed
        // For now, consistent with previous behavior if history was in local storage, but frontend uses IDB.
        // If history is supposed to be exported, we need a getAllHistory in storage.ts.
        // Checking storage.ts, there is no getAllHistory. So we'll pass empty array or skip.
        const history: HistoryItem[] = [];

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

        const { boards, folders, tabs, tasks, notes, sessions } = parsedData.data;

        // Import data into IndexedDB
        await Promise.all([
            ...boards.map(b => addBoard(b)),
            ...folders.map(f => addFolder(f)),
            ...tabs.map(t => addTab(t)),
            ...tasks.map(t => addTask(t)),
            ...notes.map(n => addNote(n)),
            ...sessions.map(s => addSession(s)),
        ]);

        // Notify background/other tabs if needed?
        // Since we are writing to IDB, and useStorageSync reads from IDB on mount, a reload is sufficient.
        // App.tsx handles the reload.
    } catch (error) {
        console.error('Error importing data:', error);
        throw error;
    }
};

export const downloadExportFile = async (): Promise<void> => {
    try {
        const data = await exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = `tabplex-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
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
