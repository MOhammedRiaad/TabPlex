import { describe, expect, it } from 'vitest';
import { buildOrganizeInput, cleanGroupName, normalizeAiProposal, organizeSchema } from '../aiGrouping';
import { OrganizableTab } from '../../../ai/types';
import { GROUP_COLORS } from '../../../../utils/organizeTabs';

const tab = (id: number, title = `Tab ${id}`, url = `https://site${id}.dev/page`): OrganizableTab => ({
    id,
    windowId: 1,
    title,
    url,
});

/** Six tabs with browser ids 101–106 (model indexes 1–6) */
const six = [101, 102, 103, 104, 105, 106].map(id => tab(id));
const normalize = (groups: unknown, tabs = six, omitted: number[] = []) =>
    normalizeAiProposal({ groups }, tabs, omitted);

/** Every tab id in exactly one place */
function expectInvariant(proposal: NonNullable<ReturnType<typeof normalize>>, tabs: OrganizableTab[]) {
    const all = [
        ...proposal.groups.flatMap(g => g.tabIds),
        ...proposal.ungroupedTabIds,
        ...proposal.omittedTabIds,
    ].sort();
    expect(all).toEqual(tabs.map(t => t.id).sort());
}

describe('buildOrganizeInput', () => {
    it('numbers tabs from 1 with short addresses and no query strings', () => {
        const input = buildOrganizeInput([
            tab(9, 'Stripe pricing', 'https://www.stripe.com/pricing?token=secret'),
            tab(3, 'Paddle', 'https://paddle.com/'),
        ]);
        expect(input).toBe(
            'Tabs:\n1. Stripe pricing (stripe.com/pricing)\n2. Paddle (paddle.com)\n\nGroup these 2 tabs.'
        );
        expect(input).not.toContain('secret');
    });
});

describe('organizeSchema', () => {
    it('limits tab numbers to the tabs sent and groups to 8', () => {
        const schema = organizeSchema(6);
        expect(schema.properties.groups.maxItems).toBe(8);
        expect(schema.properties.groups.items.properties.tabs.items).toEqual({
            type: 'integer',
            minimum: 1,
            maximum: 6,
        });
        expect(schema.properties.groups.items.properties.color.enum).toEqual(GROUP_COLORS);
        // Length is enforced by cleanGroupName, not the schema (Chrome's built-in AI guidance)
        expect(schema.properties.groups.items.properties.name).toEqual({ type: 'string', minLength: 1 });
    });
});

describe('normalizeAiProposal', () => {
    it('N1: keeps a valid answer as is', () => {
        const proposal = normalize([
            { name: 'Pricing Research', color: 'red', tabs: [1, 2] },
            { name: 'React Hooks', color: 'blue', tabs: [3, 5] },
            { name: 'Lisbon Trip', color: 'green', tabs: [4, 6] },
        ])!;
        expect(proposal.groups.map(g => [g.key, g.name, g.color, g.tabIds, g.enabled])).toEqual([
            ['g1', 'Pricing Research', 'red', [101, 102], true],
            ['g2', 'React Hooks', 'blue', [103, 105], true],
            ['g3', 'Lisbon Trip', 'green', [104, 106], true],
        ]);
        expect(proposal).toMatchObject({ source: 'ai', ungroupedTabIds: [], omittedTabIds: [] });
        expectInvariant(proposal, six);
    });

    it('N2: gives a repeated colour the first unused one', () => {
        const proposal = normalize([
            { name: 'A', color: 'red', tabs: [1, 2] },
            { name: 'B', color: 'red', tabs: [3, 4] },
        ])!;
        expect(proposal.groups.map(g => g.color)).toEqual(['red', 'blue']);
    });

    it('N3: the first group wins a shared tab; a group left with 1 tab is dropped', () => {
        const proposal = normalize([
            { name: 'A', color: 'red', tabs: [1, 2, 3] },
            { name: 'B', color: 'blue', tabs: [3, 4] },
        ])!;
        expect(proposal.groups.map(g => g.tabIds)).toEqual([[101, 102, 103]]);
        expect(proposal.ungroupedTabIds).toEqual([104, 105, 106]);
        expectInvariant(proposal, six);
    });

    it('N4: ignores tab numbers that are not valid integers in range', () => {
        const proposal = normalize([{ name: 'A', color: 'red', tabs: [0, 7, 2.5, '3', 1, 2] }])!;
        expect(proposal.groups[0].tabIds).toEqual([101, 102]);
    });

    it('N5–N7: cleans names, falls back to "Group n", cuts long names', () => {
        const proposal = normalize([
            { name: '  "Trip 🏖️ to   Lisbon" ', color: 'red', tabs: [1, 2] },
            { name: '', color: 'blue', tabs: [3, 4] },
            { name: 'x'.repeat(40), color: 'green', tabs: [5, 6] },
        ])!;
        expect(proposal.groups.map(g => g.name)).toEqual(['Trip to Lisbon', 'Group 2', 'x'.repeat(24)]);
        expect(cleanGroupName(undefined)).toBe('');
    });

    it('N8: merges groups with the same name (any case)', () => {
        const proposal = normalize([
            { name: 'React', color: 'red', tabs: [1, 2] },
            { name: 'react', color: 'blue', tabs: [3, 4] },
        ])!;
        expect(proposal.groups).toHaveLength(1);
        expect(proposal.groups[0]).toMatchObject({ name: 'React', color: 'red', tabIds: [101, 102, 103, 104] });
    });

    it('N9: keeps at most 8 groups; the rest stay ungrouped', () => {
        const twenty = Array.from({ length: 20 }, (_, i) => tab(201 + i));
        const groups = Array.from({ length: 10 }, (_, i) => ({
            name: `G${i}`,
            color: 'red',
            tabs: [2 * i + 1, 2 * i + 2],
        }));
        const proposal = normalize(groups, twenty)!;
        expect(proposal.groups).toHaveLength(8);
        expect(proposal.ungroupedTabIds).toEqual([217, 218, 219, 220]);
        expectInvariant(proposal, twenty);
        // 8 distinct colours before cycling
        expect(new Set(proposal.groups.map(g => g.color)).size).toBe(8);
    });

    it('N10: replaces an unknown colour', () => {
        const proposal = normalize([
            { name: 'A', color: 'blue', tabs: [1, 2] },
            { name: 'B', color: 'magenta', tabs: [3, 4] },
        ])!;
        expect(proposal.groups[1].color).toBe('red');
    });

    it.each([[{}], [{ groups: 'x' }], [null], ['text']])('N11: rejects %j', raw => {
        expect(normalizeAiProposal(raw, six, [])).toBeNull();
    });

    it('N12: rejects an answer where every group is too small', () => {
        expect(normalize([{ name: 'A', color: 'red', tabs: [1] }, null, 'x', { name: 'B', tabs: 'nope' }])).toBeNull();
    });

    it('N13: passes omitted tabs through', () => {
        const eight = [...six, tab(107), tab(108)];
        const proposal = normalize([{ name: 'A', color: 'red', tabs: [1, 2] }], six, [107, 108])!;
        expect(proposal.omittedTabIds).toEqual([107, 108]);
        expectInvariant(proposal, eight);
    });

    it('lets a later group use tabs released by a dropped group', () => {
        const proposal = normalize([
            { name: 'Tiny', color: 'red', tabs: [1] },
            { name: 'B', color: 'blue', tabs: [1, 2] },
        ])!;
        expect(proposal.groups.map(g => g.tabIds)).toEqual([[101, 102]]);
    });
});
