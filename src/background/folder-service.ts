import { addFolder, deleteFolder, getAllTabs, updateTab, deleteTab } from './storage';
import { broadcast, respondWith } from './respond';
import { ExtensionMessage, Folder } from '../types';

interface DeleteFolderPayload {
    id: string;
    moveTabs?: boolean;
    targetFolderId?: string;
}

/** The tabs of a folder that is going away: moved to another folder, or deleted with it */
async function releaseFolderTabs({ id, moveTabs, targetFolderId }: DeleteFolderPayload): Promise<void> {
    const tabsInFolder = (await getAllTabs()).filter(tab => tab.folderId === id);
    if (tabsInFolder.length === 0) return;
    if (moveTabs) {
        await Promise.all(tabsInFolder.map(tab => updateTab({ ...tab, folderId: targetFolderId || '' })));
    } else {
        await Promise.all(tabsInFolder.map(tab => deleteTab(tab.id)));
    }
}

// Handle folder-related messages
export function handleFolderMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'ADD_FOLDER':
            if (message.payload) {
                const folder = message.payload as Folder;
                return respondWith(
                    addFolder(folder).then(() => broadcast('STORAGE_FOLDER_ADDED', folder)),
                    sendResponse,
                    { timeoutMs: 1000 }
                );
            }
            break;

        case 'DELETE_FOLDER':
            if ((message.payload as DeleteFolderPayload | undefined)?.id) {
                const payload = message.payload as DeleteFolderPayload;
                return respondWith(
                    releaseFolderTabs(payload)
                        .then(() => deleteFolder(payload.id)) // Now delete the folder itself
                        .then(() => broadcast('STORAGE_FOLDER_DELETED', { id: payload.id })),
                    sendResponse,
                    { timeoutMs: 2000, timeoutError: 'Delete folder timed out' }
                );
            }
            break;
    }

    return false;
}
