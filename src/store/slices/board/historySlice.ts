import { HistoryItem } from '../../../types';
import { HistorySlice, BoardStoreCreator } from './types';

export const createHistorySlice: BoardStoreCreator<HistorySlice> = set => ({
    history: [],

    addHistory: history =>
        set(state => ({
            history: [
                ...state.history,
                {
                    ...history,
                    createdAt: new Date().toISOString(),
                },
            ],
        })),

    updateHistory: (id, updates) =>
        set(state => ({
            history: state.history.map(historyItem =>
                historyItem.id === id ? { ...historyItem, ...updates } : historyItem
            ),
        })),

    deleteHistory: id =>
        set(state => ({
            history: state.history.filter(historyItem => historyItem.id !== id),
        })),

    fetchHistory: async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_HISTORY',
            });

            if (response && !response.error) {
                set({ history: response });
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    },

    fetchBrowserHistory: async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_BROWSER_HISTORY',
            });

            if (response && !response.error) {
                // Transform chrome.history items to our HistoryItem format
                const transformedHistory = response.map((item: chrome.history.HistoryItem) => ({
                    id: item.id,
                    url: item.url || '',
                    title: item.title || '',
                    lastVisitTime: item.lastVisitTime ? new Date(item.lastVisitTime).toISOString() : undefined,
                    visitCount: item.visitCount,
                    typedCount: item.typedCount,
                    favicon: undefined, // Chrome history doesn't provide favicons directly
                    createdAt: new Date().toISOString(),
                }));

                set(state => ({
                    history: [
                        ...state.history,
                        ...transformedHistory.filter(
                            (newItem: HistoryItem) =>
                                !state.history.some(existingItem => existingItem.id === newItem.id)
                        ),
                    ],
                }));

                return response;
            }
        } catch (error) {
            console.error('Error fetching browser history:', error);
            throw error;
        }

        return [];
    },
});
