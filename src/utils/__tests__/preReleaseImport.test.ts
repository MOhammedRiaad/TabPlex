/* eslint-disable @typescript-eslint/no-explicit-any */
// Written from docs/specs/PRE_RELEASE_REVIEW_FIXES.md (AC4-AC8, edge cases 13-16, 18-19), as a black box.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    EXTENSION_SETTING_KEYS,
    exportData,
    importData,
    IMPORT_BACKUP_KEY,
    markImportInThisTab,
    isImportInThisTab,
    previewImport,
    restoreImportBackup,
} from '../exportImport';
import { EPOCH_ISO, checkSettingsShape, sanitizeCollections } from '../importValidation';
import { TRACK_ALL_TABS_KEY } from '../tabTracking';
import { useTimerStore } from '../../store/timerStore';
import * as db from '../storage';
import { makeBoard, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../test/factories';
import { fakeChrome, respondToMessages } from '../../test/chromeMock';

const KEY = TRACK_ALL_TABS_KEY;
const file = (data: unknown, extra: Record<string, unknown> = {}, version = '2.0.0') =>
    JSON.stringify({ version, timestamp: '2026-10-25T00:00:00.000Z', data, ...extra });

const ok = (data: unknown) => {
    const result = sanitizeCollections(data);
    if (!result.ok) throw new Error(`rejected: ${result.errors.join('; ')}`);
    return result.value;
};
const errorsOf = (data: unknown) => {
    const result = sanitizeCollections(data);
    if (result.ok) throw new Error('was accepted');
    return result.errors;
};
const undated = <T extends object>(item: T) => ({ ...item, createdAt: undefined }) as unknown;

beforeEach(async () => {
    await db.clearAllData();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    useTimerStore.setState(useTimerStore.getInitialState(), true);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    markImportInThisTab(false);
});

describe('AC4: the recording choice survives an import', () => {
    const settings = (extension: Record<string, unknown>) => ({ settings: { extension, page: {}, timer: {} } });

    it.each([
        ['off', false],
        ['on', true],
    ])('a file without the key keeps it %s', async (_l, before) => {
        await chrome.storage.local.set({ [KEY]: before });
        await importData(file({}, settings({})));
        expect((await chrome.storage.local.get(KEY))[KEY]).toBe(before);
    });

    it('a file without the key keeps it missing (no key is created)', async () => {
        await importData(file({}, settings({})));
        expect(KEY in (await chrome.storage.local.get(null))).toBe(false);
    });

    it('a file with no settings block at all keeps it too', async () => {
        await chrome.storage.local.set({ [KEY]: false });
        await importData(file({ tasks: [makeTask()] }));
        expect((await chrome.storage.local.get(KEY))[KEY]).toBe(false);
    });

    it.each([
        [true, false],
        [false, true],
    ])('a file that has %s sets it over %s', async (inFile, before) => {
        await chrome.storage.local.set({ [KEY]: before });
        await importData(file({}, settings({ [KEY]: inFile })));
        expect((await chrome.storage.local.get(KEY))[KEY]).toBe(inFile);
    });

    it.each([['yes'], [1], [0], [null], [{}]])(
        'rejects a non-boolean value %j, before anything is written',
        async bad => {
            await db.addTask(makeTask({ id: 'keep' }));
            await chrome.storage.local.set({ [KEY]: false });
            await expect(importData(file({}, settings({ [KEY]: bad })))).rejects.toThrow(KEY);
            expect((await db.getAllTasks()).map(t => t.id)).toEqual(['keep']);
            expect((await chrome.storage.local.get(KEY))[KEY]).toBe(false);
        }
    );

    it('other listed settings that are missing in the file are still removed', async () => {
        const others = EXTENSION_SETTING_KEYS.filter(key => key !== KEY);
        await chrome.storage.local.set({ [KEY]: false, ...Object.fromEntries(others.map(key => [key, 'x'])) });
        await importData(file({}, settings({})));
        const left = await chrome.storage.local.get(null);
        expect(left[KEY]).toBe(false);
        for (const key of others) expect(key in left).toBe(false);
    });

    it('a 1.0.0 file leaves every setting alone', async () => {
        await chrome.storage.local.set({ [KEY]: true, tabplex_ai_settings: { a: 1 } });
        await importData(file({ tasks: [makeTask()] }, {}, '1.0.0'));
        expect(await chrome.storage.local.get(null)).toMatchObject({ [KEY]: true, tabplex_ai_settings: { a: 1 } });
    });

    it('restoring a backup made from an older export keeps the current choice', async () => {
        await chrome.storage.local.set({
            [KEY]: false,
            [IMPORT_BACKUP_KEY]: file({ tasks: [makeTask()] }, { settings: { extension: {} } }),
        });
        await restoreImportBackup();
        markImportInThisTab(false);
        expect((await chrome.storage.local.get(KEY))[KEY]).toBe(false);
    });
});

describe('AC5: createdAt', () => {
    const builders: Record<string, () => unknown> = {
        boards: () => undated(makeBoard()),
        folders: () => undated(makeFolder()),
        tabs: () => undated(makeTab()),
        tasks: () => undated(makeTask()),
        notes: () => undated(makeNote()),
        sessions: () => undated(makeSession()),
        history: () => ({ id: 'h1', url: 'https://h.dev', title: 'H' }),
    };

    it.each(Object.keys(builders))('%s: a missing date becomes the epoch, with exactly one warning', name => {
        const { collections, warnings } = ok({
            [name]: [builders[name](), { ...(builders[name]() as object), id: 'two' }],
        });
        for (const item of (collections as any)[name]) expect(item.createdAt).toBe(EPOCH_ISO);
        expect(warnings.filter(w => w.includes('no creation date'))).toEqual([`${name}: 2 items had no creation date`]);
    });

    it('null counts as missing, an existing date is kept, and an empty text is kept', () => {
        const { collections, warnings } = ok({
            tasks: [
                { ...makeTask({ id: 'a' }), createdAt: null },
                makeTask({ id: 'b', createdAt: '2024-05-05T00:00:00.000Z' }),
                makeTask({ id: 'c', createdAt: '' }),
            ],
        });
        expect(collections.tasks.map(t => t.createdAt)).toEqual([EPOCH_ISO, '2024-05-05T00:00:00.000Z', '']);
        expect(warnings).toEqual(['tasks: 1 item had no creation date']);
    });

    it.each([[5], [true], [{}], [[]], [0]])('a createdAt of %j rejects the file and names the field', bad => {
        expect(errorsOf({ notes: [{ ...makeNote(), createdAt: bad }] })).toEqual(['notes[0].createdAt must be text']);
    });

    it('is idempotent: sanitizing the output again changes nothing and warns about nothing', () => {
        const first = ok({
            boards: [undated(makeBoard())],
            folders: [{ ...makeFolder(), boardId: 'gone' }],
            tabs: [
                { ...makeTab(), url: 'javascript:alert(1)' },
                { ...makeTab({ id: 'e' }), url: '' },
                undated(makeTab({ id: 'u' })),
            ],
            sessions: [{ id: 's', name: 'S' }],
            tasks: [{ ...makeTask(), tags: null }],
            history: [{ id: 'h', createdAt: '2026-01-01T00:00:00.000Z' }],
        });
        const second = ok(first.collections);
        expect(second.collections).toEqual(first.collections);
        expect(second.warnings).toEqual([]);
    });

    it('a board with no date can be imported and exported again (the file that loses no data)', async () => {
        await importData(file({ boards: [undated(makeBoard({ id: 'b' }))] }));
        const [board] = await db.getAllBoards();
        expect(board.createdAt).toBe(EPOCH_ISO);
    });
});

describe('AC6: list and settings shapes', () => {
    it.each([
        ['tabs', makeTab(), 'tags', 'a'],
        ['tabs', makeTab(), 'tags', [1]],
        ['tasks', makeTask(), 'tags', { 0: 'a' }],
        ['notes', makeNote(), 'tags', ['ok', null]],
        ['sessions', makeSession(), 'tabIds', 'x'],
        ['sessions', makeSession(), 'tabIds', [1]],
        ['tasks', makeTask(), 'tabIds', 'x'],
        ['tasks', makeTask(), 'tabIds', [['a']]],
        ['tasks', makeTask(), 'checklist', [{ id: 1 }]],
        ['tasks', makeTask(), 'checklist', [{ id: 'a', text: 'x', completed: 'yes' }]],
        ['tasks', makeTask(), 'checklist', [null]],
        ['tasks', makeTask(), 'checklist', 'x'],
        ['tasks', makeTask(), 'checklist', {}],
    ])('%s.%s = %j rejects with the field name', (name, item, field, value) => {
        const errors = errorsOf({ [name]: [{ ...item, [field]: value }] });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain(`${name}[0].${field}`);
    });

    it('does not mistake `checklists` (plural) for the checklist', () => {
        expect(() => ok({ tasks: [{ ...makeTask(), checklists: 'whatever' }] })).not.toThrow();
    });

    it('accepts good lists, empty lists and null (dropped)', () => {
        const value = ok({
            tasks: [
                {
                    ...makeTask({ id: 'a' }),
                    tags: ['x'],
                    tabIds: [],
                    checklist: [{ id: '1', text: 't', completed: false }],
                },
                { ...makeTask({ id: 'b' }), tags: null, tabIds: null, checklist: null },
            ],
            notes: [{ ...makeNote(), tags: null }],
            tabs: [{ ...makeTab(), tags: [] }],
        });
        expect(value.collections.tasks[0].checklist).toHaveLength(1);
        for (const key of ['tags', 'tabIds', 'checklist']) expect(key in value.collections.tasks[1]).toBe(false);
        expect('tags' in value.collections.notes[0]).toBe(false);
        expect(value.collections.tabs[0].tags).toEqual([]);
    });

    it('a session without tabIds (or with null) gets [] and one warning', () => {
        const { collections, warnings } = ok({
            sessions: [
                { id: 'a', name: 'A', startTime: 'x' },
                { id: 'b', name: 'B', startTime: 'x', tabIds: null },
                makeSession({ id: 'c', tabIds: ['t'] }),
            ],
        });
        expect(collections.sessions.map(s => s.tabIds)).toEqual([[], [], ['t']]);
        expect(warnings).toContain('sessions: 2 sessions had no tab list');
    });

    it.each([
        [{ settings: 'x' }, 'settings'],
        [{ settings: [] }, 'settings'],
        [{ settings: null }, 'settings'],
        [{ settings: { extension: 'x' } }, 'settings.extension'],
        [{ settings: { page: [] } }, 'settings.page'],
        [{ settings: { timer: 3 } }, 'settings.timer'],
        [{ settings: { timer: null } }, 'settings.timer'],
        [{ data: { canvasSettings: [] } }, 'canvasSettings'],
        [{ data: { canvasSettings: 'x' } }, 'canvasSettings'],
    ])('checkSettingsShape(%j) reports %s', (input, field) => {
        const errors = checkSettingsShape(input as never);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.join()).toContain(field);
    });

    it('checkSettingsShape accepts a missing block, empty objects and a null canvasSettings', () => {
        expect(checkSettingsShape({})).toEqual([]);
        expect(
            checkSettingsShape({ settings: { extension: {}, page: {}, timer: {} }, data: { canvasSettings: null } })
        ).toEqual([]);
        expect(checkSettingsShape({ data: 'garbage' })).toEqual([]);
    });

    it('importData rejects a damaged shape without touching the data, naming the field', async () => {
        await db.addTask(makeTask({ id: 'keep' }));
        for (const [bad, field] of [
            [file({}, { settings: 'x' }), 'settings'],
            [file({}, { settings: { timer: 3 } }), 'settings.timer'],
            [file({ canvasSettings: [] }), 'canvasSettings'],
            [file({ tasks: [{ ...makeTask(), checklist: [{ id: 1 }] }] }), 'tasks[0].checklist'],
        ] as const) {
            await expect(importData(bad)).rejects.toThrow(field);
            expect(() => previewImport(bad)).toThrow('The file is damaged');
        }
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['keep']);
    });

    it('collection errors and settings errors are reported together', () => {
        expect(() => previewImport(file({ tasks: [{ ...makeTask(), tags: 'a' }] }, { settings: 'x' }))).toThrow(
            /tasks\[0\]\.tags.*settings/
        );
    });
});

describe('AC6: timer settings are filtered', () => {
    const importTimer = async (timer: unknown) => {
        await importData(file({}, { settings: { extension: {}, page: {}, timer } }));
        return useTimerStore.getState().settings;
    };
    const defaults = () => useTimerStore.getInitialState().settings;

    it.each([
        ['workDuration', 0],
        ['workDuration', -5],
        ['workDuration', 1.5],
        ['workDuration', 1441],
        ['workDuration', '30'],
        ['workDuration', null],
        ['shortBreakDuration', 0],
        ['longBreakDuration', 100000],
        ['longBreakInterval', 0],
        ['longBreakInterval', 101],
        ['longBreakInterval', -1],
        ['soundEnabled', 'false'],
        ['autoStartBreaks', 1],
        ['autoStartWork', null],
    ])('drops %s = %j', async (key, value) => {
        expect((await importTimer({ [key]: value }))[key as keyof ReturnType<typeof defaults>]).toBe(
            defaults()[key as keyof ReturnType<typeof defaults>]
        );
    });

    it('drops Infinity (JSON 1e999) and NaN-like text', async () => {
        const settings = await (async () => {
            await importData(
                file({}, {}).replace(
                    '"timestamp"',
                    '"settings":{"timer":{"workDuration":1e999,"longBreakDuration":"NaN"}},"timestamp"'
                )
            );
            return useTimerStore.getState().settings;
        })();
        expect(settings.workDuration).toBe(defaults().workDuration);
        expect(settings.longBreakDuration).toBe(defaults().longBreakDuration);
    });

    it('keeps the bounds themselves and booleans of the right type', async () => {
        expect(
            await importTimer({
                workDuration: 1,
                shortBreakDuration: 1440,
                longBreakDuration: 7,
                longBreakInterval: 100,
                soundEnabled: false,
            })
        ).toMatchObject({
            workDuration: 1,
            shortBreakDuration: 1440,
            longBreakDuration: 7,
            longBreakInterval: 100,
            soundEnabled: false,
        });
    });

    it('ignores unknown keys, prototype keys and does not pollute anything', async () => {
        const settings = await importTimer(
            JSON.parse('{"evil":1,"__proto__":{"x":1},"constructor":5,"toString":"a","workDuration":30}')
        );
        expect(settings.workDuration).toBe(30);
        expect('evil' in settings).toBe(false);
        expect(({} as any).x).toBeUndefined();
        expect(Object.keys(settings).sort()).toEqual(Object.keys(defaults()).sort());
    });

    it('a timer block that is entirely junk leaves the settings as they were', async () => {
        useTimerStore.getState().updateSettings({ workDuration: 50 });
        expect(await importTimer({ workDuration: 0, nope: true })).toEqual({ ...defaults(), workDuration: 50 });
    });
});

describe('AC7: folders without a board', () => {
    afterEach(() => vi.useRealTimers());

    it('attaches folders with an unknown, empty or non-text boardId to a synthesized default_board, created once', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-25T10:00:00.000Z'));
        const { collections, warnings } = ok({
            boards: [makeBoard({ id: 'real' })],
            folders: [
                makeFolder({ id: 'f1', boardId: 'missing' }),
                makeFolder({ id: 'f2', boardId: '' }),
                { ...makeFolder({ id: 'f3' }), boardId: undefined },
                { ...makeFolder({ id: 'f4' }), boardId: 7 },
                makeFolder({ id: 'f5', boardId: 'real' }),
            ],
        });
        expect(collections.folders.map(f => f.boardId)).toEqual([
            'default_board',
            'default_board',
            'default_board',
            'default_board',
            'real',
        ]);
        expect(collections.boards.filter(b => b.id === 'default_board')).toEqual([
            {
                id: 'default_board',
                name: 'My Board',
                color: '#3b82f6',
                createdAt: '2026-10-25T10:00:00.000Z',
                updatedAt: '2026-10-25T10:00:00.000Z',
            },
        ]);
        expect(collections.boards.map(b => b.id)).toEqual(['real', 'default_board']);
        expect(warnings).toContain('folders: 4 folders without a board were moved to "My Board"');
    });

    it('works when the file has no boards at all', () => {
        const { collections } = ok({ folders: [makeFolder({ boardId: 'gone' })] });
        expect(collections.boards.map(b => b.id)).toEqual(['default_board']);
    });

    it('reuses an existing default_board and adds no board', () => {
        const existing = makeBoard({ id: 'default_board', name: 'Mine', createdAt: '2020-01-01T00:00:00.000Z' });
        const { collections, warnings } = ok({ boards: [existing], folders: [makeFolder({ boardId: 'gone' })] });
        expect(collections.boards).toEqual([existing]);
        expect(collections.folders[0].boardId).toBe('default_board');
        expect(warnings.some(w => w.includes('1 folder without a board'))).toBe(true);
    });

    it('does nothing and warns about nothing when every folder has its board', () => {
        const input = { boards: [makeBoard()], folders: [makeFolder()] };
        const { collections, warnings } = ok(input);
        expect(collections.boards).toHaveLength(1);
        expect(warnings).toEqual([]);
    });

    it('never touches tabs: session tabs (folderId empty) and dangling folder ids stay as they are', () => {
        const tabs = [
            makeTab({ id: 'session', folderId: '' }),
            makeTab({ id: 'dangling', folderId: 'no-such-folder' }),
            makeTab({ id: 'normal', folderId: 'f' }),
        ];
        const { collections } = ok({ folders: [makeFolder({ id: 'f', boardId: 'gone' })], tabs });
        expect(collections.tabs.map(t => t.folderId)).toEqual(['', 'no-such-folder', 'f']);
    });

    it('does not synthesize a board when the file is rejected for another reason', () => {
        const result = sanitizeCollections({ folders: [makeFolder({ boardId: 'gone' })], tasks: [{ id: 1 }] });
        expect(result.ok).toBe(false);
    });

    it('a folder already on default_board with no boards in the file still gets the board (nothing hidden)', () => {
        const { collections } = ok({ folders: [makeFolder({ boardId: 'default_board' })] });
        expect(collections.boards.map(b => b.id)).toEqual(['default_board']);
    });

    it('handles thousands of orphan folders at once', () => {
        const folders = Array.from({ length: 20000 }, (_, i) => makeFolder({ id: `f${i}`, boardId: `gone${i}` }));
        const { collections, warnings } = ok({ folders });
        expect(collections.folders.every(f => f.boardId === 'default_board')).toBe(true);
        expect(collections.boards).toHaveLength(1);
        expect(warnings.join()).toContain('20000 folders');
    });

    it('the preview lists the repairs and importData stores a visible folder', async () => {
        const text = file({
            folders: [makeFolder({ id: 'orph', boardId: 'gone' })],
            boards: [undated(makeBoard({ id: 'b' }))],
        });
        const summary = previewImport(text);
        expect(summary.warnings).toEqual(
            expect.arrayContaining([
                'folders: 1 folder without a board was moved to "My Board"',
                'boards: 1 item had no creation date',
            ])
        );
        expect(summary.counts.boards).toBe(2);
        await importData(text);
        const boardIds = (await db.getAllBoards()).map(b => b.id);
        expect((await db.getAllFolders())[0].boardId).toBe('default_board');
        expect(boardIds).toContain('default_board');
    });

    it('the background gets the repaired data and accepts it unchanged (UI and background agree)', async () => {
        const sent: any[] = [];
        respondToMessages(m => {
            sent.push(m);
            return m.type === 'IMPORT_ALL_DATA' ? { success: true } : undefined;
        });
        await importData(
            file({ folders: [makeFolder({ boardId: 'gone' })], sessions: [{ id: 's', name: 'S', startTime: 'x' }] })
        );
        const payload = sent.find(m => m.type === 'IMPORT_ALL_DATA').payload;
        const again = ok(payload);
        expect(again.warnings).toEqual([]);
        expect(again.collections.folders).toEqual(payload.folders);
        expect(again.collections.sessions).toEqual(payload.sessions);
    });
});

describe('AC8: rollback when applying fails', () => {
    const backupText = async () => (await chrome.storage.local.get(IMPORT_BACKUP_KEY))[IMPORT_BACKUP_KEY] as string;

    it('importData: a failure mid-apply puts the previous data back and rethrows the original error', async () => {
        await db.addTask(makeTask({ id: 'before' }));
        await db.addNote(makeNote({ id: 'n-before' }));
        const original = db.addNote;
        let failed = false;
        vi.spyOn(db, 'addNote').mockImplementation(async note => {
            if (!failed && note.id === 'n-new') {
                failed = true;
                throw new Error('disk full');
            }
            return original(note);
        });
        await expect(
            importData(file({ tasks: [makeTask({ id: 'after' })], notes: [makeNote({ id: 'n-new' })] }))
        ).rejects.toThrow('disk full');
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['before']);
        expect((await db.getAllNotes()).map(n => n.id)).toEqual(['n-before']);
        expect(isImportInThisTab()).toBe(false);
    });

    it('restoreImportBackup: a failure mid-apply puts the pre-restore data (and settings) back', async () => {
        await db.addTask(makeTask({ id: 'current' }));
        await chrome.storage.local.set({
            [KEY]: false,
            [IMPORT_BACKUP_KEY]: file(
                { tasks: [makeTask({ id: 'from-backup' })], notes: [makeNote({ id: 'bn' })] },
                { settings: { extension: { [KEY]: true }, page: {}, timer: {} } }
            ),
        });
        const stored = await backupText();
        const original = db.addNote;
        let failed = false;
        vi.spyOn(db, 'addNote').mockImplementation(async note => {
            if (!failed) {
                failed = true;
                throw new Error('idb down');
            }
            return original(note);
        });

        await expect(restoreImportBackup()).rejects.toThrow('idb down');

        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['current']);
        expect(await db.getAllNotes()).toEqual([]);
        // The backup's "recording on" was written by the failed restore, then undone by the rollback
        expect((await chrome.storage.local.get(KEY))[KEY]).toBe(false);
        expect(await backupText()).toBe(stored);
        expect(isImportInThisTab()).toBe(false);
    });

    it('restoreImportBackup: the background refusing the data rolls back and keeps the original message', async () => {
        await db.addTask(makeTask({ id: 'current' }));
        await chrome.storage.local.set({ [IMPORT_BACKUP_KEY]: file({ tasks: [makeTask({ id: 'old' })] }) });
        let calls = 0;
        respondToMessages(m => (m.type === 'IMPORT_ALL_DATA' && calls++ === 0 ? { error: 'refused' } : undefined));
        await expect(restoreImportBackup()).rejects.toThrow('refused');
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['current']);
    });

    it('restoreImportBackup: when the rollback fails too, the original error wins and it is logged', async () => {
        await db.addTask(makeTask({ id: 'current' }));
        await chrome.storage.local.set({ [IMPORT_BACKUP_KEY]: file({ tasks: [makeTask({ id: 'old' })] }) });
        respondToMessages(m => (m.type === 'IMPORT_ALL_DATA' ? { error: 'always' } : undefined));
        await expect(restoreImportBackup()).rejects.toThrow(/always/);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not restore'), expect.any(Error));
        expect(isImportInThisTab()).toBe(false);
    });

    it('restoreImportBackup: a missing, non-text or damaged backup throws before anything is written', async () => {
        await db.addTask(makeTask({ id: 'current' }));
        await expect(restoreImportBackup()).rejects.toThrow('no backup');
        await chrome.storage.local.set({ [IMPORT_BACKUP_KEY]: { not: 'text' } });
        await expect(restoreImportBackup()).rejects.toThrow('no backup');
        await chrome.storage.local.set({ [IMPORT_BACKUP_KEY]: file({}, { settings: 'x' }) });
        await expect(restoreImportBackup()).rejects.toThrow('damaged');
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['current']);
    });

    it('restoreImportBackup success: data restored, backup kept, the snapshot of "before" is not stored as the backup', async () => {
        await db.addTask(makeTask({ id: 'current' }));
        const backup = file({ tasks: [makeTask({ id: 'old' })] });
        await chrome.storage.local.set({ [IMPORT_BACKUP_KEY]: backup });
        await restoreImportBackup();
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['old']);
        expect(await backupText()).toBe(backup);
        const exported = JSON.parse(await exportData());
        expect(exported.data.tasks.map((t: any) => t.id)).toEqual(['old']);
    });

    it('an importData whose file is bad does not even take a backup', async () => {
        await expect(importData(file({ tasks: [{ id: 't', title: 'x', tags: 'a' }] }))).rejects.toThrow('tags');
        expect(await chrome.storage.local.get(IMPORT_BACKUP_KEY)).toEqual({});
        expect(fakeChrome().runtime.sendMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'IMPORT_ALL_DATA' })
        );
    });
});
