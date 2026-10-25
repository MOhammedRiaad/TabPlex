import { respondWith } from './respond';
import { ExtensionMessage, Bookmark, BookmarkTreeNode } from '../types';

// Transform Chrome bookmark node to our Bookmark format
function transformBookmarkNode(node: BookmarkTreeNode, parentId?: string): Bookmark {
    return {
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: parentId || node.parentId,
        index: node.index,
        dateAdded: node.dateAdded,
        dateGroupModified: node.dateGroupModified,
        children: node.children?.map(child => transformBookmarkNode(child, node.id)),
    };
}

const idOf = (message: ExtensionMessage) => (message.payload as { id?: string } | undefined)?.id;

// Handle bookmark-related messages
export function handleBookmarkMessage(message: ExtensionMessage, sendResponse: (response: unknown) => void) {
    switch (message.type) {
        case 'GET_BOOKMARKS':
            // Get all bookmarks tree
            return respondWith(chrome.bookmarks.getTree(), sendResponse, {
                timeoutMs: 3000,
                timeoutError: 'Timeout getting bookmarks',
                map: tree => tree.map(node => transformBookmarkNode(node)),
            });

        case 'GET_BOOKMARK': {
            // Get a specific bookmark
            const id = idOf(message);
            if (id) {
                return respondWith(
                    chrome.bookmarks.get([id]).then(bookmarks => {
                        if (bookmarks.length === 0) throw new Error('Bookmark not found');
                        return transformBookmarkNode(bookmarks[0]);
                    }),
                    sendResponse,
                    { timeoutMs: 1000, timeoutError: 'Timed out', map: bookmark => bookmark }
                );
            }
            break;
        }

        case 'CREATE_BOOKMARK':
            // Create a new bookmark
            if (message.payload) {
                const payload = message.payload as { title: string; url?: string; parentId?: string; index?: number };
                return respondWith(
                    chrome.bookmarks.create({
                        title: payload.title,
                        url: payload.url,
                        parentId: payload.parentId,
                        index: payload.index,
                    }),
                    sendResponse,
                    { timeoutMs: 2000, timeoutError: 'Timeout creating bookmark', map: transformBookmarkNode }
                );
            }
            break;

        case 'CREATE_BOOKMARK_FOLDER':
            // Create a new bookmark folder
            if (message.payload) {
                const payload = message.payload as { title: string; parentId?: string; index?: number };
                return respondWith(
                    chrome.bookmarks.create({ title: payload.title, parentId: payload.parentId }),
                    sendResponse,
                    { timeoutMs: 2000, timeoutError: 'Timeout creating bookmark folder', map: transformBookmarkNode }
                );
            }
            break;

        case 'UPDATE_BOOKMARK':
            // Update a bookmark
            if (message.payload) {
                const payload = message.payload as { id: string; changes: { title?: string; url?: string } };
                return respondWith(chrome.bookmarks.update(payload.id, payload.changes), sendResponse, {
                    timeoutMs: 2000,
                    timeoutError: 'Timeout updating bookmark',
                    map: transformBookmarkNode,
                });
            }
            break;

        case 'MOVE_BOOKMARK':
            // Move a bookmark to a different folder
            if (message.payload) {
                const payload = message.payload as { id: string; destination: { parentId?: string; index?: number } };
                return respondWith(chrome.bookmarks.move(payload.id, payload.destination), sendResponse, {
                    timeoutMs: 2000,
                    timeoutError: 'Timeout moving bookmark',
                    map: transformBookmarkNode,
                });
            }
            break;

        case 'DELETE_BOOKMARK': {
            // Delete a bookmark
            const id = idOf(message);
            if (id) {
                return respondWith(chrome.bookmarks.remove(id), sendResponse, {
                    timeoutMs: 2000,
                    timeoutError: 'Timeout deleting bookmark',
                });
            }
            break;
        }

        case 'DELETE_BOOKMARK_TREE': {
            // Delete a bookmark tree (folder and all children)
            const id = idOf(message);
            if (id) {
                return respondWith(chrome.bookmarks.removeTree(id), sendResponse, {
                    timeoutMs: 3000,
                    timeoutError: 'Timeout deleting bookmark tree',
                });
            }
            break;
        }

        case 'SEARCH_BOOKMARKS':
            // Search bookmarks
            if ((message.payload as { query?: string } | undefined)?.query) {
                const query = (message.payload as { query: string }).query;
                return respondWith(chrome.bookmarks.search(query), sendResponse, {
                    timeoutMs: 3000,
                    timeoutError: 'Timeout searching bookmarks',
                    map: nodes => nodes.map(node => transformBookmarkNode(node)),
                });
            }
            break;

        case 'GET_BOOKMARK_CHILDREN': {
            // Get children of a bookmark folder
            const id = idOf(message);
            if (id) {
                return respondWith(chrome.bookmarks.getChildren(id), sendResponse, {
                    timeoutMs: 2000,
                    timeoutError: 'Timeout getting bookmark children',
                    map: children => children.map(node => transformBookmarkNode(node, id)),
                });
            }
            break;
        }
    }

    return false;
}
