// T4: every import warning reads right for 1, 0 and many (no "(s)").
import { describe, expect, it } from 'vitest';
import { sanitizeCollections } from '../importValidation';

const now = '2026-01-01T00:00:00.000Z';
const warningsOf = (data: unknown): string[] => {
    const result = sanitizeCollections(data);
    if (!result.ok) throw new Error(result.errors.join('; '));
    return result.value.warnings;
};
const tabs = (n: number, extra: Record<string, unknown> = {}) =>
    Array.from({ length: n }, (_v, i) => ({
        id: `t${i}`,
        title: 'T',
        url: 'https://a.test',
        createdAt: now,
        ...extra,
    }));
const sessions = (n: number, extra: Record<string, unknown> = {}) =>
    Array.from({ length: n }, (_v, i) => ({ id: `s${i}`, name: 'S', createdAt: now, tabIds: [], ...extra }));
const folders = (n: number) =>
    Array.from({ length: n }, (_v, i) => ({ id: `f${i}`, name: 'F', boardId: 'missing', createdAt: now }));

describe('import warnings: singular and plural', () => {
    it('no warning at all for clean data (0)', () => {
        expect(warningsOf({ tabs: tabs(2), sessions: sessions(2) })).toEqual([]);
    });

    it.each([
        [1, 'tabs: 1 item had no creation date'],
        [2, 'tabs: 2 items had no creation date'],
        [5, 'tabs: 5 items had no creation date'],
    ])('undated tabs x%i', (n, text) => {
        expect(warningsOf({ tabs: tabs(n, { createdAt: undefined }) })).toEqual([text]);
    });

    it.each([
        [1, 'sessions: 1 session had no tab list'],
        [3, 'sessions: 3 sessions had no tab list'],
    ])('sessions without a tab list x%i', (n, text) => {
        expect(warningsOf({ sessions: sessions(n, { tabIds: undefined }) })).toEqual([text]);
    });

    it.each([
        [1, 'folders: 1 folder without a board was moved to "My Board"'],
        [2, 'folders: 2 folders without a board were moved to "My Board"'],
    ])('folders without a board x%i', (n, text) => {
        expect(warningsOf({ folders: folders(n) })).toEqual([text]);
    });

    it.each([
        [1, 'tabs: 1 link with an unsafe address was emptied'],
        [4, 'tabs: 4 links with an unsafe address were emptied'],
    ])('unsafe tab links x%i', (n, text) => {
        expect(warningsOf({ tabs: tabs(n, { url: 'javascript:alert(1)' }) })).toEqual([text]);
    });

    it('counts unsafe links inside a task context, singular', () => {
        const task = {
            id: 'k',
            title: 'K',
            createdAt: now,
            context: {
                tabs: [
                    { url: 'data:text/html,x', title: 'x' },
                    { url: 'https://ok.test', title: 'ok' },
                ],
            },
        };
        expect(warningsOf({ tasks: [task] })).toEqual(['tasks: 1 link with an unsafe address was emptied']);
    });

    it.each([
        [2, 'tabs: 1 repeated item merged'],
        [3, 'tabs: 2 repeated items merged'],
    ])('the same id %i times', (n, text) => {
        const list = Array.from({ length: n }, () => ({
            id: 'same',
            title: 'T',
            url: 'https://a.test',
            createdAt: now,
        }));
        expect(warningsOf({ tabs: list })).toEqual([text]);
    });

    it('several kinds together keep their own counts and never contain "(s)"', () => {
        const all = warningsOf({
            tabs: [...tabs(1, { createdAt: undefined }), { id: 'x', url: 'vbscript:1', createdAt: now }],
            sessions: sessions(2, { tabIds: undefined }),
            folders: folders(1),
        });
        expect(all).toEqual(
            expect.arrayContaining([
                'tabs: 1 link with an unsafe address was emptied',
                'tabs: 1 item had no creation date',
                'sessions: 2 sessions had no tab list',
                'folders: 1 folder without a board was moved to "My Board"',
            ])
        );
        expect(all.join(' ')).not.toMatch(/\(s\)/);
    });
});
