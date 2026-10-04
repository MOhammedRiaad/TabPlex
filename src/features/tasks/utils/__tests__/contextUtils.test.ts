import { describe, expect, it } from 'vitest';
import { getActiveContextTask, getContextTabCount, getParkedTasks, pluralizeTabs } from '../contextUtils';
import { makeContext, makeTask } from '../../../../test/factories';

describe('contextUtils', () => {
    const active = makeTask({ id: 'a', context: makeContext({ state: 'active' }) });
    const older = makeTask({ id: 'p1', context: makeContext({ parkedAt: '2026-10-01T00:00:00Z' }) });
    const newer = makeTask({ id: 'p2', context: makeContext({ parkedAt: '2026-10-02T00:00:00Z' }) });
    const done = makeTask({ id: 'd', status: 'done', context: makeContext() });
    const plain = makeTask({ id: 'n' });

    it('finds the active task', () => {
        expect(getActiveContextTask([plain, active])).toBe(active);
        expect(getActiveContextTask([plain])).toBeUndefined();
    });

    it('lists unfinished parked tasks, newest first', () => {
        expect(getParkedTasks([older, done, newer, active, plain]).map(t => t.id)).toEqual(['p2', 'p1']);
        const noDate = makeTask({ id: 'x', context: makeContext({ parkedAt: undefined }) });
        expect(getParkedTasks([noDate, newer]).map(t => t.id)).toEqual(['p2', 'x']);
    });

    it('counts and pluralises tabs', () => {
        expect(getContextTabCount(older)).toBe(2);
        expect(getContextTabCount(plain)).toBe(0);
        expect(pluralizeTabs(1)).toBe('1 tab');
        expect(pluralizeTabs(0)).toBe('0 tabs');
        expect(pluralizeTabs(3)).toBe('3 tabs');
    });
});
