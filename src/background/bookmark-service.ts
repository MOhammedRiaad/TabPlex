import { ExtensionMessage, ExtensionResponse, Bookmark, BookmarkTreeNode } from '../types';

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

// Handle bookmark-related messages
export function handleBookmarkMessage(message: ExtensionMessage, _sendResponse: (response: ExtensionResponse) => void) {
    switch (message.type) {
        case 'GET_BOOKMARKS':
            // Get all bookmarks tree
            let bookmarksResponseSent = false;

            chrome.bookmarks
                .getTree()
                .then(bookmarkTree => {
                    if (!bookmarksResponseSent) {
                        bookmarksResponseSent = true;
                        // Transform the tree to our format
                        const transformed = bookmarkTree.map(node => transformBookmarkNode(node));
                        safeSendResponse(_sendResponse, transformed);
                    }
                })
                .catch((error: unknown) => {
                    if (!bookmarksResponseSent) {
                        bookmarksResponseSent = true;
                        safeSendResponse(_sendResponse, { error: (error as Error).message });
                    }
                });

            setTimeout(() => {
                if (!bookmarksResponseSent) {
                    bookmarksResponseSent = true;
                    safeSendResponse(_sendResponse, { error: 'Timeout getting bookmarks' });
                }
            }, 3000);

            return true;

        case 'GET_BOOKMARK':
            // Get a specific bookmark
            if (message.payload && (message.payload as { id: string }).id) {
                let getBookmarkResponseSent = false;
                const bookmarkId = (message.payload as { id: string }).id;

                chrome.bookmarks
                    .get([bookmarkId])
                    .then(bookmarks => {
                        if (!getBookmarkResponseSent) {
                            getBookmarkResponseSent = true;
                            if (bookmarks.length > 0) {
                                safeSendResponse(_sendResponse, transformBookmarkNode(bookmarks[0]));
                            } else {
                                safeSendResponse(_sendResponse, { error: 'Bookmark not found' });
                            }
                        }
                    })
                    .catch((error: unknown) => {
                        if (!getBookmarkResponseSent) {
                            getBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!getBookmarkResponseSent) {
                        getBookmarkResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timed out' });
                    }
                }, 1000);

                return true;
            }
            break;

        case 'CREATE_BOOKMARK':
            // Create a new bookmark
            if (message.payload) {
                let createBookmarkResponseSent = false;
                const payload = message.payload as { title: string; url?: string; parentId?: string; index?: number };

                chrome.bookmarks
                    .create({
                        title: payload.title,
                        url: payload.url,
                        parentId: payload.parentId,
                        index: payload.index,
                    })
                    .then(bookmark => {
                        if (!createBookmarkResponseSent) {
                            createBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, transformBookmarkNode(bookmark));
                        }
                    })
                    .catch((error: unknown) => {
                        if (!createBookmarkResponseSent) {
                            createBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!createBookmarkResponseSent) {
                        createBookmarkResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout creating bookmark' });
                    }
                }, 2000);

                return true;
            }
            break;

        case 'CREATE_BOOKMARK_FOLDER':
            // Create a new bookmark folder
            if (message.payload) {
                let createFolderResponseSent = false;
                const payload = message.payload as { title: string; parentId?: string; index?: number };

                chrome.bookmarks
                    .create({
                        title: payload.title,
                        parentId: payload.parentId,
                    })
                    .then(folder => {
                        if (!createFolderResponseSent) {
                            createFolderResponseSent = true;
                            safeSendResponse(_sendResponse, transformBookmarkNode(folder));
                        }
                    })
                    .catch((error: unknown) => {
                        if (!createFolderResponseSent) {
                            createFolderResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!createFolderResponseSent) {
                        createFolderResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout creating bookmark folder' });
                    }
                }, 2000);

                return true;
            }
            break;

        case 'UPDATE_BOOKMARK':
            // Update a bookmark
            if (message.payload) {
                let updateBookmarkResponseSent = false;
                const payload = message.payload as { id: string; changes: { title?: string; url?: string } };

                chrome.bookmarks
                    .update(payload.id, payload.changes)
                    .then(bookmark => {
                        if (!updateBookmarkResponseSent) {
                            updateBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, transformBookmarkNode(bookmark));
                        }
                    })
                    .catch((error: unknown) => {
                        if (!updateBookmarkResponseSent) {
                            updateBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!updateBookmarkResponseSent) {
                        updateBookmarkResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout updating bookmark' });
                    }
                }, 2000);

                return true;
            }
            break;

        case 'MOVE_BOOKMARK':
            // Move a bookmark to a different folder
            if (message.payload) {
                let moveBookmarkResponseSent = false;
                const payload = message.payload as { id: string; destination: { parentId?: string; index?: number } };

                chrome.bookmarks
                    .move(payload.id, payload.destination)
                    .then(bookmark => {
                        if (!moveBookmarkResponseSent) {
                            moveBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, transformBookmarkNode(bookmark));
                        }
                    })
                    .catch((error: unknown) => {
                        if (!moveBookmarkResponseSent) {
                            moveBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!moveBookmarkResponseSent) {
                        moveBookmarkResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout moving bookmark' });
                    }
                }, 2000);

                return true;
            }
            break;

        case 'DELETE_BOOKMARK':
            // Delete a bookmark
            if (message.payload && (message.payload as { id: string }).id) {
                let deleteBookmarkResponseSent = false;
                const bookmarkId = (message.payload as { id: string }).id;

                chrome.bookmarks
                    .remove(bookmarkId)
                    .then(() => {
                        if (!deleteBookmarkResponseSent) {
                            deleteBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteBookmarkResponseSent) {
                            deleteBookmarkResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteBookmarkResponseSent) {
                        deleteBookmarkResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout deleting bookmark' });
                    }
                }, 2000);

                return true;
            }
            break;

        case 'DELETE_BOOKMARK_TREE':
            // Delete a bookmark tree (folder and all children)
            if (message.payload && (message.payload as { id: string }).id) {
                let deleteTreeResponseSent = false;
                const bookmarkId = (message.payload as { id: string }).id;

                chrome.bookmarks
                    .removeTree(bookmarkId)
                    .then(() => {
                        if (!deleteTreeResponseSent) {
                            deleteTreeResponseSent = true;
                            safeSendResponse(_sendResponse, { success: true });
                        }
                    })
                    .catch((error: unknown) => {
                        if (!deleteTreeResponseSent) {
                            deleteTreeResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!deleteTreeResponseSent) {
                        deleteTreeResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout deleting bookmark tree' });
                    }
                }, 3000);

                return true;
            }
            break;

        case 'SEARCH_BOOKMARKS':
            // Search bookmarks
            if (message.payload && (message.payload as { query: string }).query) {
                let searchBookmarksResponseSent = false;
                const query = (message.payload as { query: string }).query;

                chrome.bookmarks
                    .search(query)
                    .then(bookmarks => {
                        if (!searchBookmarksResponseSent) {
                            searchBookmarksResponseSent = true;
                            const transformed = bookmarks.map(node => transformBookmarkNode(node));
                            safeSendResponse(_sendResponse, transformed);
                        }
                    })
                    .catch((error: unknown) => {
                        if (!searchBookmarksResponseSent) {
                            searchBookmarksResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!searchBookmarksResponseSent) {
                        searchBookmarksResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout searching bookmarks' });
                    }
                }, 3000);

                return true;
            }
            break;

        case 'GET_BOOKMARK_CHILDREN':
            // Get children of a bookmark folder
            if (message.payload && (message.payload as { id: string }).id) {
                let getChildrenResponseSent = false;
                const bookmarkId = (message.payload as { id: string }).id;

                chrome.bookmarks
                    .getChildren(bookmarkId)
                    .then(children => {
                        if (!getChildrenResponseSent) {
                            getChildrenResponseSent = true;
                            const transformed = children.map(node => transformBookmarkNode(node, bookmarkId));
                            safeSendResponse(_sendResponse, transformed);
                        }
                    })
                    .catch((error: unknown) => {
                        if (!getChildrenResponseSent) {
                            getChildrenResponseSent = true;
                            safeSendResponse(_sendResponse, { error: (error as Error).message });
                        }
                    });

                setTimeout(() => {
                    if (!getChildrenResponseSent) {
                        getChildrenResponseSent = true;
                        safeSendResponse(_sendResponse, { error: 'Timeout getting bookmark children' });
                    }
                }, 2000);

                return true;
            }
            break;
    }

    return false;
}
