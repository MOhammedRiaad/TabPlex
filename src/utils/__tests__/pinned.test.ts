import { describe, expect, it } from 'vitest';
import { pinnedFirst } from '../pinned';

describe('pinnedFirst', () => {
    it('puts pinned items first, keeping each group in its original order', () => {
        const items = [{ id: 'a' }, { id: 'b', pinned: true }, { id: 'c', pinned: false }, { id: 'd', pinned: true }];
        expect(pinnedFirst(items).map(i => i.id)).toEqual(['b', 'd', 'a', 'c']);
        expect(items.map(i => i.id)).toEqual(['a', 'b', 'c', 'd']); // not mutated
        expect(pinnedFirst([])).toEqual([]);
    });
});
