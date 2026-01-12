import { addTab as addTabToDB, deleteTab as deleteTabFromDB, updateTab as updateTabInDB } from '../../../utils/storage';
import { TabSlice, BoardStoreCreator } from './types';

export const createTabSlice: BoardStoreCreator<TabSlice> = set => ({
    tabs: [],

    addTab: tab => {
        set(state => {
            const tabsInFolder = state.tabs.filter(t => t.folderId === tab.folderId);
            const newTab = {
                ...tab,
                createdAt: new Date().toISOString(),
                order: tabsInFolder.length,
            };

            addTabToDB(newTab).catch(console.error);

            chrome.runtime
                .sendMessage({
                    type: 'ADD_TAB',
                    payload: newTab,
                })
                .catch(console.error);

            return { tabs: [...state.tabs, newTab] };
        });
    },

    updateTab: (id, updates) =>
        set(state => {
            const updatedTabs = state.tabs.map(tab => {
                if (tab.id === id) {
                    const updatedTab = { ...tab, ...updates };
                    // Persist to IndexedDB
                    updateTabInDB(updatedTab).catch(console.error);
                    return updatedTab;
                }
                return tab;
            });
            return { tabs: updatedTabs };
        }),

    deleteTab: id => {
        set(state => ({
            tabs: state.tabs.filter(tab => tab.id !== id),
        }));

        deleteTabFromDB(id).catch(console.error);

        chrome.runtime
            .sendMessage({
                type: 'DELETE_TAB',
                payload: { id },
            })
            .catch(console.error);
    },

    deleteTabSilently: id => {
        set(state => ({
            tabs: state.tabs.filter(tab => tab.id !== id),
        }));

        deleteTabFromDB(id).catch(console.error);
    },

    moveTab: (tabId, newFolderId) =>
        set(state => {
            const newState = {
                tabs: state.tabs.map(tab => (tab.id === tabId ? { ...tab, folderId: newFolderId } : tab)),
            };
            // Also need to persist this change
            const updatedTab = newState.tabs.find(t => t.id === tabId);
            if (updatedTab) {
                updateTabInDB(updatedTab).catch(console.error);
            }
            return newState;
        }),

    moveAllTabsToFolder: (sourceFolderId, targetFolderId) =>
        set(state => {
            const updatedTabs = state.tabs.map(tab => {
                if (tab.folderId === sourceFolderId) {
                    const updatedTab = { ...tab, folderId: targetFolderId };
                    updateTabInDB(updatedTab).catch(console.error);
                    return updatedTab;
                }
                return tab;
            });

            return { tabs: updatedTabs };
        }),

    reorderTab: (tabId, newIndex, folderId) =>
        set(state => {
            const folderTabs = state.tabs
                .filter(t => t.folderId === folderId)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const otherTabs = state.tabs.filter(t => t.folderId !== folderId);
            const tabToMove = folderTabs.find(t => t.id === tabId);

            if (!tabToMove) return state;

            const oldIndex = folderTabs.indexOf(tabToMove);
            if (oldIndex === -1) return state;

            // Remove from old position
            folderTabs.splice(oldIndex, 1);
            // Insert at new position
            folderTabs.splice(newIndex, 0, tabToMove);

            // Update order field for all tabs in folder
            const updatedFolderTabs = folderTabs.map((tab, index) => {
                const updatedTab = { ...tab, order: index };
                // Persist only if changed
                if (tab.order !== index) {
                    updateTabInDB(updatedTab).catch(console.error);
                }
                return updatedTab;
            });

            return {
                tabs: [...otherTabs, ...updatedFolderTabs],
            };
        }),
});
