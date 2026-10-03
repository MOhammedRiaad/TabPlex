// Helpers shared by the markdown renderers (MarkdownEditor preview, NoteCard)

/** Escape text for HTML, including quotes (values end up inside attributes) */
export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render [label](href) as a link only for web and mail URLs. javascript:, data: and other schemes
 * become plain text: notes can come from imported files.
 */
export function renderMarkdownLinks(html: string): string {
    return html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) =>
        /^(https?:|mailto:)/i.test(href.trim())
            ? `<a href="${href.trim()}" target="_blank" rel="noopener noreferrer">${label}</a>`
            : label
    );
}
