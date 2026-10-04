// Pinned tasks and notes come first in every list (docs/specs/PINNING.md)

/** Pinned items first; otherwise keeps the list's own order (stable) */
export function pinnedFirst<T extends { pinned?: boolean }>(items: T[]): T[] {
    return [...items.filter(item => item.pinned), ...items.filter(item => !item.pinned)];
}
