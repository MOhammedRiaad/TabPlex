/**
 * Date formatting utilities for bookmarks
 * Formats Chrome timestamp (milliseconds since epoch) to human-readable dates
 */

/**
 * Format a Chrome timestamp to a relative time string (e.g., "2 days ago", "Just now")
 * @param timestamp - Chrome timestamp in milliseconds
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    if (weeks < 4) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Format a Chrome timestamp to DD-MM-YYYY format
 * @param timestamp - Chrome timestamp in milliseconds
 * @returns Formatted date string in DD-MM-YYYY format
 */
export function formatDate(timestamp?: number): string {
    if (!timestamp) return '';

    try {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    } catch {
        return '';
    }
}

/**
 * Format a Chrome timestamp to a full date-time string
 * @param timestamp - Chrome timestamp in milliseconds
 * @returns Full date-time string
 */
export function formatDateTime(timestamp?: number): string {
    if (!timestamp) return '';

    try {
        return new Date(timestamp).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}
