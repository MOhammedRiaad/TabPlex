/**
 * Shared date formatting utilities for the TabPlex extension.
 * These functions provide consistent date formatting across all features.
 */

/**
 * Format a date as a localized date string (e.g., "1/12/2026")
 * @param date - Date string, timestamp, or Date object
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(date: string | number | Date | undefined): string {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString();
    } catch {
        return '';
    }
}

/**
 * Format a date as a localized date and time string (e.g., "1/12/2026, 8:00:00 PM")
 * @param date - Date string, timestamp, or Date object
 * @returns Formatted date-time string or empty string if invalid
 */
export function formatDateTime(date: string | number | Date | undefined): string {
    if (!date) return '';
    try {
        return new Date(date).toLocaleString();
    } catch {
        return '';
    }
}

/**
 * Format a date as a localized time string (e.g., "8:00:00 PM")
 * @param date - Date string, timestamp, or Date object
 * @returns Formatted time string or empty string if invalid
 */
export function formatTime(date: string | number | Date | undefined): string {
    if (!date) return '';
    try {
        return new Date(date).toLocaleTimeString();
    } catch {
        return '';
    }
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago", "Yesterday")
 * @param date - Date string, timestamp, or Date object
 * @returns Relative time string or empty string if invalid
 */
export function formatRelative(date: string | number | Date | undefined): string {
    if (!date) return '';
    try {
        const now = new Date();
        const then = new Date(date);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return formatDate(date);
    } catch {
        return '';
    }
}

/**
 * Check if a date is today
 * @param date - Date string, timestamp, or Date object
 * @returns True if the date is today
 */
export function isToday(date: string | number | Date | undefined): boolean {
    if (!date) return false;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        return today.getTime() === checkDate.getTime();
    } catch {
        return false;
    }
}

/**
 * Get the start of a given day (midnight)
 * @param date - Date string, timestamp, or Date object
 * @returns Date object at midnight of that day
 */
export function getStartOfDay(date: string | number | Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}
