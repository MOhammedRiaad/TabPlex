import {
    addBoard as addBoardToDB,
    updateBoard as updateBoardInDB,
    deleteBoard as deleteBoardFromDB,
    addFolder as addFolderToDB,
    updateFolder as updateFolderInDB,
    deleteFolder as deleteFolderFromDB,
} from '../../../utils/storage';
import { Board, Folder } from '../../../types';
import { BoardSlice, BoardStoreCreator } from './types';

export const createBoardSlice: BoardStoreCreator<BoardSlice> = (set, get) => ({
    boards: [],
    folders: [],

    addBoard: board => {
        const newBoard = {
            ...board,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        set(state => ({
            boards: [...state.boards, newBoard],
        }));

        addBoardToDB(newBoard).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'ADD_BOARD',
                payload: newBoard,
            })
            .catch(console.error);
    },

    addBoardSilently: board => {
        set(state => {
            if (state.boards.some(b => b.id === board.id)) return state;
            return { boards: [...state.boards, board] };
        });

        addBoardToDB(board).catch(console.error);
    },

    updateBoard: (id, updates) => {
        const board = get().boards.find(b => b.id === id);
        if (!board) return;
        const updated: Board = { ...board, ...updates, updatedAt: new Date().toISOString() };

        set(state => ({ boards: state.boards.map(b => (b.id === id ? updated : b)) }));
        updateBoardInDB(updated).catch(console.error);
        // Keep the background copy and other open TabPlex tabs in sync
        chrome.runtime.sendMessage({ type: 'UPDATE_BOARD', payload: updated }).catch(console.error);
    },

    deleteBoard: id => {
        set(state => ({
            boards: state.boards.filter(board => board.id !== id),
        }));

        deleteBoardFromDB(id).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'DELETE_BOARD',
                payload: { id },
            })
            .catch(console.error);
    },

    deleteBoardSilently: id => {
        set(state => ({
            boards: state.boards.filter(board => board.id !== id),
        }));

        deleteBoardFromDB(id).catch(console.error);
    },

    addFolder: folder => {
        const newFolder = {
            ...folder,
            createdAt: new Date().toISOString(),
        };

        set(state => ({
            folders: [...state.folders, newFolder],
        }));

        addFolderToDB(newFolder).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'ADD_FOLDER',
                payload: newFolder,
            })
            .catch(console.error);
    },

    addFolderSilently: folder => {
        set(state => {
            if (state.folders.some(f => f.id === folder.id)) return state;
            return { folders: [...state.folders, folder] };
        });

        addFolderToDB(folder).catch(console.error);
    },

    updateFolder: (id, updates) => {
        const folder = get().folders.find(f => f.id === id);
        if (!folder) return;
        const updated: Folder = { ...folder, ...updates };

        set(state => ({ folders: state.folders.map(f => (f.id === id ? updated : f)) }));
        updateFolderInDB(updated).catch(console.error);
        chrome.runtime.sendMessage({ type: 'UPDATE_FOLDER', payload: updated }).catch(console.error);
    },

    deleteFolder: (id, moveTabs = false, targetFolderId = '') => {
        set(state => ({
            folders: state.folders.filter(folder => folder.id !== id),
            tabs: moveTabs
                ? state.tabs.map(tab => (tab.folderId === id ? { ...tab, folderId: targetFolderId } : tab))
                : state.tabs.filter(tab => tab.folderId !== id),
        }));

        deleteFolderFromDB(id).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'DELETE_FOLDER',
                payload: { id, moveTabs, targetFolderId },
            })
            .catch(console.error);
    },

    deleteFolderSilently: (id, moveTabs = false, targetFolderId = '') => {
        set(state => ({
            folders: state.folders.filter(folder => folder.id !== id),
            tabs: moveTabs
                ? state.tabs.map(tab => (tab.folderId === id ? { ...tab, folderId: targetFolderId } : tab))
                : state.tabs.filter(tab => tab.folderId !== id),
        }));

        deleteFolderFromDB(id).catch(console.error);
    },
});
