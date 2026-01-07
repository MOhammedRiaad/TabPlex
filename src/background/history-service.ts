import { getAllHistory, addHistory, updateHistory, deleteHistory, getHistory } from './storage';
import { ExtensionMessage, ExtensionResponse, HistoryItem } from '../types';

// Helper function to safely send response
// Helper function to safely send response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeSendResponse(_sendResponse: (response: any) => void, response: unknown) {
    try {
        _sendResponse(response);
    } catch (error) {
        // Response already sent or channel closed
        console.warn('Failed to send response:', error);
    }
}

// Handle history-related messages
export function handleHistoryMessage(message: ExtensionMessage, _sendResponse: (response: ExtensionResponse) => void) {
    switch (message.type) {
        case 'GET_HISTORY':
            // Return browser history items

            let historyResponseSent = false;

            getAllHistory()
                .then(history => {
                    if (!historyResponseSent) {
                        historyResponseSent = true;
                        safeSendResponse(_sendResponse, history);
                    }
                })
                .catch((error: unknown) => {
                    if (!historyResponseSent) {
                        historyResponseSent = true;
                        safeSendResponse(_sendResponse, { error: (error as Error).message });
                    }
                });

            setTimeout(() => {
                if (!historyResponseSent) {
                    historyResponseSent = true;
                    safeSendResponse(_sendResponse, { error: 'Timeout getting history' }); // Fallback response
                }
            }, 1000);

            return true;

        case 'ADD_HISTORY':
            // Add a history item
            if (message.payload) {
                let addHistoryResponseSent = false;
                const historyItem = message.payload as Omit<HistoryItem, 'createdAt'>;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                addHistory(historyItem as any)
                    .then(() => {
                        if (!addHistoryResponseSent) {
                            addHistoryResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!addHistoryResponseSent) {
                            addHistoryResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!addHistoryResponseSent) {
                        addHistoryResponseSent = true;
                        safeSendResponse(_sendResponse, { success: true }); // Fallback response
                    }
                }, 1000);

                return true;
            }
            break;

        case 'UPDATE_HISTORY':
            // Update a history item
            if (message.payload) {
                let updateHistoryResponseSent = false;
                const updatePayload = message.payload as { id: string; updates: Partial<HistoryItem> };

                // We need to fetch, merge, and save because storage.updateHistory expects full item and replaces it
                getHistory(updatePayload.id)
                    .then(existingItem => {
                        if (existingItem) {
                            const updatedItem = { ...existingItem, ...updatePayload.updates };
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            return updateHistory(updatedItem as any);
                        } else {
                            throw new Error('Item not found');
                        }
                    })
                    .then(() => {
                        if (!updateHistoryResponseSent) {
                            updateHistoryResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!updateHistoryResponseSent) {
                            updateHistoryResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!updateHistoryResponseSent) {
                        updateHistoryResponseSent = true;
                        safeSendResponse(_sendResponse, { success: true }); // Fallback response
                    }
                }, 1000);

                return true;
            }
            break;

        case 'DELETE_HISTORY':
            // Delete a history item
            if (message.payload && (message.payload as { id: string }).id) {
                let deleteHistoryResponseSent = false;
                const historyId = (message.payload as { id: string }).id;

                deleteHistory(historyId)
                    .then(() => {
                        if (!deleteHistoryResponseSent) {
                            deleteHistoryResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteHistoryResponseSent) {
                            deleteHistoryResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteHistoryResponseSent) {
                        deleteHistoryResponseSent = true;
                        safeSendResponse(_sendResponse, { success: true }); // Fallback response
                    }
                }, 1000);

                return true;
            }
            break;

        case 'GET_HISTORY_ITEM':
            // Get a specific history item
            if (message.payload && (message.payload as { id: string }).id) {
                let getHistoryItemResponseSent = false;
                const historyId = (message.payload as { id: string }).id;

                getHistory(historyId)
                    .then(historyItem => {
                        if (!getHistoryItemResponseSent) {
                            getHistoryItemResponseSent = true;
                            safeSendResponse(_sendResponse, historyItem);
                        }
                    })
                    .catch((error: unknown) => {
                        if (!getHistoryItemResponseSent) {
                            getHistoryItemResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!getHistoryItemResponseSent) {
                        getHistoryItemResponseSent = true;
                    }
                }, 1000);

                return true;
            }
            break;

        case 'GET_BROWSER_HISTORY':
            // Get actual browser history using chrome.history API

            let browserHistoryResponseSent = false;

            chrome.history
                .search({
                    text: '',
                    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
                    maxResults: 100,
                })
                .then(browserHistory => {
                    if (!browserHistoryResponseSent) {
                        browserHistoryResponseSent = true;
                        safeSendResponse(_sendResponse, browserHistory);
                    }
                })
                .catch((error: unknown) => {
                    if (!browserHistoryResponseSent) {
                        browserHistoryResponseSent = true;
                        safeSendResponse(_sendResponse, { error: (error as Error).message });
                    }
                });

            setTimeout(() => {
                if (!browserHistoryResponseSent) {
                    browserHistoryResponseSent = true;
                }
            }, 3000); // Longer timeout for history search

            return true;
    }

    return false;
}
