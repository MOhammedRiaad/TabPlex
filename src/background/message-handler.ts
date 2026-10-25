import { getActiveTabInfo, createTabInFolder, handleMoveTab } from './tab-service';
import { handleFolderMessage } from './folder-service';
import { handleTaskMessage } from './task-service';
import { handleNoteMessage } from './note-service';
import { handleHistoryMessage } from './history-service';
import { handleSessionMessage } from './session-service';
import { handleDataMessage } from './data-service';
import { handleBookmarkMessage } from './bookmark-service';
import { CONTEXT_MESSAGE_TYPES, handleContextMessage } from './context-service';
import { ORGANIZE_MESSAGE_TYPES, handleOrganizeMessage } from './organize-service';
import { addTab, deleteBoard, deleteTab, saveBoard, updateBoard, updateFolder, updateTab } from './storage';
import { handleUpdate } from './update-handler';
import { openApp } from './open-app';
import { broadcast, respondWith, safeSendResponse } from './respond';
import { ExtensionMessage, Tab, Board, Folder } from '../types';

const idOf = (message: ExtensionMessage) => (message.payload as { id?: string } | undefined)?.id;

// Listen for messages from the popup/tab
chrome.runtime.onMessage.addListener(
    (message: ExtensionMessage, sender, sendResponse: (response?: unknown) => void) => {
        // Only this extension's own pages talk to the background; and a malformed message gets an error, not a throw.
        // (Payloads hold notes, tasks and URLs, so they are never logged.)
        if (sender?.id !== undefined && sender.id !== chrome.runtime.id) return false;
        if (!message || typeof message.type !== 'string') {
            safeSendResponse(sendResponse, { error: 'Malformed message' });
            return false;
        }

        // Ignore internal STORAGE_* notification messages (these are sent from background to popup)
        if (message.type.startsWith('STORAGE_')) {
            return false;
        }

        // Handle different message types

        switch (message.type) {
            case 'OPEN_TABBOARD':
                // The onboarding page's "Get started"
                return respondWith(openApp(), sendResponse);

            case 'MOVE_TAB':
                // Handle tab movement between folders
                return respondWith(
                    handleMoveTab(message.payload as { tabId: string; newFolderId: string }),
                    sendResponse,
                    { timeoutMs: 1000 }
                );

            case 'ADD_TAB':
                if (message.payload) {
                    const tab = message.payload as Tab;
                    return respondWith(
                        addTab(tab).then(() => broadcast('STORAGE_TAB_ADDED', tab)),
                        sendResponse,
                        { timeoutMs: 1000 }
                    );
                }
                break;

            case 'GET_ACTIVE_TAB':
                // Return information about the currently active tab
                return respondWith(getActiveTabInfo(), sendResponse, {
                    timeoutMs: 1000,
                    timeoutError: 'Timeout getting active tab info',
                    map: info => info,
                });

            case 'CREATE_TAB_IN_FOLDER':
                // Create a new tab and associate it with a folder
                createTabInFolder(message.payload as { url: string; folderId: string });
                safeSendResponse(sendResponse, { success: true });
                break;

            case 'DELETE_TAB': {
                const id = idOf(message);
                if (id) {
                    return respondWith(
                        deleteTab(id).then(() => broadcast('STORAGE_TAB_DELETED', { id })),
                        sendResponse,
                        { timeoutMs: 1000 }
                    );
                }
                break;
            }

            case 'ADD_BOARD':
                // Add or update a board (through the serialized storage layer, so concurrent writes can't clobber)
                if (message.payload) {
                    const board = message.payload as Board;
                    return respondWith(
                        saveBoard(board).then(({ created }) => {
                            if (created) broadcast('STORAGE_BOARD_ADDED', board);
                        }),
                        sendResponse
                    );
                }
                break;

            case 'DELETE_BOARD': {
                const id = idOf(message);
                if (id) {
                    return respondWith(
                        deleteBoard(id).then(() => broadcast('STORAGE_BOARD_DELETED', { id })),
                        sendResponse
                    );
                }
                break;
            }

            // Edits made in a TabPlex tab (rename, move, reorder…)
            case 'UPDATE_TAB':
                return handleUpdate<Tab>(message, updateTab, 'STORAGE_TAB_UPDATED', sendResponse);
            case 'UPDATE_BOARD':
                return handleUpdate<Board>(message, updateBoard, 'STORAGE_BOARD_UPDATED', sendResponse);
            case 'UPDATE_FOLDER':
                return handleUpdate<Folder>(message, updateFolder, 'STORAGE_FOLDER_UPDATED', sendResponse);

            case 'ADD_FOLDER':
            case 'DELETE_FOLDER':
                return handleFolderMessage(message, sendResponse);

            // Handle task messages
            case 'ADD_TASK':
            case 'UPDATE_TASK':
            case 'DELETE_TASK':
                return handleTaskMessage(message, sendResponse);

            // Handle note messages
            case 'ADD_NOTE':
            case 'UPDATE_NOTE':
            case 'DELETE_NOTE':
                return handleNoteMessage(message, sendResponse);

            // Handle history messages
            case 'GET_HISTORY':
            case 'ADD_HISTORY':
            case 'UPDATE_HISTORY':
            case 'DELETE_HISTORY':
            case 'GET_HISTORY_ITEM':
            case 'GET_BROWSER_HISTORY':
                return handleHistoryMessage(message, sendResponse);

            // Handle session messages
            case 'GET_SESSIONS':
            case 'ADD_SESSION':
            case 'UPDATE_SESSION':
            case 'DELETE_SESSION':
            case 'GET_SESSION':
            case 'SESSION_INFERENCE_COMPLETE':
                return handleSessionMessage(message, sendResponse);

            // Handle data messages
            case 'EXPORT_ALL_DATA':
            case 'IMPORT_ALL_DATA':
                return handleDataMessage(message, sendResponse);

            // Handle bookmark messages
            case 'GET_BOOKMARKS':
            case 'GET_BOOKMARK':
            case 'CREATE_BOOKMARK':
            case 'CREATE_BOOKMARK_FOLDER':
            case 'UPDATE_BOOKMARK':
            case 'MOVE_BOOKMARK':
            case 'DELETE_BOOKMARK':
            case 'DELETE_BOOKMARK_TREE':
            case 'SEARCH_BOOKMARKS':
            case 'GET_BOOKMARK_CHILDREN':
                return handleBookmarkMessage(message, sendResponse);

            default:
                // Park & Resume task contexts
                if (CONTEXT_MESSAGE_TYPES.includes(message.type)) {
                    return handleContextMessage(message, sendResponse);
                }
                // Organize tabs (create / undo tab groups)
                if (ORGANIZE_MESSAGE_TYPES.includes(message.type)) {
                    return handleOrganizeMessage(message, sendResponse);
                }
                console.warn('Unknown message type:', message.type);
                safeSendResponse(sendResponse, { error: `Unknown message type: ${message.type}` });
                break;
        }

        // Return false for synchronous operations (response already sent)
        return false;
    }
);
