/**
 * Shared date formatting utilities for the TabPlex extension.
 * These functions provide consistent date formatting across all features.
 */

type DateInput = string | number | Date | undefined;

/** Parse a date input; `null` when missing or invalid. `new Date('garbage')` doesn't throw, it is NaN. */
function toValidDate(date: DateInput): Date | null {
    if (date === undefined || date === null || date === '') return null;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date as a localized date string (e.g., "1/12/2026")
 * @param date - Date string, timestamp, or Date object
 * @returns Formatted date string or empty string if invalid
 */
export function formatDate(date: DateInput): string {
    return toValidDate(date)?.toLocaleDateString() ?? '';
}

/**
 * Format a date as a localized date and time string (e.g., "1/12/2026, 8:00:00 PM")
 * @param date - Date string, timestamp, or Date object
 * @returns Formatted date-time string or empty string if invalid
 */
export function formatDateTime(date: DateInput): string {
    return toValidDate(date)?.toLocaleString() ?? '';
}

/**
 * Format a date as a localized time string (e.g., "8:00:00 PM")
 * @param date - Date string, timestamp, or Date object
 * @returns Formatted time string or empty string if invalid
 */
export function formatTime(date: DateInput): string {
    return toValidDate(date)?.toLocaleTimeString() ?? '';
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago", "Yesterday")
 * @param date - Date string, timestamp, or Date object
 * @returns Relative time string or empty string if invalid
 */
export function formatRelative(date: DateInput): string {
    const then = toValidDate(date);
    if (!then) return '';
    const diffMs = Date.now() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(then);
}

/**
 * Check if a date is today
 * @param date - Date string, timestamp, or Date object
 * @returns True if the date is today
 */
export function isToday(date: DateInput): boolean {
    const check = toValidDate(date);
    if (!check) return false;
    return getStartOfDay(check).getTime() === getStartOfDay().getTime();
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
