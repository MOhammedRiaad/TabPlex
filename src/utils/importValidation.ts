// Checks and cleans an import file before anything is written. Shared by the UI (utils/exportImport.ts) and the
// background (data-service.ts), so keep it free of DOM and React.
import type { Board, Folder, HistoryItem, Note, Session, Tab, Task } from '../types';
import { TRACK_ALL_TABS_KEY } from './tabTracking';

/** Biggest import file accepted (characters of JSON text) */
export const MAX_IMPORT_CHARS = 20 * 1024 * 1024;

const MAX_ID_CHARS = 200;

/** Date given to an item that has none: the oldest possible, so it is never mistaken for new */
export const EPOCH_ISO = new Date(0).toISOString();

/** The board that holds folders whose own board is missing (same id, name and color as BoardView) */
const DEFAULT_BOARD_ID = 'default_board';

/** Schemes a stored URL may use; everything else (javascript:, data:, vbscript:, blob:…) is blanked */
const SAFE_URL_PROTOCOLS = new Set([
    'http:',
    'https:',
    'file:',
    'ftp:',
    'chrome:',
    'edge:',
    'brave:',
    'about:',
    'chrome-extension:',
]);

export interface ImportCollections {
    boards: Board[];
    folders: Folder[];
    tabs: Tab[];
    tasks: Task[];
    notes: Note[];
    sessions: Session[];
    history: HistoryItem[];
}

export type CollectionName = keyof ImportCollections;

export interface SanitizedImport {
    collections: ImportCollections;
    /** Canvases (the extension's own canvas feature): only objects are kept */
    canvases: unknown[];
    /** Things that were repaired or dropped, for the user */
    warnings: string[];
}

export type ValidationResult = { ok: true; value: SanitizedImport } | { ok: false; errors: string[] };

/** Strings every element of a collection must hold (a wrong type makes the file invalid). `url` is checked apart. */
const REQUIRED_STRINGS: Record<CollectionName, string[]> = {
    boards: ['name'],
    folders: ['name'],
    tabs: [],
    tasks: ['title'],
    notes: ['content'],
    sessions: ['name'],
    history: [],
};

const COLLECTIONS = Object.keys(REQUIRED_STRINGS) as CollectionName[];
const TASK_STATUSES = ['todo', 'doing', 'done'];
const TAB_STATUSES = ['open', 'suspended', 'closed'];

/** Text fields the views call string methods on. Missing ones become ''; a wrong type rejects the file. */
const TEXT_DEFAULT_EMPTY: Partial<Record<CollectionName, string[]>> = {
    tabs: ['title', 'url'],
    history: ['title', 'url'],
};
/** Optional text fields: when present they must be text */
const TEXT_OPTIONAL: Partial<Record<CollectionName, string[]>> = {
    tasks: ['description'],
    notes: ['title'],
    sessions: ['summary'],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isTextList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string');

const isChecklist = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.every(
        item =>
            isRecord(item) &&
            typeof item.id === 'string' &&
            typeof item.text === 'string' &&
            typeof item.completed === 'boolean'
    );

/** The first problem with the list fields of one item, or null. `null` values count as missing. */
function listFieldProblem(name: CollectionName, index: number, item: Record<string, unknown>): string | null {
    const present = (field: string) => item[field] !== undefined && item[field] !== null;
    if ((name === 'tabs' || name === 'tasks' || name === 'notes') && present('tags') && !isTextList(item.tags)) {
        return `${name}[${index}].tags must be a list of text`;
    }
    if ((name === 'sessions' || name === 'tasks') && present('tabIds') && !isTextList(item.tabIds)) {
        return `${name}[${index}].tabIds must be a list of text`;
    }
    if (name === 'tasks' && present('checklist') && !isChecklist(item.checklist)) {
        return `tasks[${index}].checklist must be a list of { id, text, completed }`;
    }
    return null;
}

/** True for an http(s), file, browser-internal… URL. Relative or unparsable text is not a URL. */
export function isSafeUrl(value: string): boolean {
    try {
        return SAFE_URL_PROTOCOLS.has(new URL(value).protocol);
    } catch {
        return false;
    }
}

/** A favicon is shown in an <img>: web URLs and inline images only */
function isSafeFavicon(value: string): boolean {
    return /^data:image\/(png|jpe?g|gif|webp|x-icon|vnd\.microsoft\.icon);/i.test(value) || /^https?:/i.test(value);
}

/**
 * Cleans the elements of one collection. Returns the kept elements, or null with a reason when the collection as a
 * whole is unusable (not an array, or an element of the wrong shape).
 */
function sanitizeCollection(name: CollectionName, value: unknown, warnings: string[], errors: string[]): unknown[] {
    if (value === undefined || value === null) return []; // Older or hand-edited files omit collections
    if (!Array.isArray(value)) {
        errors.push(`"${name}" must be a list`);
        return [];
    }

    const byId = new Map<string, Record<string, unknown>>();
    let blankedUrls = 0;
    let undated = 0;
    let withoutTabList = 0;

    value.forEach((item, index) => {
        if (!isRecord(item)) {
            errors.push(`${name}[${index}] is not an object`);
            return;
        }
        const id = item.id;
        if (typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_CHARS) {
            errors.push(`${name}[${index}] has no valid id`);
            return;
        }
        for (const field of REQUIRED_STRINGS[name]) {
            if (typeof item[field] !== 'string') {
                errors.push(`${name}[${index}].${field} must be text`);
                return;
            }
        }
        if ((name === 'tabs' || name === 'history') && item.url !== undefined && typeof item.url !== 'string') {
            errors.push(`${name}[${index}].url must be text`);
            return;
        }
        if (item.createdAt !== undefined && item.createdAt !== null && typeof item.createdAt !== 'string') {
            errors.push(`${name}[${index}].createdAt must be text`);
            return;
        }
        const wrongText = [...(TEXT_DEFAULT_EMPTY[name] ?? []), ...(TEXT_OPTIONAL[name] ?? [])].find(
            field => item[field] !== undefined && item[field] !== null && typeof item[field] !== 'string'
        );
        if (wrongText) {
            errors.push(`${name}[${index}].${wrongText} must be text`);
            return;
        }
        const listProblem = listFieldProblem(name, index, item);
        if (listProblem) {
            errors.push(listProblem);
            return;
        }
        if (name === 'tasks' && item.status !== undefined && !TASK_STATUSES.includes(item.status as string)) {
            errors.push(`tasks[${index}].status is not valid`);
            return;
        }
        if (name === 'tabs' && item.status !== undefined && !TAB_STATUSES.includes(item.status as string)) {
            errors.push(`tabs[${index}].status is not valid`);
            return;
        }

        const clean: Record<string, unknown> = { ...item };

        if (clean.createdAt === undefined || clean.createdAt === null) {
            clean.createdAt = EPOCH_ISO;
            undated += 1;
        }
        for (const field of TEXT_DEFAULT_EMPTY[name] ?? []) clean[field] ??= '';
        for (const field of ['tags', 'tabIds', 'checklist', ...(TEXT_OPTIONAL[name] ?? [])]) {
            if (clean[field] === null) delete clean[field];
        }
        if (name === 'sessions' && clean.tabIds === undefined) {
            clean.tabIds = [];
            withoutTabList += 1;
        }

        if (
            (name === 'tabs' || name === 'history') &&
            typeof clean.url === 'string' &&
            clean.url !== '' &&
            !isSafeUrl(clean.url)
        ) {
            clean.url = '';
            blankedUrls += 1;
        }
        if ((name === 'tabs' || name === 'history') && typeof clean.favicon === 'string') {
            if (!isSafeFavicon(clean.favicon)) clean.favicon = '';
        }
        if (name === 'tasks' && isRecord(clean.context) && Array.isArray(clean.context.tabs)) {
            clean.context = {
                ...clean.context,
                tabs: clean.context.tabs.filter(isRecord).map(tab => {
                    const url = typeof tab.url === 'string' && isSafeUrl(tab.url) ? tab.url : '';
                    if (url !== tab.url) blankedUrls += 1;
                    const favicon = typeof tab.favicon === 'string' && !isSafeFavicon(tab.favicon) ? '' : tab.favicon;
                    return { ...tab, url, favicon };
                }),
            };
        }

        byId.set(id, clean); // A repeated id keeps the last element
    });

    if (byId.size < value.length && errors.length === 0) {
        const repeated = value.length - byId.size;
        warnings.push(`${name}: ${repeated} repeated ${plural(repeated, 'item')} merged`);
    }
    if (blankedUrls > 0) {
        const verb = blankedUrls === 1 ? 'was' : 'were';
        warnings.push(`${name}: ${blankedUrls} ${plural(blankedUrls, 'link')} with an unsafe address ${verb} emptied`);
    }
    if (undated > 0) {
        warnings.push(`${name}: ${undated} ${plural(undated, 'item')} had no creation date`);
    }
    if (withoutTabList > 0) {
        warnings.push(`sessions: ${withoutTabList} ${plural(withoutTabList, 'session')} had no tab list`);
    }
    return [...byId.values()];
}

/** Validates the `data` object of an export (or of the background's import payload) and returns a cleaned copy */
export function sanitizeCollections(data: unknown): ValidationResult {
    if (data !== undefined && data !== null && !isRecord(data))
        return { ok: false, errors: ['"data" must be an object'] };
    const source = (data ?? {}) as Record<string, unknown>;
    const warnings: string[] = [];
    const errors: string[] = [];

    const collections = {} as Record<CollectionName, unknown[]>;
    for (const name of COLLECTIONS) collections[name] = sanitizeCollection(name, source[name], warnings, errors);

    let canvases: unknown[] = [];
    if (Array.isArray(source.canvases)) canvases = source.canvases.filter(isRecord);
    else if (source.canvases !== undefined && source.canvases !== null) errors.push('"canvases" must be a list');

    if (errors.length > 0) return { ok: false, errors };
    attachOrphanFolders(collections as unknown as ImportCollections, warnings);
    return { ok: true, value: { collections: collections as unknown as ImportCollections, canvases, warnings } };
}

/**
 * A folder whose board is missing is invisible on every board. Attach it to the default board (created when the file
 * has none). Tabs are left alone: tabs without a folder or in a missing one already show as unfiled.
 */
function attachOrphanFolders(collections: ImportCollections, warnings: string[]): void {
    const boardIds = new Set(collections.boards.map(board => board.id));
    let moved = 0;
    collections.folders = collections.folders.map(folder => {
        if (typeof folder.boardId === 'string' && boardIds.has(folder.boardId)) return folder;
        moved += 1;
        return { ...folder, boardId: DEFAULT_BOARD_ID };
    });
    if (moved === 0) return;
    if (!boardIds.has(DEFAULT_BOARD_ID)) {
        // Dated now, not the epoch: boards are ordered by date and the first one is the current board by default
        const now = new Date().toISOString();
        collections.boards = [
            ...collections.boards,
            { id: DEFAULT_BOARD_ID, name: 'My Board', color: '#3b82f6', createdAt: now, updatedAt: now },
        ];
    }
    const verb = moved === 1 ? 'was' : 'were';
    warnings.push(`folders: ${moved} ${plural(moved, 'folder')} without a board ${verb} moved to "My Board"`);
}

/** "1 item" / "2 items" for the warnings shown in the import preview */
function plural(count: number, noun: string): string {
    return count === 1 ? noun : `${noun}s`;
}

/** Problems with the shape of the settings and canvas settings of an export file (not the collections) */
export function checkSettingsShape(file: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const { settings } = file;
    if (settings !== undefined) {
        if (!isRecord(settings)) {
            errors.push('"settings" must be an object');
        } else {
            for (const part of ['extension', 'page', 'timer']) {
                if (settings[part] !== undefined && !isRecord(settings[part])) {
                    errors.push(`"settings.${part}" must be an object`);
                }
            }
            const tracking = isRecord(settings.extension) ? settings.extension[TRACK_ALL_TABS_KEY] : undefined;
            // Anything but false means "recording on", so text or a number here could switch recording on
            if (tracking !== undefined && typeof tracking !== 'boolean') {
                errors.push(`"settings.extension.${TRACK_ALL_TABS_KEY}" must be true or false`);
            }
        }
    }
    const canvasSettings = isRecord(file.data) ? file.data.canvasSettings : undefined;
    if (canvasSettings !== undefined && canvasSettings !== null && !isRecord(canvasSettings)) {
        errors.push('"data.canvasSettings" must be an object');
    }
    return errors;
}

/** Short, user-readable text for a list of problems (the first few) */
export function describeErrors(errors: string[]): string {
    const shown = errors.slice(0, 5).join('; ');
    return errors.length > 5 ? `${shown}; and ${errors.length - 5} more` : shown;
}
