import { downloadText } from './download';
import { Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';
import { CanvasSettings, CanvasState } from '../features/canvas/types/canvas';
import { AI_SETTINGS_KEY } from '../features/ai/constants';
import { BOARD_STYLE_KEY } from '../features/boards/switcher/boardStyle';
import { DISPLAY_NAME_KEY } from '../features/settings/utils/displayName';
import { THEME_STORAGE_KEY } from '../hooks/useTheme';
import { TimerSettings, useTimerStore } from '../store/timerStore';
import { PARK_RESUME_SETTINGS_KEY, reconcileTasksWithBackground } from './taskContext';
import { SUGGEST_DISMISSED_KEY } from './taskSuggest';
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

/**
 * 2.0.0 adds the custom canvases and the settings. 1.0.0 files (boards … history only) still import, and then
 * leave the current canvases and settings alone.
 */
export const EXPORT_VERSION = '2.0.0';
const LEGACY_VERSION = '1.0.0';

/** chrome.storage.local keys of the custom canvas (canvasSlice saveToStorage / loadFromStorage) */
const CANVASES_KEY = 'canvases';
const CANVAS_SETTINGS_KEY = 'canvasSettings';

/** Settings kept in chrome.storage.local. Add a key here when a feature adds a setting there. */
export const EXTENSION_SETTING_KEYS: string[] = [
    PARK_RESUME_SETTINGS_KEY,
    AI_SETTINGS_KEY,
    BOARD_STYLE_KEY,
    SUGGEST_DISMISSED_KEY,
];

/**
 * Settings kept in localStorage. Add a key here when a feature adds a setting there. Not 'tabboard_tldraw_room':
 * it names this device's tldraw database, which the export doesn't contain.
 */
export const PAGE_SETTING_KEYS: string[] = [
    THEME_STORAGE_KEY,
    DISPLAY_NAME_KEY,
    'tabboard_canvas_mode',
    'tabboard_tldraw_mode',
    'tabboard_tldraw_persistence',
];

export interface ExportSettings {
    /** chrome.storage.local values by key (EXTENSION_SETTING_KEYS); a missing key means "not set" */
    extension: Record<string, unknown>;
    /** localStorage values by key (PAGE_SETTING_KEYS) */
    page: Record<string, string>;
    /** Pomodoro durations and options (not the running timer) */
    timer: TimerSettings;
}

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
        canvases?: CanvasState[];
        canvasSettings?: CanvasSettings | null;
    };
    settings?: ExportSettings;
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

function readPageSettings(): Record<string, string> {
    const page: Record<string, string> = {};
    for (const key of PAGE_SETTING_KEYS) {
        const value = localStorage.getItem(key);
        if (value !== null) page[key] = value;
    }
    return page;
}

/** Restores the custom canvases and every listed setting: present in the file → set, missing → removed */
async function restoreCanvasesAndSettings(parsed: ExportData): Promise<void> {
    const { canvases = [], canvasSettings = null } = parsed.data ?? {};
    const extension = parsed.settings?.extension ?? {};
    const page = parsed.settings?.page ?? {};

    const toSet: Record<string, unknown> = { [CANVASES_KEY]: canvases };
    const toRemove: string[] = [];
    if (canvasSettings) toSet[CANVAS_SETTINGS_KEY] = canvasSettings;
    else toRemove.push(CANVAS_SETTINGS_KEY);
    for (const key of EXTENSION_SETTING_KEYS) {
        if (extension[key] !== undefined) toSet[key] = extension[key];
        else toRemove.push(key);
    }
    await chrome.storage.local.set(toSet);
    await chrome.storage.local.remove(toRemove);

    for (const key of PAGE_SETTING_KEYS) {
        if (typeof page[key] === 'string') localStorage.setItem(key, page[key]);
        else localStorage.removeItem(key);
    }

    if (parsed.settings?.timer) useTimerStore.getState().updateSettings(parsed.settings.timer);
}

export const exportData = async (): Promise<string> => {
    try {
        const [boards, folders, tabs, storedTasks, notes, sessions, history, stored] = await Promise.all([
            getAllBoards(),
            getAllFolders(),
            getAllTabs(),
            getAllTasks(),
            getAllNotes(),
            getAllSessions(),
            getBackgroundHistory(),
            chrome.storage.local.get([CANVASES_KEY, CANVAS_SETTINGS_KEY, ...EXTENSION_SETTING_KEYS]),
        ]);
        // The background owns task contexts and can hold a newer copy than IndexedDB
        const tasks = await reconcileTasksWithBackground(storedTasks);

        const extension: Record<string, unknown> = {};
        for (const key of EXTENSION_SETTING_KEYS) {
            if (stored[key] !== undefined) extension[key] = stored[key];
        }

        const exportData: ExportData = {
            version: EXPORT_VERSION,
            timestamp: new Date().toISOString(),
            data: {
                boards,
                folders,
                tabs,
                tasks,
                notes,
                sessions,
                history,
                canvases: (stored[CANVASES_KEY] as CanvasState[] | undefined) ?? [],
                canvasSettings: (stored[CANVAS_SETTINGS_KEY] as CanvasSettings | undefined) ?? null,
            },
            settings: {
                extension,
                page: readPageSettings(),
                timer: useTimerStore.getState().settings,
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

        if (parsedData.version !== EXPORT_VERSION && parsedData.version !== LEGACY_VERSION) {
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

        // 1.0.0 files have no canvases or settings: keep the current ones then
        if (parsedData.version !== LEGACY_VERSION) await restoreCanvasesAndSettings(parsedData);

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
