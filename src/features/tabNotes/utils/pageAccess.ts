// Optional host access for reading tabs (spec §5.2). Only the origins of the picked tabs are ever requested.

/** "https://developer.mozilla.org/*" for a page URL. Scheme and host only: a pattern without a port matches any port. */
export function originPatternFor(url: string): string {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/*`;
}

/** The patterns TabPlex does not hold yet, in the order given */
export async function missingOrigins(patterns: string[]): Promise<string[]> {
    const unique = [...new Set(patterns)];
    const granted = await Promise.all(unique.map(origin => chrome.permissions.contains({ origins: [origin] })));
    return unique.filter((_origin, index) => !granted[index]);
}

/**
 * Asks the user for access to the given origins. Must be the first call in a click handler (no await before it),
 * because Chrome only shows the prompt from a user gesture. Resolves false when the user says no.
 */
export function requestAccess(patterns: string[]): Promise<boolean> {
    return chrome.permissions.request({ origins: patterns });
}

export async function grantedOrigins(): Promise<string[]> {
    const { origins } = await chrome.permissions.getAll();
    return origins ?? [];
}

/** Removes every origin TabPlex holds. Safe: all host access TabPlex has is optional. */
export async function revokeAllPageAccess(): Promise<void> {
    const origins = await grantedOrigins();
    if (origins.length === 0) return;
    await chrome.permissions.remove({ origins });
}
