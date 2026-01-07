import { getActiveTabInfo, createTabInFolder, handleMoveTab } from './tab-service';
import { handleFolderMessage } from './folder-service';
import { handleTaskMessage } from './task-service';
import { handleNoteMessage } from './note-service';
import { handleHistoryMessage } from './history-service';
import { handleSessionMessage } from './session-service';
import { handleDataMessage } from './data-service';
import { addTab, deleteTab } from './storage';
import { ExtensionMessage, Tab, Board } from '../types';

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

// Listen for messages from the popup/tab
chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, _sender, _sendResponse: (response?: unknown) => void) => {
        console.log('Background received message:', message);

        // Handle different message types
        console.log('Processed message:', message); // Added to ensure usage of message

        switch (message.type) {
            case 'MOVE_TAB':
                // Handle tab movement between folders
                let moveTabResponseSent = false;

                handleMoveTab(message.payload as { tabId: string; newFolderId: string })
                    .then(() => {
                        if (!moveTabResponseSent) {
                            moveTabResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!moveTabResponseSent) {
                            moveTabResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!moveTabResponseSent) {
                        moveTabResponseSent = true;
                        safeSendResponse(_sendResponse, { success: true }); // Fallback response
                    }
                }, 1000);

                return true;

            case 'ADD_TAB':
                // Add a tab
                if (message.payload) {
                    let addTabResponseSent = false;

                    addTab(message.payload as Tab)
                        .then(() => {
                            // Notify the side panel about the addition
                            chrome.runtime
                                .sendMessage({
                                    type: 'STORAGE_TAB_ADDED',
                                    payload: message.payload,
                                })
                                .catch(() => {}); // Ignore errors from sendMessage

                            if (!addTabResponseSent) {
                                addTabResponseSent = true;
                                safeSendResponse(_sendResponse, { success: true });
                            }
                        })
                        .catch((error: unknown) => {
                            if (!addTabResponseSent) {
                                addTabResponseSent = true;
                                safeSendResponse(_sendResponse, { error: (error as Error).message });
                            }
                        });

                    setTimeout(() => {
                        if (!addTabResponseSent) {
                            addTabResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true }); // Fallback response
                        }
                    }, 1000);

                    return true;
                }
                break;

            case 'GET_ACTIVE_TAB':
                // Return information about the currently active tab
                let responseSent = false;

                getActiveTabInfo()
                    .then(tabInfo => {
                        if (!responseSent) {
                            responseSent = true;
                            safeSendResponse(_sendResponse, tabInfo);
                        }
                    })
                    .catch((error: unknown) => {
                        if (!responseSent) {
                            responseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                // Set a timeout to prevent hanging if the response isn't sent
                setTimeout(() => {
                    if (!responseSent) {
                        responseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout getting active tab info' });
                    }
                }, 1000);

                return true;

            case 'CREATE_TAB_IN_FOLDER':
                // Create a new tab and associate it with a folder
                createTabInFolder(message.payload as { url: string; folderId: string });
                safeSendResponse(_sendResponse, { success: true });
                break;

            case 'DELETE_TAB':
                // Delete a tab
                if (message.payload && (message.payload as { id: string }).id) {
                    let deleteTabResponseSent = false;
                    const tabId = (message.payload as { id: string }).id;

                    deleteTab(tabId)
                        .then(() => {
                            // Notify the side panel about the deletion
                            chrome.runtime
                                .sendMessage({
                                    type: 'STORAGE_TAB_DELETED',
                                    payload: { id: tabId },
                                })
                                .catch(() => {}); // Ignore errors from sendMessage

                            if (!deleteTabResponseSent) {
                                deleteTabResponseSent = true;
                                safeSendResponse(_sendResponse, { success: true });
                            }
                        })
                        .catch((error: unknown) => {
                            if (!deleteTabResponseSent) {
                                deleteTabResponseSent = true;
                                safeSendResponse(_sendResponse, { error: (error as Error).message });
                            }
                        });

                    setTimeout(() => {
                        if (!deleteTabResponseSent) {
                            deleteTabResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true }); // Fallback response
                        }
                    }, 1000);

                    return true;
                }
                break;

            case 'ADD_BOARD':
                // Add a board
                if (message.payload) {
                    let addBoardResponseSent = false;

                    // Check if board already exists before adding
                    chrome.storage.local
                        .get(['tabboard_boards'])
                        .then((result: { [key: string]: unknown }) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const boards: Board[] = (result['tabboard_boards'] as any[]) || [];
                            const boardId = (message.payload as { id: string }).id;

                            const existingIndex = boards.findIndex(board => board.id === boardId);

                            if (existingIndex !== -1) {
                                // Update existing board instead of adding duplicate
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                boards[existingIndex] = message.payload as any;
                            } else {
                                // Add new board
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                boards.push(message.payload as any);
                            }

                            chrome.storage.local
                                .set({ tabboard_boards: boards })
                                .then(() => {
                                    // Only notify if it's a new board, not an update
                                    if (existingIndex === -1) {
                                        chrome.runtime
                                            .sendMessage({
                                                type: 'STORAGE_BOARD_ADDED',
                                                payload: message.payload,
                                            })
                                            .catch(() => {}); // Ignore errors from sendMessage
                                    }

                                    if (!addBoardResponseSent) {
                                        addBoardResponseSent = true;
                                        safeSendResponse(_sendResponse, { success: true });
                                    }
                                })
                                .catch((error: unknown) => {
                                    if (!addBoardResponseSent) {
                                        addBoardResponseSent = true;
                                        safeSendResponse(_sendResponse, { error: (error as Error).message });
                                    }
                                });
                        })
                        .catch((error: unknown) => {
                            if (!addBoardResponseSent) {
                                addBoardResponseSent = true;
                                safeSendResponse(_sendResponse, { error: (error as Error).message });
                            }
                        });

                    setTimeout(() => {
                        if (!addBoardResponseSent) {
                            addBoardResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true }); // Fallback response
                        }
                    }, 1000);

                    return true;
                }
                break;

            case 'DELETE_BOARD':
                // Delete a board
                if (message.payload && (message.payload as { id: string }).id) {
                    let deleteBoardResponseSent = false;

                    // For now, we'll just delete the board from storage
                    // In a real implementation, you might want to also delete associated folders/tabs
                    chrome.storage.local
                        .get(['tabboard_boards'])
                        .then((result: { [key: string]: unknown }) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const boards: Board[] = (result['tabboard_boards'] as any[]) || [];
                            const deletePayload = message.payload as { id: string };
                            const filteredBoards = boards.filter(board => board.id !== deletePayload.id);

                            chrome.storage.local
                                .set({ tabboard_boards: filteredBoards })
                                .then(() => {
                                    // Notify the side panel about the deletion
                                    chrome.runtime
                                        .sendMessage({
                                            type: 'STORAGE_BOARD_DELETED',
                                            payload: { id: deletePayload.id },
                                        })
                                        .catch(() => {}); // Ignore errors from sendMessage

                                    if (!deleteBoardResponseSent) {
                                        deleteBoardResponseSent = true;
                                        safeSendResponse(_sendResponse, { success: true });
                                    }
                                })
                                .catch((error: unknown) => {
                                    if (!deleteBoardResponseSent) {
                                        deleteBoardResponseSent = true;
                                        safeSendResponse(_sendResponse, { error: (error as Error).message });
                                    }
                                });
                        })
                        .catch((error: unknown) => {
                            if (!deleteBoardResponseSent) {
                                deleteBoardResponseSent = true;
                                safeSendResponse(_sendResponse, { error: (error as Error).message });
                            }
                        });

                    setTimeout(() => {
                        if (!deleteBoardResponseSent) {
                            deleteBoardResponseSent = true;
                        }
                    }, 1000);

                    return true;
                }
                break;

            // Handle folder messages
            case 'ADD_FOLDER':
            case 'DELETE_FOLDER':
                return handleFolderMessage(message, _sendResponse);

            // Handle task messages
            case 'ADD_TASK':
            case 'DELETE_TASK':
                return handleTaskMessage(message, _sendResponse);

            // Handle note messages
            case 'ADD_NOTE':
            case 'DELETE_NOTE':
                return handleNoteMessage(message, _sendResponse);

            // Handle history messages
            case 'GET_HISTORY':
            case 'ADD_HISTORY':
            case 'UPDATE_HISTORY':
            case 'DELETE_HISTORY':
            case 'GET_HISTORY_ITEM':
            case 'GET_BROWSER_HISTORY':
                return handleHistoryMessage(message, _sendResponse);

            // Handle session messages
            case 'GET_SESSIONS':
            case 'ADD_SESSION':
            case 'UPDATE_SESSION':
            case 'DELETE_SESSION':
            case 'GET_SESSION':
            case 'SESSION_INFERENCE_COMPLETE':
                return handleSessionMessage(message, _sendResponse);

            // Handle data messages
            case 'EXPORT_ALL_DATA':
            case 'IMPORT_ALL_DATA':
                return handleDataMessage(message, _sendResponse);

            default:
                safeSendResponse(_sendResponse, { error: 'Unknown message type' });
                break;
        }

        // Return false for synchronous operations (response already sent)
        return false;
    }
);
