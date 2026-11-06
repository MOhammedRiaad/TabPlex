import { describe, expect, it } from 'vitest';
import { tabsToDrop } from '../tab-retention';
import { CLOSED_TAB_RETENTION_MS, MAX_TRACKED_TABS } from '../../utils/tabTracking';
import { makeTab } from '../../test/factories';

const NOW = Date.parse('2026-10-03T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

describe('tabsToDrop', () => {
    it('drops only tabs closed for longer than the retention time', () => {
        const tabs = [
            makeTab({
                id: 'stale',
                status: 'closed',
                lastAccessed: new Date(NOW - CLOSED_TAB_RETENTION_MS - 1).toISOString(),
            }),
            makeTab({ id: 'fresh', status: 'closed', lastAccessed: daysAgo(29) }),
            makeTab({ id: 'old-but-open', status: 'open', lastAccessed: daysAgo(400) }),
            makeTab({ id: 'old-but-suspended', status: 'suspended', lastAccessed: daysAgo(400) }),
        ];
        expect(tabsToDrop(tabs, NOW)).toEqual(['stale']);
    });

    it('keeps everything when the list is within its limit', () => {
        const tabs = Array.from({ length: MAX_TRACKED_TABS }, (_, i) => makeTab({ id: `t${i}`, status: 'open' }));
        expect(tabsToDrop(tabs, NOW)).toEqual([]);
    });

    it('drops the oldest closed tabs, and only as many as needed, when over the limit', () => {
        const open = Array.from({ length: MAX_TRACKED_TABS - 1 }, (_, i) => makeTab({ id: `o${i}`, status: 'open' }));
        const closed = [
            makeTab({ id: 'c-new', status: 'closed', lastAccessed: daysAgo(1) }),
            makeTab({ id: 'c-oldest', status: 'closed', lastAccessed: daysAgo(20) }),
            makeTab({ id: 'c-mid', status: 'closed', lastAccessed: daysAgo(5) }),
        ];
        // 2,002 tabs, limit 2,000: the two oldest closed ones go
        expect(tabsToDrop([...open, ...closed], NOW).sort()).toEqual(['c-mid', 'c-oldest']);
    });

    it('counts the expired tabs against the excess, and never drops open tabs', () => {
        const open = Array.from({ length: MAX_TRACKED_TABS + 5 }, (_, i) => makeTab({ id: `o${i}`, status: 'open' }));
        const stale = makeTab({ id: 'stale', status: 'closed', lastAccessed: daysAgo(60) });
        const recent = makeTab({ id: 'recent', status: 'closed', lastAccessed: daysAgo(2) });
        const dropped = tabsToDrop([...open, stale, recent], NOW);
        expect(dropped.sort()).toEqual(['recent', 'stale']);
        expect(dropped.some(id => id.startsWith('o'))).toBe(false);
    });
});
