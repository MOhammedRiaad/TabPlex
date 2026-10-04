import { addTab as addTabToDB, deleteTab as deleteTabFromDB, updateTab as updateTabInDB } from '../../../utils/storage';
import { Tab } from '../../../types';
import { TabSlice, BoardStoreCreator } from './types';

/** Save a changed tab and tell the background (which updates its copy and the other open TabPlex tabs) */
function saveAndSync(tab: Tab) {
    updateTabInDB(tab).catch(console.error);
    chrome.runtime.sendMessage({ type: 'UPDATE_TAB', payload: tab }).catch(console.error);
}

export const createTabSlice: BoardStoreCreator<TabSlice> = (set, get) => ({
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

    updateTab: (id, updates) => {
        const tab = get().tabs.find(t => t.id === id);
        if (!tab) return;
        const updated = { ...tab, ...updates };
        set(state => ({ tabs: state.tabs.map(t => (t.id === id ? updated : t)) }));
        saveAndSync(updated);
    },

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

    moveTab: (tabId, newFolderId) => {
        const tab = get().tabs.find(t => t.id === tabId);
        if (!tab) return;
        const moved = { ...tab, folderId: newFolderId };
        set(state => ({ tabs: state.tabs.map(t => (t.id === tabId ? moved : t)) }));
        saveAndSync(moved);
    },

    moveAllTabsToFolder: (sourceFolderId, targetFolderId) => {
        const moved = get()
            .tabs.filter(t => t.folderId === sourceFolderId)
            .map(t => ({ ...t, folderId: targetFolderId }));
        if (moved.length === 0) return;
        const byId = new Map(moved.map(t => [t.id, t]));
        set(state => ({ tabs: state.tabs.map(t => byId.get(t.id) ?? t) }));
        moved.forEach(saveAndSync);
    },

    reorderTab: (tabId, newIndex, folderId) => {
        const state = get();
        const folderTabs = state.tabs
            .filter(t => t.folderId === folderId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const otherTabs = state.tabs.filter(t => t.folderId !== folderId);
        const tabToMove = folderTabs.find(t => t.id === tabId);
        if (!tabToMove) return;

        // Remove from old position, insert at the new one, then renumber the folder
        folderTabs.splice(folderTabs.indexOf(tabToMove), 1);
        folderTabs.splice(newIndex, 0, tabToMove);
        const updatedFolderTabs = folderTabs.map((tab, index) => ({ ...tab, order: index }));

        set({ tabs: [...otherTabs, ...updatedFolderTabs] });
        // Persist and sync only the tabs whose position changed
        updatedFolderTabs.filter((tab, i) => folderTabs[i].order !== tab.order).forEach(saveAndSync);
    },
});
