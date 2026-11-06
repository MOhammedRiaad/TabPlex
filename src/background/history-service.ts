import { getAllHistory, addHistory, updateHistory, deleteHistory, getHistory } from './storage';
import { respondWith } from './respond';
import { ExtensionMessage, HistoryItem } from '../types';

// Handle history-related messages
export function handleHistoryMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    const id = (message.payload as { id?: string } | undefined)?.id;

    switch (message.type) {
        case 'GET_HISTORY':
            // Return the history TabPlex keeps
            return respondWith(getAllHistory(), sendResponse, {
                timeoutMs: 1000,
                timeoutError: 'Timeout getting history',
                map: history => history,
            });

        case 'ADD_HISTORY':
            if (message.payload) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const item = message.payload as any;
                return respondWith(addHistory(item), sendResponse, { timeoutMs: 1000 });
            }
            break;

        case 'UPDATE_HISTORY':
            if (message.payload) {
                const { id: itemId, updates } = message.payload as { id: string; updates: Partial<HistoryItem> };
                // storage.updateHistory expects the full item and replaces it: fetch, merge, save
                return respondWith(
                    getHistory(itemId).then(existing => {
                        if (!existing) throw new Error('Item not found');
                        return updateHistory({ ...existing, ...updates });
                    }),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;

        case 'DELETE_HISTORY':
            if (id) return respondWith(deleteHistory(id), sendResponse, { timeoutMs: 1000 });
            break;

        case 'GET_HISTORY_ITEM':
            if (id) {
                return respondWith(getHistory(id), sendResponse, {
                    timeoutMs: 1000,
                    timeoutError: 'Timed out',
                    map: item => item,
                });
            }
            break;

        case 'GET_BROWSER_HISTORY':
            // The browser's own history, last 30 days
            return respondWith(
                chrome.history.search({
                    text: '',
                    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
                    maxResults: 100,
                }),
                sendResponse,
                { timeoutMs: 3000, timeoutError: 'Timed out', map: items => items } // Longer timeout for history search
            );
    }

    return false;
}
