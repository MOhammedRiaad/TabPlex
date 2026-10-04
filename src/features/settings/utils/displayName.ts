/** The name used in the Today greeting. Stored only in this browser (no Chrome identity permission). */
export const DISPLAY_NAME_KEY = 'tabplex_display_name';
export const DISPLAY_NAME_MAX = 40;

/** The saved name, whitespace-collapsed and trimmed ('' when none) */
export function readDisplayName(): string {
    try {
        return (localStorage.getItem(DISPLAY_NAME_KEY) ?? '').replace(/\s+/g, ' ').trim();
    } catch {
        return '';
    }
}

/** Save the name as typed (so spaces between words survive typing); a blank name removes it */
export function saveDisplayName(name: string): void {
    const value = name.slice(0, DISPLAY_NAME_MAX);
    try {
        if (value.trim()) localStorage.setItem(DISPLAY_NAME_KEY, value);
        else localStorage.removeItem(DISPLAY_NAME_KEY);
    } catch {
        // Storage unavailable: the greeting simply has no name
    }
}
