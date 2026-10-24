// Limits, thresholds and word lists for "Summarize open tabs into a note". Pure data, safe to import anywhere in the UI.

/** Characters readPage collects from one page (the function receives this as an argument) */
export const PAGE_READ_CHAR_CAP = 60_000;
/** Elements readPage visits before it stops */
export const PAGE_READ_ELEMENT_CAP = 5_000;
/** How long a page read may take before the tab fails with "timeout" */
export const PAGE_READ_TIMEOUT_MS = 5_000;

/** Longer paragraphs are split at sentence ends */
export const PARAGRAPH_MAX_CHARS = 2_000;
/** Page text kept for one tab, counted from the start of the page */
export const PAGE_TEXT_CHAR_LIMIT = 12_000;
/** Less cleaned text than this and the tab cannot be summarized */
export const MIN_PAGE_CHARS = 200;
/** Text blocks shorter than this are menus, buttons and labels */
export const MIN_BLOCK_CHARS = 20;

/** Longest text a boilerplate phrase can be in and still be dropped (a long paragraph may mention cookies) */
export const BOILERPLATE_MAX_CHARS = 200;

/** Cookie, consent, newsletter and sign-in prompts (matched in lower case) */
export const BOILERPLATE_PHRASES: readonly string[] = [
    'accept all cookies',
    'accept cookies',
    'cookie settings',
    'cookie policy',
    'manage cookies',
    'we use cookies',
    'this site uses cookies',
    'your privacy choices',
    'subscribe to our newsletter',
    'sign up for our newsletter',
    'sign in to continue',
    'log in to continue',
];

/** Store pages extensions cannot read; `pathPrefix` narrows a host that also serves other pages */
export const STORE_PAGES: readonly { host: string; pathPrefix?: string }[] = [
    { host: 'chromewebstore.google.com' },
    { host: 'chrome.google.com', pathPrefix: '/webstore' },
    { host: 'microsoftedge.microsoft.com', pathPrefix: '/addons' },
];

/** Longest description readPage returns and isPageSnapshot accepts (readPage repeats this number: it is serialized) */
export const PAGE_DESCRIPTION_MAX_CHARS = 1_000;
/** Longest URL accepted from a page */
export const PAGE_URL_MAX_CHARS = 8_192;
/** Longest lang or content type accepted from a page */
export const PAGE_FIELD_MAX_CHARS = 200;
