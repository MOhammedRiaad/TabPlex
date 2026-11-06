import { ExtensionMessage, Board, Folder, Tab, Task, Note, Session, HistoryItem } from '../types';
import { STORAGE_KEYS } from './storage';
import { broadcast, respondWith, safeSendResponse } from './respond';
import { ACTIVE_CONTEXT_KEY } from '../utils/taskContext';
import { describeErrors, sanitizeCollections } from '../utils/importValidation';

const COLLECTIONS = ['boards', 'folders', 'tabs', 'tasks', 'notes', 'sessions', 'history'] as const;

/** A whole export or import moves every collection: give it far longer than a single-item write */
const BULK_TIMEOUT_MS = 15_000;

interface ImportPayload {
    boards: Board[];
    folders: Folder[];
    tabs: Tab[];
    tasks: Task[];
    notes: Note[];
    sessions: Session[];
    history: HistoryItem[];
}

/** After an import, the active task may no longer exist: then no task is active */
async function clearActiveContextIfGone(tasks: Task[]): Promise<void> {
    const { [ACTIVE_CONTEXT_KEY]: activeId } = await chrome.storage.local.get([ACTIVE_CONTEXT_KEY]);
    if (activeId && !tasks.some(task => task.id === activeId)) await chrome.storage.local.remove(ACTIVE_CONTEXT_KEY);
}

// Handle data-related messages
export function handleDataMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'EXPORT_ALL_DATA':
            // Read every collection by its real key (history lives under 'history_items', not
            // 'tabboard_history', so exports used to drop it)
            return respondWith(
                Promise.all(
                    COLLECTIONS.map(name =>
                        chrome.storage.local.get([STORAGE_KEYS[name]]).then(result => result[STORAGE_KEYS[name]] || [])
                    )
                ),
                sendResponse,
                {
                    timeoutMs: BULK_TIMEOUT_MS,
                    timeoutError: 'Export timed out',
                    map: ([boards, folders, tabs, tasks, notes, sessions, history]) => ({
                        boards,
                        folders,
                        tabs,
                        tasks,
                        notes,
                        sessions,
                        history,
                    }),
                }
            );

        case 'IMPORT_ALL_DATA': {
            if (!message.payload) break;

            // The payload crosses a message boundary: check and clean it again, then save every collection
            // in one call so a failure can't leave the collections half replaced
            const checked = sanitizeCollections(message.payload);
            if (!checked.ok) {
                safeSendResponse(sendResponse, { error: `Invalid import data: ${describeErrors(checked.errors)}` });
                return false;
            }
            const payload = checked.value.collections as ImportPayload;
            // Missing collections are written as empty lists
            return respondWith(
                chrome.storage.local
                    .set(Object.fromEntries(COLLECTIONS.map(name => [STORAGE_KEYS[name], payload[name] ?? []])))
                    .then(() => clearActiveContextIfGone(payload.tasks ?? []))
                    .then(() => broadcast('STORAGE_DATA_IMPORTED')), // The UI reloads
                sendResponse,
                { timeoutMs: BULK_TIMEOUT_MS, timeoutError: 'Import timed out' }
            );
        }
    }

    return false;
}
