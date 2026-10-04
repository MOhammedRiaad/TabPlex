/**
 * Favicon for a page, served by Chrome itself from its local favicon cache (MV3 `_favicon` API,
 * needs the "favicon" permission). Replaces Google's s2/favicons service, which sent every
 * visited domain to Google and contradicted the "no network transmission" privacy policy.
 * Returns null for URLs Chrome can't have a favicon for.
 */
export function getFaviconUrl(pageUrl: string | undefined, size = 32): string | null {
    if (!pageUrl) return null;
    try {
        const { protocol } = new URL(pageUrl);
        if (protocol !== 'http:' && protocol !== 'https:') return null;
    } catch {
        return null;
    }
    const query = `pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
    return chrome.runtime.getURL(`/_favicon/?${query}`);
}
