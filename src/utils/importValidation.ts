// Checks and cleans an import file before anything is written. Shared by the UI (utils/exportImport.ts) and the
// background (data-service.ts), so keep it free of DOM and React.
import type { Board, Folder, HistoryItem, Note, Session, Tab, Task } from '../types';

/** Biggest import file accepted (characters of JSON text) */
export const MAX_IMPORT_CHARS = 20 * 1024 * 1024;

const MAX_ID_CHARS = 200;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

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
        if (name === 'tasks' && item.status !== undefined && !TASK_STATUSES.includes(item.status as string)) {
            errors.push(`tasks[${index}].status is not valid`);
            return;
        }
        if (name === 'tabs' && item.status !== undefined && !TAB_STATUSES.includes(item.status as string)) {
            errors.push(`tabs[${index}].status is not valid`);
            return;
        }

        const clean: Record<string, unknown> = { ...item };

        if ((name === 'tabs' || name === 'history') && typeof clean.url === 'string' && !isSafeUrl(clean.url)) {
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
        warnings.push(`${name}: ${value.length - byId.size} repeated item(s) merged`);
    }
    if (blankedUrls > 0) warnings.push(`${name}: ${blankedUrls} link(s) with an unsafe address were emptied`);
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
    return { ok: true, value: { collections: collections as unknown as ImportCollections, canvases, warnings } };
}

/** Short, user-readable text for a list of problems (the first few) */
export function describeErrors(errors: string[]): string {
    const shown = errors.slice(0, 5).join('; ');
    return errors.length > 5 ? `${shown}; and ${errors.length - 5} more` : shown;
}
