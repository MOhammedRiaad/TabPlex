import { addFolder, deleteFolder, getAllTabs, updateTab, deleteTab } from './storage';
import { ExtensionMessage, Folder } from '../types';

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

// Handle folder-related messages
export function handleFolderMessage(message: ExtensionMessage, _sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'ADD_FOLDER':
            // Add a folder
            if (message.payload) {
                let addFolderResponseSent = false;

                addFolder(message.payload as Folder)
                    .then(() => {
                        // Notify the side panel about the addition
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_FOLDER_ADDED',
                                payload: message.payload,
                            })
                            .catch(() => {}); // Ignore errors from sendMessage

                        if (!addFolderResponseSent) {
                            addFolderResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!addFolderResponseSent) {
                            addFolderResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!addFolderResponseSent) {
                        addFolderResponseSent = true;
                        safeSendResponse(_sendResponse, { success: true }); // Fallback response
                    }
                }, 1000);

                return true;
            }
            break;

        case 'DELETE_FOLDER':
            // Delete a folder
            if (
                message.payload &&
                (message.payload as { id: string; moveTabs?: boolean; targetFolderId?: string }).id
            ) {
                let deleteFolderResponseSent = false;
                const deletePayload = message.payload as { id: string; moveTabs?: boolean; targetFolderId?: string };

                // First, get all tabs to check if the folder has any tabs
                getAllTabs()
                    .then(allTabs => {
                        const tabsInFolder = allTabs.filter(tab => tab.folderId === deletePayload.id);

                        if (tabsInFolder.length > 0) {
                            // Folder has tabs - check if we should move them or delete them
                            if (deletePayload.moveTabs) {
                                // Move tabs to another folder
                                const updatedTabs = tabsInFolder.map(tab => ({
                                    ...tab,
                                    folderId: deletePayload.targetFolderId || '',
                                }));

                                // Save updated tabs
                                return Promise.all(updatedTabs.map(tab => updateTab(tab)));
                            } else {
                                // Delete the tabs in the folder
                                return Promise.all(tabsInFolder.map(tab => deleteTab(tab.id)));
                            }
                        }
                    })
                    .then(() => {
                        // Now delete the folder itself
                        return deleteFolder(deletePayload.id);
                    })
                    .then(() => {
                        // Notify the side panel about the deletion
                        chrome.runtime
                            .sendMessage({
                                type: 'STORAGE_FOLDER_DELETED',
                                payload: { id: deletePayload.id },
                            })
                            .catch(() => {}); // Suppress errors if message listener is unavailable

                        if (!deleteFolderResponseSent) {
                            deleteFolderResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteFolderResponseSent) {
                            deleteFolderResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteFolderResponseSent) {
                        deleteFolderResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Delete folder timed out' });
                    }
                }, 2000);

                return true;
            }
            break;
    }

    return false;
}
