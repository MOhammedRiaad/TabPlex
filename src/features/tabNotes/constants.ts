// Limits, thresholds and word lists for "Summarize open tabs into a note". Pure data, safe to import anywhere in the UI.
import type { CombineNote, QuickReason } from './types';

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
export const POINT_MAX_CHARS = 480;
/** Shorter points are dropped: menus and fragments */
export const POINT_MIN_CHARS = 15;
/** Longest topic tag or section heading kept as a point's topicHint */
export const TOPIC_HINT_MAX_CHARS = 60;
/** Most points the model may return for one page (the schema's maxItems) */
export const POINTS_PER_SOURCE_MAX = 6;
/** Share of a point's words that must appear in its page (grounding, §7.2) */
export const GROUNDING_MIN = 0.6;
/** Per-page model step: covers both attempts of promptJson */
export const TAB_POINTS_TIMEOUT_MS = 150_000;

/**
 * A point that ends on one of these words was cut off by the model ("…from superclasses, forming an"). English and
 * Portuguese articles, prepositions and conjunctions: no sentence ends on them.
 */
export const DANGLING_WORDS: ReadonlySet<string> = new Set([
    'a',
    'an',
    'the',
    'of',
    'and',
    'or',
    'to',
    'in',
    'on',
    'for',
    'with',
    'by',
    'as',
    'at',
    'from',
    'into',
    'that',
    'which',
    'than',
    'but',
    'its',
    'their',
    'is',
    'are',
    'o',
    'os',
    'um',
    'uma',
    'de',
    'da',
    'do',
    'das',
    'dos',
    'e',
    'em',
    'no',
    'na',
    'para',
    'por',
    'com',
    'que',
    'ou',
]);

/** Common English function words: a page in English has plenty of them, a page in another language almost none */
export const ENGLISH_MARKERS: ReadonlySet<string> = new Set([
    'the',
    'of',
    'and',
    'to',
    'in',
    'is',
    'that',
    'for',
    'with',
    'are',
    'this',
    'be',
    'by',
    'or',
    'on',
    'it',
    'was',
    'can',
    'which',
]);
/** Words looked at, and the share of them that must be English markers before a page is called English */
export const LANGUAGE_SAMPLE_WORDS = 400;
export const LANGUAGE_MIN_WORDS = 60;
export const ENGLISH_MARKER_MIN_SHARE = 0.05;
/** One point's language (pointLanguage): fewer words than this is 'unknown' */
export const POINT_LANGUAGE_MIN_WORDS = 6;
/** A point with at least this share of English marker words is 'en' */
export const POINT_ENGLISH_MIN_SHARE = 0.12;
/** A point with fewer than this share of English marker words, and POINT_OTHER_MIN_WORDS words, is 'other' */
export const POINT_OTHER_MAX_SHARE = 0.04;
export const POINT_OTHER_MIN_WORDS = 8;

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

/**
 * Word grouping (§7.3): average similarity a merge needs (cosine, plus SAME_TOPIC_BONUS for the same topic name).
 * Tuned on the fixture corpora: the quick view's DNS pages (E2E pages) merge up to 0.214 and not at 0.215, so a
 * round value a little under that edge is used. The DNS, OOP (untagged and tagged) and E2E corpora give the same
 * result from 0.21 up to 0.214 and have no false merges there; below about 0.205 an extra OOP topic appears.
 */
export const TOPIC_SIMILARITY = 0.21;
/** Word grouping: added to the similarity of two points whose topic names are the same (capped at 1) */
export const SAME_TOPIC_BONUS = 0.3;
/** Word grouping: the same-topic bonus only applies when the two points' own cosine is at least this (a name alone never joins unrelated points) */
export const TAG_MIN_COSINE = 0.05;
/** Word grouping: most points in one topic */
export const MAX_POINTS_PER_TOPIC = 12;
/** Word grouping: most shared topics in one note; the rest are dissolved into their sources' sections */
export const MAX_SHARED_TOPICS = 8;
/** Near-duplicate bullets (§7.3): cosine of the two points, with identical numbers */
export const DUPLICATE_COSINE = 0.8;
/** Near-duplicate bullets (§7.3): word-shingle Jaccard of the two points, with identical numbers */
export const DUPLICATE_SHINGLE = 0.5;
/** Disagreements (§7.7): cosine from which two points with different numbers are a conflict */
export const CONFLICT_SIMILARITY = 0.6;
/** Word shingles compared by shingleJaccard */
export const SHINGLE_SIZE = 3;
/** Longest topic heading (§7.8), cut on a word boundary */
export const TOPIC_HEADING_MAX_CHARS = 60;

/** Topic names (§7.4): fewer distinct tags, or fewer sources, and the model is not asked to group the tags */
export const TOPIC_NAMES_MIN_TAGS = 3;
export const TOPIC_NAMES_MIN_SOURCES = 2;
/** A group of tags needs at least this many members to be named */
export const NAME_GROUP_MIN_MEMBERS = 2;
/** A group of tags with more members than this is ignored: a small model merges whole subjects into one group */
export const NAME_GROUP_MAX_MEMBERS = 4;
/** Time limit of the topic-names call (one short call) */
export const TOPICS_TIMEOUT_MS = 60_000;
/** Longest canonical topic name (§7.4), cut on a word boundary */
export const TOPIC_NAME_MAX_CHARS = 40;
/** Combining (§7.5): a shared topic needs this many points before the model is asked */
export const COMBINE_MIN_POINTS = 2;
/** Most points of one topic sent to the model (in point order); the rest stay their own bullets */
export const COMBINE_MAX_POINTS = 8;
/** Time limit of one combine call (a topic with descriptive points on a long page takes longer than 45 s) */
export const COMBINE_TIMEOUT_MS = 90_000;
/** Citation check (§7.6 rule 3): share of a statement's words found in one cited point plus the topic heading */
export const CITE_MIN = 0.3;
/** Conflict text (§7.6 rule 9): share of its words found in the points it cites, else the text is dropped */
export const CONFLICT_TEXT_MIN = 0.5;
/**
 * Same subject (second round, tuned on the DNS and OOP corpora): two points from different sources whose leading
 * content term is the same word get this bonus to their similarity. A bonus only: it never merges by itself. Started
 * at 0.15; 0.25 because the OOP "Encapsulation" pair has a cosine of 0.09 (0.09 + 0.15 is still below TOPIC_SIMILARITY).
 */
export const SAME_SUBJECT_BONUS = 0.25;
/** The leading term must have at least this many letters ("cache", "class", "CPU" are too generic to count) */
export const SAME_SUBJECT_MIN_LETTERS = 6;
/** The leading term counts only when it appears in fewer than this share of the points of the run */
export const SAME_SUBJECT_MAX_SHARE = 0.5;
/** Headings (no hints): most terms used, and how many sources a heading term must appear in */
export const HEADING_TERM_COUNT = 2;
export const HEADING_TERM_MIN_SOURCES = 2;
/** Verbs and filler words that never name a topic in a heading (compared after stemming) */
export const HEADING_FILLERS: readonly string[] = [
    'allow',
    'allows',
    'provide',
    'provides',
    'define',
    'defines',
    'defined',
    'mean',
    'means',
    'use',
    'uses',
    'using',
    'let',
    'lets',
    'include',
    'includes',
    'contain',
    'contains',
    'make',
    'makes',
    'represent',
    'represents',
    'help',
    'helps',
    'become',
    'becomes',
    'behave',
    'behaves',
    'create',
    'creates',
    'give',
    'gives',
    'take',
    'takes',
    'show',
    'shows',
    'based',
    'way',
    'ways',
    'example',
    'examples',
    'thing',
    'things',
    'part',
    'parts',
];

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

/** Title of a study note when the user gives none (the date is added) */
export const STUDY_NOTE_TITLE = 'Study notes';
/** Plain-text labels in the note's Sources list (spec §10.1, §13) */
export const QUICK_VIEW_LABEL = 'quick view';
/** Why a quick view happened, in words: shown next to the quick view tag and after it in the Sources list */
const QUICK_REASON_TEXT: Record<QuickReason, string> = {
    'too-large': 'page too long for the model',
    timeout: 'the model took too long',
    'bad-output': "the model's answer was unusable",
    'no-model': "the model isn't available",
    failed: 'the model failed',
};
export const quickReasonText = (reason: QuickReason): string => QUICK_REASON_TEXT[reason];
/** Why a topic was left as its word grouping after the combine call (Topic.combineNote), in the same style */
const COMBINE_NOTE_TEXT: Record<CombineNote, string> = {
    timeout: 'the model took too long',
    'too-large': 'too many points for the model',
    unusable: "the model's answer was unusable",
};
export const combineNoteText = (note: CombineNote): string => COMBINE_NOTE_TEXT[note];
export const LONG_PAGE_LABEL = 'first part of a long page';
export const NOT_ENGLISH_LABEL = 'Not in English: points may be weaker';
/** A section for a read page that produced no points */
export const NO_POINTS_LINE = 'No key points could be taken from this page.';
/** Shown for a tab the user cancelled before it was reached (not a failure) */
export const NOT_READ_MESSAGE = 'Not read (cancelled)';
