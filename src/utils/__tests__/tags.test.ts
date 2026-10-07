import { describe, expect, it } from 'vitest';
import { MAX_TAGS, TAG_MAX, addTags, collectTags, filterByTag, normalizeTag } from '../tags';

describe('tags', () => {
    it('normalizes: trims, drops a leading #, collapses spaces, lower-cases, cuts to 30', () => {
        expect(normalizeTag('  #Q4  Launch ')).toBe('q4 launch');
        expect(normalizeTag('##Research')).toBe('research');
        expect(normalizeTag('   ')).toBe('');
        expect(normalizeTag('#')).toBe('');
        expect(normalizeTag('x'.repeat(50))).toHaveLength(TAG_MAX);
    });

    it('adds comma-separated tags without duplicates, up to the limit', () => {
        expect(addTags(['q4'], 'Research, #Q4 ,  , design')).toEqual(['q4', 'research', 'design']);
        const many = Array.from({ length: 15 }, (_, i) => `t${i}`).join(',');
        expect(addTags([], many)).toHaveLength(MAX_TAGS);
        expect(addTags(['a'], '')).toEqual(['a']);
    });

    it('collects tags in use with counts, sorted by name, and filters by one', () => {
        const items = [{ tags: ['web', 'q4'] }, { tags: ['q4'] }, {}, { tags: [] }];
        expect(collectTags(items)).toEqual([
            { tag: 'q4', count: 2 },
            { tag: 'web', count: 1 },
        ]);
        expect(filterByTag(items, 'q4')).toEqual([items[0], items[1]]);
        expect(filterByTag(items, '')).toBe(items);
    });
});
