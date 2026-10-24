// The study note's Markdown (spec §10). Pure: the store creates the note from it and the tests render it through both
// Markdown renderers. Only the links written here, from source URLs, can exist in the note. Page and model text goes
// through safeInline first, so it can't become a heading, a list, a quote or a link.
import { LONG_PAGE_LABEL, NOT_ENGLISH_LABEL, NO_POINTS_LINE, QUICK_VIEW_LABEL, STUDY_NOTE_TITLE } from '../constants';
import { NoteSource, StudyNoteDraft } from '../types';
import { sourcesOf } from './groupTopics';

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

/** "[n](url)": the reference to a source, from its own URL. Without a web URL the number stays plain text. */
function refOf(source: NoteSource): string {
    const href = linkUrl(source.url);
    return href ? `[${source.ref}](${href})` : `[${source.ref}]`;
}

const countOf = (sources: NoteSource[]) => `${sources.length} ${sources.length === 1 ? 'tab' : 'tabs'}`;

function disclaimerFor(sources: NoteSource[]): string {
    const count = countOf(sources);
    if (sources.some(source => source.mode === 'ai')) {
        return `_From ${count}, summarized by your browser's built-in AI on this device. It can be wrong: check the sources before relying on it._`;
    }
    return `_Quick view of ${count}: sentences taken from the pages, without AI. Check the sources for the full picture._`;
}

/** The Combined layout's disclaimer. Topics are always grouped by shared words here, never by a model. */
function combinedDisclaimerFor(sources: NoteSource[]): string {
    const count = countOf(sources);
    if (sources.some(source => source.mode === 'ai')) {
        return `_From ${count}, summarized by your browser's built-in AI on this device. Topics were grouped by shared words. It can be wrong: check the sources before relying on it._`;
    }
    return `_Quick view of ${count}: sentences taken from the pages and grouped by shared words, without AI. Check the sources for the full picture._`;
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

function sourcesSection(sources: NoteSource[]): string {
    return `## Sources\n\n${sources.map(sourceLine).join('\n')}`;
}

/**
 * The Combined layout (spec §10.1): one "## heading" per shared topic, each bullet with the references of its points,
 * "> Sources differ" lines for conflicts, then "## Only in one source" for the leftovers of each tab, then the Sources.
 * Every reference comes from sourcesOf(pointIds, points); the bullet text is the text the draft carries.
 */
function combinedBody(draft: StudyNoteDraft, sources: NoteSource[]): string[] {
    const sourceOf = new Map(sources.map(source => [source.ref, source]));
    const pointOf = new Map(draft.points.map(point => [point.id, point]));
    const topics = draft.combined ?? [];
    const blocks = [combinedDisclaimerFor(sources)];

    const shared = topics.filter(topic => topic.kind === 'shared');
    shared.forEach((topic, index) => {
        const bullets = topic.bullets.flatMap(bullet => {
            const text = safeInline(bullet.text);
            if (text === '') return [];
            const refs = sourcesOf(bullet.pointIds, draft.points).flatMap(ref => {
                const source = sourceOf.get(ref);
                return source ? [refOf(source)] : [];
            });
            return [refs.length > 0 ? `- ${text} (${refs.join(', ')})` : `- ${text}`];
        });
        if (bullets.length === 0) return;
        blocks.push([`## ${safeInline(topic.heading) || `Topic ${index + 1}`}`, bullets.join('\n')].join('\n\n'));
        for (const conflict of topic.conflicts) {
            const says = conflict.pointIds.flatMap(id => {
                const point = pointOf.get(id);
                const source = point ? sourceOf.get(point.sourceRef) : undefined;
                const text = point ? safeInline(point.text) : '';
                return source && text !== '' ? [`${refOf(source)} says "${text}"`] : [];
            });
            if (says.length >= 2) blocks.push(`> Sources differ: ${says.join('; ')}`);
        }
    });

    const leftovers = topics.flatMap(topic => {
        const source =
            topic.kind === 'source' && topic.sourceRef !== undefined ? sourceOf.get(topic.sourceRef) : undefined;
        const lines = topic.bullets
            .map(bullet => safeInline(bullet.text))
            .filter(text => text !== '')
            .map(text => `- ${text}`);
        return source && lines.length > 0 ? [`### ${labelOf(source)} (${refOf(source)})\n\n${lines.join('\n')}`] : [];
    });
    if (leftovers.length > 0) blocks.push(`## Only in one source\n\n${leftovers.join('\n\n')}`);

    if (sources.length > 0) blocks.push(sourcesSection(sources));
    return blocks;
}

/** The By tab layout: one section per source with all its points, then the Sources list */
function byTabBody(draft: StudyNoteDraft, sources: NoteSource[]): string[] {
    const blocks = [disclaimerFor(sources)];
    for (const source of sources) blocks.push(sectionFor(source, draft));
    if (sources.length > 0) blocks.push(sourcesSection(sources));
    return blocks;
}

function bodyOf(draft: StudyNoteDraft): string[] {
    const sources = [...draft.sources].sort((a, b) => a.ref - b.ref);
    // Without topics the Combined view has nothing to show, so the By tab layout is written instead
    if (draft.view === 'combined' && (draft.combined ?? []).length > 0) return combinedBody(draft, sources);
    return byTabBody(draft, sources);
}

/**
 * The note's Markdown for a draft: the title as H1, then the layout of the draft's view (Combined or By tab). Sources
 * are only the ones in the draft: failed and removed tabs are left out by the caller.
 */
export function buildStudyNote(draft: StudyNoteDraft, options: StudyNoteOptions): string {
    const title = resolveStudyNoteTitle(options.title, options.date);
    return [`# ${title}`, ...bodyOf(draft)].join('\n\n');
}
