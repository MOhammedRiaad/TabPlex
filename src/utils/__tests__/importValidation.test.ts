import { describe, expect, it } from 'vitest';
import { checkSettingsShape, describeErrors, EPOCH_ISO, isSafeUrl, sanitizeCollections } from '../importValidation';
import { makeBoard, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../test/factories';

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
            history: [{ id: 'h', url: 'data:text/html,x', title: 'H', createdAt: '2026-10-01T00:00:00.000Z' }],
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

    it('words the link and repeated-item warnings in the singular and the plural', () => {
        const unsafe = (id: string) => makeTab({ id, url: 'javascript:1', favicon: '' });
        const one = ok({ tabs: [unsafe('a')], notes: [makeNote({ id: 'n' }), makeNote({ id: 'n' })] }).warnings;
        expect(one).toContain('tabs: 1 link with an unsafe address was emptied');
        expect(one).toContain('notes: 1 repeated item merged');

        const many = ok({
            tabs: [unsafe('a'), unsafe('b')],
            notes: [makeNote({ id: 'n' }), makeNote({ id: 'n' }), makeNote({ id: 'n' })],
        }).warnings;
        expect(many).toContain('tabs: 2 links with an unsafe address were emptied');
        expect(many).toContain('notes: 2 repeated items merged');
        expect([...one, ...many].join()).not.toContain('(s)');
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

describe('sanitizeCollections: dates, lists, text and orphan folders', () => {
    const ok = (data: unknown) => {
        const result = sanitizeCollections(data);
        if (!result.ok) throw new Error(result.errors.join('; '));
        return result.value;
    };
    const errorsOf = (data: unknown) => {
        const result = sanitizeCollections(data);
        return result.ok ? [] : result.errors;
    };
    const undated = <T extends object>(item: T): Omit<T, 'createdAt'> => {
        const { createdAt: _createdAt, ...rest } = item as T & { createdAt?: string };
        return rest;
    };

    it('dates an item without createdAt with the epoch, one warning per collection', () => {
        const { collections, warnings } = ok({
            boards: [undated(makeBoard({ id: 'b1' })), undated(makeBoard({ id: 'b2' })), makeBoard({ id: 'b3' })],
            tabs: [undated(makeTab())],
            tasks: [{ ...undated(makeTask()), createdAt: null }],
            notes: [undated(makeNote())],
            sessions: [undated(makeSession())],
            folders: [undated(makeFolder({ boardId: 'b1' }))],
            history: [{ id: 'h', url: 'https://h.dev', title: 'H' }],
        });
        for (const name of ['boards', 'tabs', 'tasks', 'notes', 'sessions', 'folders', 'history'] as const) {
            const first = collections[name][0] as { createdAt: string };
            expect(first.createdAt, name).toBe(EPOCH_ISO);
        }
        expect((collections.boards[2] as { createdAt: string }).createdAt).toBe(makeBoard().createdAt);
        const dateWarnings = warnings.filter(w => w.includes('no creation date'));
        expect(dateWarnings.sort()).toEqual(
            [
                'boards: 2 items had no creation date',
                'folders: 1 item had no creation date',
                'tabs: 1 item had no creation date',
                'tasks: 1 item had no creation date',
                'notes: 1 item had no creation date',
                'sessions: 1 item had no creation date',
                'history: 1 item had no creation date',
            ].sort()
        );
    });

    it('rejects a createdAt that is present but not text', () => {
        expect(errorsOf({ notes: [{ ...makeNote(), createdAt: 5 }] })).toEqual(['notes[0].createdAt must be text']);
    });

    it('gives the same result when it checks its own output (the background checks the UI output)', () => {
        const first = ok({
            boards: [undated(makeBoard())],
            folders: [makeFolder({ boardId: 'gone' })],
            sessions: [{ ...makeSession(), tabIds: undefined }],
            tabs: [{ id: 'a' }],
        });
        const again = ok(first.collections);
        expect(again.collections).toEqual(first.collections);
        expect(again.warnings).toEqual([]);
    });

    it.each([
        ['tags that are text', { tabs: [{ id: 'a', tags: 'x' }] }, 'tabs[0].tags must be a list of text'],
        ['tags with a number', { tasks: [{ id: 'a', title: 't', tags: [1] }] }, 'tasks[0].tags must be a list of text'],
        ['note tags that are an object', { notes: [{ id: 'a', content: '', tags: {} }] }, 'notes[0].tags'],
        ['session tabIds that are text', { sessions: [{ id: 'a', name: 'n', tabIds: 'x' }] }, 'sessions[0].tabIds'],
        ['task tabIds with a number', { tasks: [{ id: 'a', title: 't', tabIds: [3] }] }, 'tasks[0].tabIds'],
        [
            'a checklist item without text',
            { tasks: [{ id: 'a', title: 't', checklist: [{ id: 1 }] }] },
            'tasks[0].checklist',
        ],
        ['a checklist that is text', { tasks: [{ id: 'a', title: 't', checklist: 'x' }] }, 'tasks[0].checklist'],
        [
            'a checklist item that is null',
            { tasks: [{ id: 'a', title: 't', checklist: [null] }] },
            'tasks[0].checklist',
        ],
        [
            'a task description that is a number',
            { tasks: [{ id: 'a', title: 't', description: 5 }] },
            'tasks[0].description must be text',
        ],
        [
            'a note title that is a number',
            { notes: [{ id: 'a', content: '', title: 5 }] },
            'notes[0].title must be text',
        ],
        [
            'a session summary that is a number',
            { sessions: [{ id: 'a', name: 'n', summary: 5 }] },
            'sessions[0].summary',
        ],
        ['a tab title that is a number', { tabs: [{ id: 'a', title: 5 }] }, 'tabs[0].title must be text'],
    ])('rejects %s, naming the field', (_name, data, message) => {
        expect(errorsOf(data).join()).toContain(message);
    });

    it('treats null lists as missing and drops them', () => {
        const { collections } = ok({
            tabs: [{ id: 'a', tags: null }],
            tasks: [{ id: 'b', title: 't', tags: null, tabIds: null, checklist: null, description: null }],
            notes: [{ id: 'c', content: '', title: null }],
        });
        expect(collections.tabs[0]).not.toHaveProperty('tags');
        expect(collections.tasks[0]).not.toHaveProperty('tabIds');
        expect(collections.tasks[0]).not.toHaveProperty('checklist');
        expect(collections.tasks[0]).not.toHaveProperty('description');
        expect(collections.notes[0]).not.toHaveProperty('title');
        const valid = ok({
            tasks: [
                {
                    id: 'd',
                    title: 't',
                    tags: ['a'],
                    tabIds: ['x'],
                    checklist: [{ id: '1', text: 't', completed: false }],
                },
            ],
        });
        expect(valid.collections.tasks[0].checklist).toHaveLength(1);
    });

    it('gives a session without a tab list [] and a warning, and tabs without title or url empty text', () => {
        const { collections, warnings } = ok({
            sessions: [{ id: 's', name: 'n', createdAt: 'x' }],
            tabs: [{ id: 't' }],
        });
        expect(collections.sessions[0].tabIds).toEqual([]);
        expect(warnings).toContain('sessions: 1 session had no tab list');
        expect(collections.tabs[0]).toMatchObject({ title: '', url: '' });
    });

    it('attaches folders without a board to default_board, creating it once and dating it now', () => {
        const before = Date.now();
        const { collections, warnings } = ok({
            boards: [makeBoard({ id: 'mine' })],
            folders: [
                makeFolder({ id: 'f1', boardId: 'gone' }),
                makeFolder({ id: 'f2', boardId: '' }),
                makeFolder({ id: 'f3', boardId: 'mine' }),
            ],
            tabs: [makeTab({ id: 't1', folderId: '' }), makeTab({ id: 't2', folderId: 'nowhere' })],
        });
        expect(collections.folders.map(f => f.boardId)).toEqual(['default_board', 'default_board', 'mine']);
        const created = collections.boards.filter(b => b.id === 'default_board');
        expect(created).toEqual([expect.objectContaining({ name: 'My Board', color: '#3b82f6' })]);
        expect(new Date(created[0].createdAt).getTime()).toBeGreaterThanOrEqual(before);
        expect(warnings).toContain('folders: 2 folders without a board were moved to "My Board"');
        expect(collections.tabs.map(t => t.folderId)).toEqual(['', 'nowhere']);
    });

    it('reuses an existing default_board and adds nothing when no folder is orphaned', () => {
        const reused = ok({
            boards: [makeBoard({ id: 'default_board', name: 'Mine' })],
            folders: [makeFolder({ boardId: 'missing' })],
        });
        expect(reused.collections.boards).toHaveLength(1);
        expect(reused.collections.folders[0].boardId).toBe('default_board');

        const fine = ok({ boards: [makeBoard()], folders: [makeFolder({ boardId: 'board_1' })] });
        expect(fine.collections.boards).toHaveLength(1);
        expect(fine.warnings).toEqual([]);
    });
});

describe('checkSettingsShape', () => {
    it('accepts a file without settings, and objects', () => {
        expect(checkSettingsShape({})).toEqual([]);
        expect(
            checkSettingsShape({
                settings: { extension: {}, page: {}, timer: {} },
                data: { canvasSettings: null },
            })
        ).toEqual([]);
        expect(checkSettingsShape({ data: { canvasSettings: { gridSize: 20 } } })).toEqual([]);
        expect(checkSettingsShape({ settings: { extension: { tabplex_track_all_tabs: false } } })).toEqual([]);
    });

    it.each([
        ['settings text', { settings: 'x' }, '"settings"'],
        ['settings list', { settings: [] }, '"settings"'],
        ['extension list', { settings: { extension: [] } }, 'settings.extension'],
        ['page text', { settings: { page: 'x' } }, 'settings.page'],
        ['timer number', { settings: { timer: 3 } }, 'settings.timer'],
        ['canvasSettings list', { data: { canvasSettings: [] } }, 'data.canvasSettings'],
        [
            'recording as text',
            { settings: { extension: { tabplex_track_all_tabs: 'false' } } },
            'tabplex_track_all_tabs',
        ],
        ['recording as 0', { settings: { extension: { tabplex_track_all_tabs: 0 } } }, 'tabplex_track_all_tabs'],
    ])('rejects %s, naming the field', (_name, file, field) => {
        expect(checkSettingsShape(file).join()).toContain(field);
    });
});

describe('describeErrors', () => {
    it('lists the first five problems and counts the rest', () => {
        expect(describeErrors(['a', 'b'])).toBe('a; b');
        expect(describeErrors(['1', '2', '3', '4', '5', '6', '7'])).toBe('1; 2; 3; 4; 5; and 2 more');
    });
});
