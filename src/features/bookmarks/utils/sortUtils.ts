/**
 * Bookmark sorting utilities
 * Handles sorting of bookmark trees by various criteria
 */

import { Bookmark } from '../../../types';

/**
 * Sort order options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Sort criteria options
 */
export type SortCriteria = 'name' | 'dateAdded' | 'default';

/**
 * Sort configuration
 */
export interface SortConfig {
    criteria: SortCriteria;
    order: SortOrder;
}

/**
 * Sort bookmarks by name (A-Z or Z-A)
 * @param bookmarks - Array of bookmarks to sort
 * @param order - Sort order ('asc' for A-Z, 'desc' for Z-A)
 * @returns Sorted array of bookmarks
 */
export function sortBookmarksByName(bookmarks: Bookmark[], order: SortOrder = 'asc'): Bookmark[] {
    const sorted = [...bookmarks].sort((a, b) => {
        const nameA = (a.title || '').toLowerCase().trim();
        const nameB = (b.title || '').toLowerCase().trim();

        if (nameA < nameB) return order === 'asc' ? -1 : 1;
        if (nameA > nameB) return order === 'asc' ? 1 : -1;
        return 0;
    });

    // Recursively sort children if they exist
    return sorted.map(bookmark => ({
        ...bookmark,
        children: bookmark.children ? sortBookmarksByName(bookmark.children, order) : undefined,
    }));
}

/**
 * Sort bookmarks by date added (newest first or oldest first)
 * @param bookmarks - Array of bookmarks to sort
 * @param order - Sort order ('desc' for newest first, 'asc' for oldest first)
 * @returns Sorted array of bookmarks
 */
export function sortBookmarksByDateAdded(bookmarks: Bookmark[], order: SortOrder = 'desc'): Bookmark[] {
    const sorted = [...bookmarks].sort((a, b) => {
        // Handle missing dates - items without dates go to the end
        const dateA = a.dateAdded || 0;
        const dateB = b.dateAdded || 0;

        // If both have dates, compare them
        if (dateA > 0 && dateB > 0) {
            return order === 'desc' ? dateB - dateA : dateA - dateB;
        }

        // If only one has a date, prioritize it
        if (dateA > 0 && dateB === 0) return -1;
        if (dateA === 0 && dateB > 0) return 1;

        // If neither has a date, maintain original order (or sort by name as fallback)
        if (dateA === 0 && dateB === 0) {
            const nameA = (a.title || '').toLowerCase();
            const nameB = (b.title || '').toLowerCase();
            return nameA.localeCompare(nameB);
        }

        return 0;
    });

    // Recursively sort children if they exist
    return sorted.map(bookmark => ({
        ...bookmark,
        children: bookmark.children ? sortBookmarksByDateAdded(bookmark.children, order) : undefined,
    }));
}

/**
 * Apply sorting to a bookmark tree based on sort configuration
 * Handles Chrome's bookmark tree structure recursively
 * @param bookmarks - Array of bookmarks to sort
 * @param config - Sort configuration
 * @returns Sorted array of bookmarks
 */
export function sortBookmarks(bookmarks: Bookmark[], config: SortConfig): Bookmark[] {
    if (config.criteria === 'default') {
        // Return original order (Chrome's default)
        return bookmarks;
    }

    // Handle Chrome's bookmark tree structure
    // Root node (id: "0") contains Bookmarks Bar (id: "1") and Other Bookmarks (id: "2")
    // We need to sort children of these folders, not the root itself
    if (bookmarks.length > 0 && bookmarks[0].id === '0') {
        // This is the root node - sort children of Bookmarks Bar and Other Bookmarks
        return bookmarks.map(bookmark => {
            if (bookmark.id === '0' && bookmark.children) {
                return {
                    ...bookmark,
                    children: bookmark.children.map(child => {
                        // Sort the children of Bookmarks Bar and Other Bookmarks recursively
                        if (child.children && child.children.length > 0) {
                            const sortedChildren =
                                config.criteria === 'name'
                                    ? sortBookmarksByName(child.children, config.order)
                                    : sortBookmarksByDateAdded(child.children, config.order);
                            return {
                                ...child,
                                children: sortedChildren,
                            };
                        }
                        return child;
                    }),
                };
            }
            return bookmark;
        });
    }

    // For regular bookmark arrays (not root structure), apply sorting recursively
    switch (config.criteria) {
        case 'name':
            return sortBookmarksByName(bookmarks, config.order);
        case 'dateAdded':
            return sortBookmarksByDateAdded(bookmarks, config.order);
        default:
            return bookmarks;
    }
}

/**
 * Get default sort configuration
 */
export function getDefaultSortConfig(): SortConfig {
    return {
        criteria: 'default',
        order: 'asc',
    };
}

/**
 * Load sort configuration from localStorage
 */
export function loadSortConfig(): SortConfig {
    try {
        const saved = localStorage.getItem('tabboard-bookmark-sort');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate the saved config
            if (parsed.criteria && ['name', 'dateAdded', 'default'].includes(parsed.criteria)) {
                if (parsed.order && ['asc', 'desc'].includes(parsed.order)) {
                    return parsed as SortConfig;
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load sort config:', error);
    }
    return getDefaultSortConfig();
}

/**
 * Save sort configuration to localStorage
 */
export function saveSortConfig(config: SortConfig): void {
    try {
        localStorage.setItem('tabboard-bookmark-sort', JSON.stringify(config));
    } catch (error) {
        console.warn('Failed to save sort config:', error);
    }
}
