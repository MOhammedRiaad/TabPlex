// AI path of "Organize tabs": prompt, response schema, and the normalizer that repairs the model's answer.
import { describeTabForAi } from '../../ai/utils/tabText';
import { OrganizableTab } from '../../ai/types';
import {
    GROUP_COLORS,
    GROUP_NAME_MAX,
    MAX_GROUPS,
    MIN_TABS_PER_GROUP,
    TabGroupColor,
    isTabGroupColor,
} from '../../../utils/organizeTabs';
import { GroupProposal, ProposedGroup } from '../types';

export const ORGANIZE_SYSTEM_PROMPT = [
    'You sort a person’s open browser tabs into groups by the piece of work they belong to.',
    'Each tab has a number, a title and a short address.',
    'Rules:',
    '- Group by task or topic (for example "Trip to Lisbon", "Q4 pricing", "React hooks"), not by website, unless one website is clearly one topic.',
    '- Make between 2 and 8 groups. Every group needs at least 2 tabs.',
    '- Group names: 1 to 3 words, at most 24 characters, Title Case, no emoji, no quotes.',
    '- Use each tab number at most once. Leave a tab out if it fits no group.',
    '- Pick a different color for each group when you can.',
    'Answer only with JSON that matches the schema.',
].join('\n');

/** Numbered from 1 so the model never sees browser tab ids */
export function buildOrganizeInput(tabs: OrganizableTab[]): string {
    const lines = tabs.map((tab, i) => `${i + 1}. ${describeTabForAi(tab)}`);
    return `Tabs:\n${lines.join('\n')}\n\nGroup these ${tabs.length} tabs.`;
}

export function organizeSchema(tabCount: number) {
    return {
        type: 'object',
        properties: {
            groups: {
                type: 'array',
                minItems: 1,
                maxItems: MAX_GROUPS,
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', minLength: 1, maxLength: GROUP_NAME_MAX },
                        color: { type: 'string', enum: GROUP_COLORS },
                        tabs: {
                            type: 'array',
                            minItems: MIN_TABS_PER_GROUP,
                            items: { type: 'integer', minimum: 1, maximum: tabCount },
                        },
                    },
                    required: ['name', 'color', 'tabs'],
                    additionalProperties: false,
                },
            },
        },
        required: ['groups'],
        additionalProperties: false,
    };
}

/** Group names: no quotes or emoji, single spaces, at most GROUP_NAME_MAX characters */
export function cleanGroupName(raw: unknown): string {
    return String(raw ?? '')
        .replace(/["'`“”‘’]/g, '')
        .replace(/\p{Extended_Pictographic}|️/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, GROUP_NAME_MAX)
        .trim();
}

interface Draft {
    name: string;
    color: unknown;
    tabIds: number[];
}

/**
 * Repair the model's answer into a proposal (see the N1–N13 table in the spec). Returns null only when nothing
 * usable is left, which makes promptJson retry once.
 */
export function normalizeAiProposal(
    raw: unknown,
    tabs: OrganizableTab[],
    omittedTabIds: number[]
): GroupProposal | null {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { groups?: unknown }).groups)) return null;
    const entries = (raw as { groups: unknown[] }).groups;

    const used = new Set<number>();
    const drafts: Draft[] = [];
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const { name, color, tabs: indexes } = entry as { name?: unknown; color?: unknown; tabs?: unknown };
        const tabIds: number[] = [];
        for (const index of Array.isArray(indexes) ? indexes : []) {
            if (!Number.isInteger(index) || index < 1 || index > tabs.length || used.has(index)) continue;
            used.add(index);
            tabIds.push(tabs[index - 1].id);
        }
        // Too small: its tabs stay ungrouped (and may still be claimed by a later group)
        if (tabIds.length < MIN_TABS_PER_GROUP) {
            for (const id of tabIds) used.delete(tabs.findIndex(t => t.id === id) + 1);
            continue;
        }
        drafts.push({ name: cleanGroupName(name), color, tabIds });
    }

    // Same name (case-insensitive): merge into the first one
    const merged: Draft[] = [];
    for (const draft of drafts) {
        const twin = draft.name ? merged.find(m => m.name.toLowerCase() === draft.name.toLowerCase()) : undefined;
        if (twin) twin.tabIds.push(...draft.tabIds);
        else merged.push(draft);
    }

    const kept = merged.slice(0, MAX_GROUPS);
    if (kept.length === 0) return null;

    const usedColors = new Set<TabGroupColor>();
    const groups: ProposedGroup[] = kept.map((draft, i) => {
        let color: TabGroupColor;
        if (isTabGroupColor(draft.color) && !usedColors.has(draft.color)) {
            color = draft.color;
        } else {
            color = GROUP_COLORS.find(c => !usedColors.has(c)) ?? GROUP_COLORS[i % GROUP_COLORS.length];
        }
        usedColors.add(color);
        return { key: `g${i + 1}`, name: draft.name || `Group ${i + 1}`, color, tabIds: draft.tabIds, enabled: true };
    });

    const grouped = new Set(groups.flatMap(g => g.tabIds));
    return {
        source: 'ai',
        groups,
        ungroupedTabIds: tabs.map(t => t.id).filter(id => !grouped.has(id)),
        omittedTabIds,
    };
}
