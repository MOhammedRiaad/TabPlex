import { Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';

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
        // Get all data from the store
        const { boards, folders, tabs, tasks, notes, sessions, history } = await chrome.runtime.sendMessage({
            type: 'EXPORT_ALL_DATA',
        });

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

        // Send data to background for import
        await chrome.runtime.sendMessage({
            type: 'IMPORT_ALL_DATA',
            payload: parsedData.data,
        });
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
        link.download = `tabboard-export-${new Date().toISOString().split('T')[0]}.json`;
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
