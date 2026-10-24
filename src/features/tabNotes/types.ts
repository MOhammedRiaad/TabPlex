// Types for "Summarize open tabs into a note" (docs/specs/NOTE_FROM_TABS.md). Reading side only for now.

export type UnreadableReason = 'pdf' | 'asleep' | 'loading' | 'blocked-site';

/**
 * Why a page is a quick view although the model was asked for: a code only, never page text, URLs or error messages.
 * 'no-model' also covers a run whose model could not start.
 */
export type QuickReason = 'too-large' | 'timeout' | 'bad-output' | 'no-model' | 'failed';

export interface ReadableTab {
    id: number;
    windowId: number;
    title: string;
    /** tab.url (the committed URL, never pendingUrl) */
    url: string;
    favicon?: string;
    /** e.g. "https://developer.mozilla.org/*" */
    originPattern: string;
    readable: boolean;
    reason?: UnreadableReason;
    /** Tab id of an earlier listed tab with the same URL (fragment ignored) */
    duplicateOf?: number;
}

export interface PageBlock {
    kind: 'heading' | 'text';
    /** 1–6 for headings */
    level?: number;
    text: string;
}

export interface PageSnapshot {
    /** location.href when the page was read */
    href: string;
    /** document.contentType ('application/pdf' in the PDF viewer) */
    contentType: string;
    /** document.documentElement.lang, '' if none */
    lang: string;
    /** <meta name="description"> or og:description, '' if none */
    description: string;
    /** In document order */
    blocks: PageBlock[];
    /** Stopped at the character or element budget */
    truncated: boolean;
}

export type PageReadError = 'no-access' | 'closed' | 'changed' | 'pdf' | 'blocked' | 'empty' | 'timeout' | 'failed';

export interface PageSection {
    /** '' for text before the first h2/h3 */
    heading: string;
    /** Each at most PARAGRAPH_MAX_CHARS */
    paragraphs: string[];
}

export interface CleanPage {
    sections: PageSection[];
    description: string;
    /** Characters of paragraph text kept (headings are not counted against PAGE_TEXT_CHAR_LIMIT) */
    chars: number;
    truncated: boolean;
    /** lang is set and does not start with "en" */
    notEnglish: boolean;
}

/** One tab that was read. The only things a note can cite. */
export interface NoteSource {
    /** 1-based, in tab-strip order; the [n] in the note */
    ref: number;
    tabId: number;
    windowId: number;
    /** Captured when picked */
    title: string;
    /** Full URL, checked against the page that was read (§5.3) */
    url: string;
    /** 'quick' when the model was not used for this page (or failed) */
    mode: 'ai' | 'quick';
    /** Set only when mode is 'quick' because the model failed or could not start; a quick view the user chose has none */
    quickReason?: QuickReason;
    truncated: boolean;
    notEnglish: boolean;
}

/** One idea from one page. Attribution starts here: sourceRef is set by code, never by a model. */
export interface KeyPoint {
    /** "p3-2": source 3, point 2 */
    id: string;
    sourceRef: number;
    /** Plain text, at most POINT_MAX_CHARS */
    text: string;
    /** AI topic tag, or the section heading in a quick view; '' if none */
    topicHint: string;
}

/** One line of a topic: text plus the points it is made of. Its sources are always sourcesOf(pointIds, points). */
export interface TopicBullet {
    /** Run-local counter, "b1" */
    id: string;
    text: string;
    /** At least one. The bullet's sources are derived from these */
    pointIds: string[];
    /** 'point': text is pointIds[0]'s own text. 'ai': reworded from all its points */
    origin: 'point' | 'ai';
    edited: boolean;
}

/** Points from two or more sources that give different numbers. Shown, never merged (spec §7.7). */
export interface TopicConflict {
    /** At least two points from at least two sources */
    pointIds: string[];
    /** The model's one-line description; '' when found by code */
    text: string;
}

/** Why a shared topic kept its word grouping after the combine call (see Topic.combineNote) */
export type CombineNote = 'timeout' | 'too-large' | 'unusable';

export interface Topic {
    /** Run-local counter, "t1" */
    id: string;
    heading: string;
    /** shared: points from two or more sources. source: one tab's own section */
    kind: 'shared' | 'source';
    /** kind === 'source' */
    sourceRef?: number;
    /** null for kind === 'source' */
    combinedBy: 'ai' | 'words' | null;
    /**
     * Set on a shared topic whose combine call failed (or was too slow, or too large): why it stays as its word grouping.
     * A code only, never page text or the error message. Absent when the topic was not combined by choice or by success.
     */
    combineNote?: CombineNote;
    bullets: TopicBullet[];
    conflicts: TopicConflict[];
}

/**
 * The layouts a study note can have: 'byTab' (one section per tab) or 'combined' (shared topics, then the leftovers of
 * each tab). The builder switches on this value.
 */
export type StudyNoteView = 'combined' | 'byTab';

/** What a study note is built from. Everything the note writes comes from here and from source URLs. */
export interface StudyNoteDraft {
    view: StudyNoteView;
    /** Sorted by ref; only tabs that were read */
    sources: NoteSource[];
    /** Points of every source, grouped by sourceRef */
    points: KeyPoint[];
    /** The "combined" view (groupTopics). Empty when combining was skipped (§7.8). Filled by the store, not here. */
    combined?: Topic[];
    /** The "By tab" view: one 'source' topic per tab with all its points. Filled by the store, not here. */
    byTab?: Topic[];
}

/** Where one picked tab is in a run */
export type TabRunState = 'waiting' | 'reading' | 'read' | 'failed' | 'not-read';

export interface RunTab {
    /** 1-based position in the picked list (tab-strip order): the [n] this tab gets when it is read */
    ref: number;
    /** Captured when picked; snapshotTab checks its URL against the page */
    tab: ReadableTab;
    state: TabRunState;
    /** The user-facing reason, for 'failed' only */
    message: string;
}
