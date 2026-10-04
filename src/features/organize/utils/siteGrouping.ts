// Non-AI path of "Organize tabs": group tabs by site. Used when the model is off or unavailable.
import { OrganizableTab } from '../../ai/types';
import { GROUP_COLORS, GROUP_NAME_MAX, MAX_GROUPS, MIN_TABS_PER_GROUP } from '../../../utils/organizeTabs';
import { GroupProposal } from '../types';

/** Two-part public suffixes common enough to matter. Not exhaustive by design. */
const TWO_PART_SUFFIXES = new Set([
    'co.uk',
    'org.uk',
    'ac.uk',
    'gov.uk',
    'com.au',
    'net.au',
    'org.au',
    'co.nz',
    'co.jp',
    'ne.jp',
    'com.br',
    'com.mx',
    'com.tr',
    'com.eg',
    'co.in',
    'co.za',
    'com.sg',
    'com.cn',
    'com.hk',
    'co.kr',
]);

/** "docs.github.com" → "github.com"; "news.bbc.co.uk" → "bbc.co.uk"; IPs and "localhost" stay as they are */
export function siteKey(rawUrl: string): string | null {
    let host: string;
    try {
        const url = new URL(rawUrl);
        if (url.protocol === 'file:') return 'Local files';
        host = url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
    if (!host) return null;
    if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) return host;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    return TWO_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

export function groupBySite(tabs: OrganizableTab[]): GroupProposal {
    const buckets = new Map<string, { first: number; tabIds: number[] }>();
    const ungrouped = new Set<number>();
    tabs.forEach((tab, index) => {
        const key = siteKey(tab.url);
        if (!key) {
            ungrouped.add(tab.id);
            return;
        }
        const bucket = buckets.get(key) ?? { first: index, tabIds: [] };
        bucket.tabIds.push(tab.id);
        buckets.set(key, bucket);
    });

    const qualifying = [...buckets.entries()]
        .filter(([, bucket]) => bucket.tabIds.length >= MIN_TABS_PER_GROUP)
        .sort(([, a], [, b]) => b.tabIds.length - a.tabIds.length || a.first - b.first);
    const kept = qualifying.slice(0, MAX_GROUPS);
    const keptKeys = new Set(kept.map(([key]) => key));
    for (const [key, bucket] of buckets) {
        if (!keptKeys.has(key)) bucket.tabIds.forEach(id => ungrouped.add(id));
    }

    return {
        source: 'site',
        groups: kept.map(([key, bucket], i) => ({
            key: `g${i + 1}`,
            name: key.slice(0, GROUP_NAME_MAX),
            color: GROUP_COLORS[i % GROUP_COLORS.length],
            tabIds: bucket.tabIds,
            enabled: true,
        })),
        // Tab-strip order
        ungroupedTabIds: tabs.map(t => t.id).filter(id => ungrouped.has(id)),
        omittedTabIds: [],
    };
}
