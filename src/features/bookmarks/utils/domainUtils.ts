/**
 * Domain extraction utilities for bookmarks
 * Handles URL parsing and domain extraction
 */

/**
 * Extract domain from a URL
 * @param url - URL string
 * @returns Domain string or empty string if invalid
 */
export function extractDomain(url?: string): string {
    if (!url || typeof url !== 'string') return '';

    // Trim whitespace
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return '';

    try {
        // Handle URLs without protocol
        let urlToParse = trimmedUrl;
        if (!urlToParse.includes('://')) {
            // Check if it starts with a valid domain pattern
            if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
                urlToParse = `https://${urlToParse}`;
            }
        }

        const urlObj = new URL(urlToParse);
        let hostname = urlObj.hostname;

        // Remove 'www.' prefix if present
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }

        // Validate hostname is not empty
        if (!hostname || hostname === '') {
            return '';
        }

        return hostname;
    } catch {
        // If URL parsing fails, try to extract domain manually
        try {
            // Remove protocol
            let domain = trimmedUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
            // Remove path, query, and fragment
            domain = domain.split('/')[0].split('?')[0].split('#')[0].trim();

            // Basic validation - should contain at least one dot or be a valid domain
            if (!domain || domain === '' || domain.includes(' ')) {
                return '';
            }

            return domain;
        } catch {
            return '';
        }
    }
}

/**
 * Get all unique domains from bookmarks
 * @param bookmarks - Array of bookmarks
 * @returns Array of unique domain strings
 */
export function getAllDomains(bookmarks: { url?: string }[]): string[] {
    const domains = new Set<string>();

    const traverse = (items: { url?: string; children?: { url?: string }[] }[]) => {
        items.forEach(item => {
            if (item.url) {
                const domain = extractDomain(item.url);
                if (domain) {
                    domains.add(domain);
                }
            }
            if (item.children && item.children.length > 0) {
                traverse(item.children);
            }
        });
    };

    traverse(bookmarks);
    return Array.from(domains).sort();
}
