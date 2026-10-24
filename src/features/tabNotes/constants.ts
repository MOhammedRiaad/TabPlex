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

/** Longest key point text (cut on a word boundary with an ellipsis) */
export const POINT_MAX_CHARS = 240;
/** Shorter points are dropped: menus and fragments */
export const POINT_MIN_CHARS = 15;
/** Longest topic tag or section heading kept as a point's topicHint */
export const TOPIC_HINT_MAX_CHARS = 60;
/** Most points the model may return for one page (the schema's maxItems) */
export const POINTS_PER_SOURCE_MAX = 6;
/** Share of a point's words that must appear in its page (grounding, §7.2) */
export const GROUNDING_MIN = 0.6;
/** Per-page model step: covers both attempts of promptJson */
export const TAB_POINTS_TIMEOUT_MS = 90_000;

/** Quick view: points per page */
export const QUICK_POINTS_PER_SOURCE = 5;
/** Quick view: at most this many points from one section */
export const QUICK_MAX_POINTS_PER_SECTION = 2;
/** Quick view: sentences outside this range are not candidates */
export const QUICK_SENTENCE_MIN_CHARS = 40;
export const QUICK_SENTENCE_MAX_CHARS = 300;
/** Quick view: share of letters a sentence needs (skips code and number tables) */
export const QUICK_MIN_LETTER_RATIO = 0.6;
/** Quick view: the page description is a point when it is at least this long */
export const QUICK_DESCRIPTION_MIN_CHARS = 40;
/** Quick view: added to the score of the first sentence of a section */
export const QUICK_SECTION_START_BONUS = 0.1;

/** Headings that say nothing about the content; they are not used as a topic hint */
export const GENERIC_HEADINGS: readonly string[] = [
    'introduction',
    'intro',
    'overview',
    'comments',
    'related',
    'menu',
    'contents',
    'table of contents',
    'navigation',
    'see also',
    'further reading',
];

/** Words that carry no topic in English or on web pages (lower case, before stemming) */
export const STOPWORDS: ReadonlySet<string> = new Set([
    'a',
    'about',
    'above',
    'after',
    'again',
    'against',
    'all',
    'also',
    'am',
    'an',
    'and',
    'any',
    'are',
    'as',
    'at',
    'be',
    'because',
    'been',
    'before',
    'being',
    'below',
    'between',
    'both',
    'but',
    'by',
    'can',
    'could',
    'did',
    'do',
    'does',
    'doing',
    'down',
    'during',
    'each',
    'either',
    'else',
    'even',
    'ever',
    'every',
    'few',
    'for',
    'from',
    'further',
    'had',
    'has',
    'have',
    'having',
    'he',
    'her',
    'here',
    'hers',
    'herself',
    'him',
    'himself',
    'his',
    'how',
    'however',
    'if',
    'in',
    'into',
    'is',
    'it',
    'its',
    'itself',
    'just',
    'may',
    'might',
    'more',
    'most',
    'much',
    'must',
    'my',
    'myself',
    'neither',
    'no',
    'nor',
    'not',
    'now',
    'of',
    'off',
    'often',
    'on',
    'once',
    'only',
    'or',
    'other',
    'our',
    'ours',
    'ourselves',
    'out',
    'over',
    'own',
    'same',
    'she',
    'should',
    'so',
    'some',
    'such',
    'than',
    'that',
    'the',
    'their',
    'theirs',
    'them',
    'themselves',
    'then',
    'there',
    'these',
    'they',
    'this',
    'those',
    'through',
    'to',
    'too',
    'under',
    'until',
    'up',
    'upon',
    'us',
    'very',
    'was',
    'we',
    'were',
    'what',
    'when',
    'where',
    'whether',
    'which',
    'while',
    'who',
    'whom',
    'whose',
    'why',
    'will',
    'with',
    'within',
    'without',
    'would',
    'yet',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves',
    'one',
    'two',
    'way',
    'use',
    'used',
    'using',
    'make',
    'made',
    'get',
    'got',
    'like',
    'see',
    'new',
    'many',
    'well',
    'able',
    'thing',
    'things',
    'something',
    'anything',
    'everything',
    // Web page words
    'click',
    'read',
    'share',
    'home',
    'menu',
    'skip',
    'next',
    'previous',
    'print',
    'email',
    'subscribe',
    'reply',
    'login',
    'signup',
    'comment',
    'comments',
]);
