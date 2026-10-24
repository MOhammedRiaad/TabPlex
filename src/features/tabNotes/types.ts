// Types for "Summarize open tabs into a note" (docs/specs/NOTE_FROM_TABS.md). Reading side only for now.

export type UnreadableReason = 'pdf' | 'asleep' | 'loading' | 'blocked-site';

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
