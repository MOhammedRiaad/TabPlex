// Shared validation for the tab / bookmark / folder forms

/** Error message for a required text field, or undefined when valid */
export function validateRequiredText(value: string, label: string, maxLength: number): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return `${label} is required`;
    if (trimmed.length > maxLength) return `${label} must be ${maxLength} characters or less`;
    return undefined;
}

/**
 * Error message for a URL field, or undefined when valid. Accepts http(s) and file URLs, and bare
 * hosts like "example.com" (see normalizeUrl).
 */
export function validateUrl(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return 'URL is required';
    try {
        const { protocol } = new URL(trimmed);
        if (!protocol.startsWith('http') && !protocol.startsWith('file')) {
            return 'URL must start with http://, https://, or file://';
        }
        return undefined;
    } catch {
        try {
            new URL(`https://${trimmed}`);
            return undefined;
        } catch {
            return 'Please enter a valid URL';
        }
    }
}

/** Add https:// to bare hosts ("example.com" → "https://example.com") */
export function normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    try {
        new URL(trimmed);
        return trimmed;
    } catch {
        return `https://${trimmed}`;
    }
}
