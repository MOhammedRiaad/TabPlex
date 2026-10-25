// Helpers shared by the markdown renderers (MarkdownEditor preview, NoteCard)

/** Longest text the renderers handle; the rest is cut off (keeps the regex passes fast on huge or imported notes) */
export const MARKDOWN_MAX_CHARS = 200_000;

/** Escape text for HTML, including quotes (values end up inside attributes) */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const LINK = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
const SAFE_LINK = /^(https?:|mailto:)/i;

/** Anchor for a link, or just its label when the URL is not a web or mail URL. `label` and `href` are already escaped. */
function anchorFor(label: string, href: string): string {
    const url = href.trim();
    return SAFE_LINK.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
}

/**
 * Render [label](href) as a link only for web and mail URLs. javascript:, data: and other schemes
 * become plain text: notes can come from imported files.
 */
export function renderMarkdownLinks(html: string): string {
    return html.replace(LINK, (_match, label: string, href: string) => anchorFor(label, href));
}

/** Marks a link in transit (a private-use character, so it never appears in real text or in the rules' patterns) */
const MARK = String.fromCharCode(0xe000);
const MARK_ANY = new RegExp(MARK, 'g');
const MARKED_LINK = new RegExp(`${MARK}([0-9]+)${MARK}`, 'g');

/**
 * Renders escaped markdown with `transform` (the emphasis, code, list… rules) without letting those rules touch links.
 * Links are cut out first and put back last, so a rule can never add markup (or a quote) inside an href.
 * `escaped` must already be HTML-escaped. Any marker character already in the text is dropped first.
 */
export function transformKeepingLinks(escaped: string, transform: (text: string) => string): string {
    const links: string[] = [];
    const text = escaped
        .slice(0, MARKDOWN_MAX_CHARS)
        .replace(MARK_ANY, '')
        .replace(
            LINK,
            (_match, label: string, href: string) => `${MARK}${links.push(anchorFor(label, href)) - 1}${MARK}`
        );
    return transform(text).replace(MARKED_LINK, (_match, index: string) => links[Number(index)] ?? '');
}
