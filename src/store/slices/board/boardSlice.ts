import {
    addBoard as addBoardToDB,
    deleteBoard as deleteBoardFromDB,
    addFolder as addFolderToDB,
    deleteFolder as deleteFolderFromDB,
} from '../../../utils/storage';
import { BoardSlice, BoardStoreCreator } from './types';

export const createBoardSlice: BoardStoreCreator<BoardSlice> = set => ({
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

    updateBoard: (id, updates) =>
        set(state => ({
            boards: state.boards.map(board =>
                board.id === id ? { ...board, ...updates, updatedAt: new Date().toISOString() } : board
            ),
        })),

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

    updateFolder: (id, updates) =>
        set(state => ({
            folders: state.folders.map(folder => (folder.id === id ? { ...folder, ...updates } : folder)),
        })),

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
