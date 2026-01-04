/**
 * Color utility functions for canvas
 */

/**
 * Convert hex color to RGBA
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${alpha})`;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Preset color palettes
 */
export const COLOR_PALETTES = {
    stroke: [
        '#1f2937', // Dark gray
        '#ef4444', // Red
        '#f59e0b', // Orange
        '#10b981', // Green
        '#3b82f6', // Blue
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#000000', // Black
    ],
    fill: [
        'transparent',
        '#fef3c7', // Light yellow
        '#fecaca', // Light red
        '#d1fae5', // Light green
        '#dbeafe', // Light blue
        '#e9d5ff', // Light purple
        '#fce7f3', // Light pink
        '#f3f4f6', // Light gray
    ],
};

/**
 * Get contrasting text color for background
 */
export function getContrastColor(hexColor: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    if (!result) return '#000000';

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Validate hex color
 */
export function isValidHexColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}
