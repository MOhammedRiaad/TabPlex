import { describe, expect, it } from 'vitest';
import { describeErrors, isSafeUrl, sanitizeCollections } from '../importValidation';
import { makeNote, makeTab, makeTask } from '../../test/factories';

describe('isSafeUrl', () => {
    it.each(['https://a.dev/x', 'http://a.dev', 'file:///c:/a.txt', 'chrome://extensions'])('allows %s', url => {
        expect(isSafeUrl(url)).toBe(true);
    });
    it.each(['javascript:alert(1)', 'data:text/html,<b>', 'vbscript:x', 'blob:https://a/1', 'no scheme', ''])(
        'blocks %s',
        url => {
            expect(isSafeUrl(url)).toBe(false);
        }
    );
});

describe('sanitizeCollections', () => {
    const ok = (data: unknown) => {
        const result = sanitizeCollections(data);
        if (!result.ok) throw new Error(result.errors.join('; '));
        return result.value;
    };

    it('treats missing data and missing collections as empty', () => {
        expect(ok(undefined).collections.tasks).toEqual([]);
        expect(ok({}).collections.notes).toEqual([]);
        expect(ok({ tasks: null }).collections.tasks).toEqual([]);
    });

    it('keeps valid items unchanged', () => {
        const task = makeTask({ context: { state: 'parked', tabs: [{ url: 'https://x.dev', title: 'X' }] } });
        const { collections, warnings } = ok({ tasks: [task], notes: [makeNote()], tabs: [makeTab()] });
        expect(collections.tasks).toEqual([task]);
        expect(warnings).toEqual([]);
    });

    it.each([
        ['a collection that is not a list', { tasks: {} }, '"tasks" must be a list'],
        ['an element that is not an object', { tabs: [null] }, 'tabs[0] is not an object'],
        ['an element without an id', { notes: [{ content: 'x' }] }, 'notes[0] has no valid id'],
        ['an id that is too long', { notes: [{ id: 'x'.repeat(201), content: '' }] }, 'no valid id'],
        ['a title of the wrong type', { tasks: [{ id: 'a', title: 5 }] }, 'tasks[0].title must be text'],
        ['an unknown task status', { tasks: [{ id: 'a', title: 't', status: 'weird' }] }, 'status is not valid'],
        ['an unknown tab status', { tabs: [{ id: 'a', status: 'weird' }] }, 'status is not valid'],
        ['a url that is not text', { tabs: [{ id: 'a', url: 5 }] }, 'tabs[0].url must be text'],
        ['data that is not an object', [], '"data" must be an object'],
        ['canvases that are not a list', { canvases: 'x' }, '"canvases" must be a list'],
    ])('rejects %s', (_name, data, message) => {
        const result = sanitizeCollections(data);
        expect(result.ok).toBe(false);
        expect(result.ok ? '' : result.errors.join(';')).toContain(message);
    });

    it('empties unsafe urls and favicons, in tabs, history and task contexts, and reports them', () => {
        const { collections, warnings } = ok({
            tabs: [makeTab({ id: 'a', url: 'javascript:alert(1)', favicon: 'javascript:x' })],
            history: [{ id: 'h', url: 'data:text/html,x', title: 'H' }],
            tasks: [
                makeTask({
                    context: {
                        state: 'parked',
                        tabs: [
                            { url: 'javascript:1', title: 'Bad' },
                            { url: 'https://ok.dev', title: 'Good', favicon: 'data:image/png;base64,AAAA' },
                        ],
                    },
                }),
            ],
        });
        expect(collections.tabs[0]).toMatchObject({ url: '', favicon: '' });
        expect(collections.history[0].url).toBe('');
        expect(collections.tasks[0].context?.tabs.map(t => t.url)).toEqual(['', 'https://ok.dev']);
        expect(collections.tasks[0].context?.tabs[1].favicon).toBe('data:image/png;base64,AAAA');
        expect(warnings).toHaveLength(3);
    });

    it('merges repeated ids, keeping the last, and keeps only canvas objects', () => {
        const { collections, canvases, warnings } = ok({
            notes: [makeNote({ id: 'n', content: 'first' }), makeNote({ id: 'n', content: 'last' })],
            canvases: [{ id: 'c' }, 'junk', null],
        });
        expect(collections.notes.map(n => n.content)).toEqual(['last']);
        expect(canvases).toEqual([{ id: 'c' }]);
        expect(warnings.join()).toContain('repeated');
    });
});

describe('describeErrors', () => {
    it('lists the first five problems and counts the rest', () => {
        expect(describeErrors(['a', 'b'])).toBe('a; b');
        expect(describeErrors(['1', '2', '3', '4', '5', '6', '7'])).toBe('1; 2; 3; 4; 5; and 2 more');
    });
});
