import { describe, expect, it } from 'vitest';
import { computeContextStats, formatParkedDuration } from '../contextStats';
import { makeContext, makeTask } from '../../../../test/factories';

const H = 3_600_000;
const NOW = Date.parse('2026-10-10T12:00:00Z');
const at = (agoMs: number) => new Date(NOW - agoMs).toISOString();

describe('computeContextStats', () => {
    it('counts parks, resumes, freed tabs and parked time within the window', () => {
        const tasks = [
            makeTask({
                id: 'a',
                status: 'doing',
                context: makeContext({
                    state: 'active',
                    events: [
                        { type: 'start', at: at(30 * 24 * H), tabCount: 0 },
                        { type: 'park', at: at(10 * 24 * H), tabCount: 3, closedTabs: 3 },
                        { type: 'resume', at: at(6 * 24 * H), tabCount: 3 },
                        { type: 'park', at: at(5 * H), tabCount: 4, closedTabs: 4 },
                        { type: 'resume', at: at(3 * H), tabCount: 4 },
                        { type: 'park', at: 'garbage', tabCount: 1 },
                    ],
                }),
            }),
            makeTask({
                id: 'b',
                context: makeContext({ events: [{ type: 'park', at: at(H), tabCount: 2, auto: true }] }),
            }),
            makeTask({ id: 'c', status: 'done', context: makeContext() }),
            makeTask({ id: 'd' }),
        ];
        const stats = computeContextStats(tasks, 7, NOW);
        expect(stats).toEqual({
            parks: 2,
            resumes: 2,
            tabsFreed: 4,
            currentlyParked: 1,
            averageParkedMs: (4 * 24 * H + 2 * H) / 2,
        });
    });

    it('returns null average without resumes', () => {
        expect(computeContextStats([], 7, NOW).averageParkedMs).toBeNull();
        const resumeWithoutPark = makeTask({
            context: makeContext({ events: [{ type: 'resume', at: at(H), tabCount: 1 }] }),
        });
        const stats = computeContextStats([resumeWithoutPark], 7, NOW);
        expect(stats.resumes).toBe(1);
        expect(stats.averageParkedMs).toBeNull();
    });

    it('uses the current time by default', () => {
        const recent = makeTask({
            context: makeContext({ events: [{ type: 'park', at: new Date().toISOString(), tabCount: 1 }] }),
        });
        expect(computeContextStats([recent]).parks).toBe(1);
    });
});

describe('formatParkedDuration', () => {
    it.each([
        [10_000, '1m'],
        [45 * 60_000, '45m'],
        [3 * H + 10 * 60_000, '3h 10m'],
        [52 * H, '2d 4h'],
    ])('%ims → %s', (ms, text) => {
        expect(formatParkedDuration(ms)).toBe(text);
    });
});
