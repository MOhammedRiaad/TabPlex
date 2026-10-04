export const NOTE_TITLE_MAX = 50;
export const UNTITLED_NOTE = 'Untitled Note';

/** A note's title: its first non-empty line, without Markdown heading marks, cut to 50 characters */
export function deriveNoteTitle(content: string): string {
    const firstLine = content
        .split('\n')
        .map(line => line.trim())
        .find(Boolean);
    const title = (firstLine ?? '').replace(/^#{1,6}\s+/, '').trim();
    return title.slice(0, NOTE_TITLE_MAX) || UNTITLED_NOTE;
}
