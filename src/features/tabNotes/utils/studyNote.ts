// The study note's Markdown (spec §10). Pure: the store creates the note from it and the tests render it through both
// Markdown renderers. Only the links written here, from source URLs, can exist in the note. Page and model text goes
// through safeInline first, so it can't become a heading, a list, a quote or a link.
import { LONG_PAGE_LABEL, NOT_ENGLISH_LABEL, NO_POINTS_LINE, QUICK_VIEW_LABEL, STUDY_NOTE_TITLE } from '../constants';
import { NoteSource, StudyNoteDraft } from '../types';

export interface StudyNoteOptions {
    /** The note's title as the user left it; '' or missing gives the default */
    title?: string;
    /** Used for the default title */
    date: Date;
}

/** Block markers at the start of a line, repeated: "# ", "> ", "- ", "* ", "+ ", "1. ", "---" */
const BLOCK_MARK = /^(?:#{1,6}(?=\s|$)|>|[-*+](?=\s|$)|\d{1,3}[.)](?=\s|$)|(?:-{3,}|\*{3,}|_{3,})$)\s*/;
/** Characters that would end or change a link in either renderer, percent-encoded (spec §10.2) */
const LINK_UNSAFE = /[()[\]_*~`]/g;

/**
 * Makes model or page text safe for one line of the note: link syntax keeps its label, brackets become parentheses,
 * line breaks become spaces and leading block markers are removed. Numbers ("-5", "1.5") and emphasis are kept.
 */
export function safeInline(text: string): string {
    let out = text.replace(/\s+/g, ' ');
    let previous: string;
    do {
        previous = out;
        // Inline links `![label](url)` and reference links `[label][ref]`: kept as their label
        out = out.replace(/!?\[([^[\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^[\]]*)\]\[[^[\]]*\]/g, '$1');
    } while (out !== previous);
    out = out.replace(/\[/g, '(').replace(/\]/g, ')');
    while (BLOCK_MARK.test(out)) out = out.replace(BLOCK_MARK, '');
    return out.trim();
}

/**
 * The URL as a link destination for the note: http and https only (anything else gives null, so the title is plain
 * text). Percent-encodes the characters both renderers treat as Markdown (spec §10.2).
 */
export function linkUrl(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    // Credentials never go into a saved link; the host is left as is (an encoded "_" would make it invalid)
    parsed.username = '';
    parsed.password = '';
    const rest = parsed.href.slice(parsed.origin.length);
    return parsed.origin + rest.replace(LINK_UNSAFE, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The host for display ("developer.mozilla.org"), '' when the URL can't be parsed */
export function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/[^A-Za-z0-9.:-]/g, '');
    } catch {
        return '';
    }
}

/** Default title: "Study notes · 24 Oct 2026" */
export function defaultStudyNoteTitle(date: Date): string {
    const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    return `${STUDY_NOTE_TITLE} · ${day}`;
}

/** The title written in the note and saved with it: the user's text (made safe) or the default */
export function resolveStudyNoteTitle(title: string | undefined, date: Date): string {
    return safeInline(title ?? '') || defaultStudyNoteTitle(date);
}

/** The text of a source in headings and the Sources list */
function labelOf(source: NoteSource): string {
    return safeInline(source.title) || hostOf(source.url) || 'Untitled page';
}

function disclaimerFor(sources: NoteSource[]): string {
    const count = `${sources.length} ${sources.length === 1 ? 'tab' : 'tabs'}`;
    if (sources.some(source => source.mode === 'ai')) {
        return `_From ${count}, summarized by your browser's built-in AI on this device. It can be wrong: check the sources before relying on it._`;
    }
    return `_Quick view of ${count}: sentences taken from the pages, without AI. Check the sources for the full picture._`;
}

/** "## Title ([n](url))" then one bullet per point. The heading carries the only reference of its section. */
function sectionFor(source: NoteSource, draft: StudyNoteDraft): string {
    const label = labelOf(source);
    const href = linkUrl(source.url);
    const heading = href ? `## ${label} ([${source.ref}](${href}))` : `## ${label}`;
    const bullets = draft.points
        .filter(point => point.sourceRef === source.ref)
        .map(point => safeInline(point.text))
        .filter(text => text !== '')
        .map(text => `- ${text}`);
    return [heading, bullets.length > 0 ? bullets.join('\n') : `_${NO_POINTS_LINE}_`].join('\n\n');
}

/** "- [n] [Title](url) · host · quick view" */
function sourceLine(source: NoteSource): string {
    const label = labelOf(source);
    const href = linkUrl(source.url);
    const parts = [`[${source.ref}] ${href ? `[${label}](${href})` : label}`];
    const host = hostOf(source.url);
    if (host) parts.push(host);
    if (source.mode === 'quick') parts.push(QUICK_VIEW_LABEL);
    if (source.truncated) parts.push(LONG_PAGE_LABEL);
    if (source.notEnglish) parts.push(NOT_ENGLISH_LABEL);
    return `- ${parts.join(' · ')}`;
}

function bodyOf(draft: StudyNoteDraft): string[] {
    switch (draft.view) {
        case 'byTab': {
            const sources = [...draft.sources].sort((a, b) => a.ref - b.ref);
            const blocks = [disclaimerFor(sources)];
            for (const source of sources) blocks.push(sectionFor(source, draft));
            if (sources.length > 0) blocks.push(`## Sources\n\n${sources.map(sourceLine).join('\n')}`);
            return blocks;
        }
    }
}

/**
 * The note's Markdown for a draft: the title as H1, a disclaimer, one section per source (By tab), then the Sources
 * list. Sources are only the ones in the draft: failed and removed tabs are left out by the caller.
 */
export function buildStudyNote(draft: StudyNoteDraft, options: StudyNoteOptions): string {
    const title = resolveStudyNoteTitle(options.title, options.date);
    return [`# ${title}`, ...bodyOf(draft)].join('\n\n');
}
