// Tag rules shared by tasks, notes and saved tabs (docs/specs/TAGGING.md)

export const TAG_MAX = 30;
export const MAX_TAGS = 10;

/** "  #Q4  Launch " → "q4 launch"; empty when nothing usable is left */
export function normalizeTag(raw: string): string {
    return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, TAG_MAX).trim();
}

/** Add the comma-separated tags in `input` to `tags`: normalized, without duplicates, at most MAX_TAGS */
export function addTags(tags: string[], input: string): string[] {
    const next = [...tags];
    for (const part of input.split(',')) {
        const tag = normalizeTag(part);
        if (tag && !next.includes(tag) && next.length < MAX_TAGS) next.push(tag);
    }
    return next;
}

/** Every tag in use, with how many items carry it, sorted by name */
export function collectTags(items: { tags?: string[] }[]): { tag: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const item of items) for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Items that carry `tag`; all of them when no tag is chosen */
export function filterByTag<T extends { tags?: string[] }>(items: T[], tag: string): T[] {
    return tag ? items.filter(item => item.tags?.includes(tag)) : items;
}
