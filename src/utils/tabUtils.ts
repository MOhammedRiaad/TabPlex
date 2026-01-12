/**
 * Shared tab utilities for the TabPlex extension.
 * These functions provide consistent tab creation across all features.
 */

import { Tab, HistoryItem } from '../types';

/**
 * Create a Tab object from a HistoryItem for adding to a folder.
 * This centralizes the conversion logic that was previously duplicated
 * in HistoryView, HistorySidePanel, and BoardView.
 *
 * @param historyItem - The history item to convert
 * @param folderId - The target folder ID
 * @returns A Tab object ready to be added to the store
 */
export function createTabFromHistoryItem(historyItem: HistoryItem, folderId: string): Omit<Tab, 'createdAt'> {
    return {
        id: `tab_${Date.now()}_${historyItem.id}`,
        title: historyItem.title,
        url: historyItem.url,
        favicon: historyItem.favicon,
        folderId,
        tabId: null, // Not an active browser tab
        lastAccessed: new Date().toISOString(),
        status: 'closed' as const, // Since it's from history
    };
}

/**
 * Generate a unique tab ID
 * @returns A unique string ID for a tab
 */
export function generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
