import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../storage';
import { makeBoard, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../test/factories';

const collections = [
    ['Board', makeBoard],
    ['Folder', makeFolder],
    ['Tab', makeTab],
    ['Task', makeTask],
    ['Note', makeNote],
    ['Session', makeSession],
] as const;

type Api = Record<string, (...args: unknown[]) => Promise<unknown>>;
const api = db as unknown as Api;

describe('IndexedDB storage', () => {
    beforeEach(async () => {
        await db.clearAllData();
    });

    it('initialises once and reuses the connection', async () => {
        const first = await db.initDB();
        expect(await db.initDB()).toBe(first);
        expect([...first.objectStoreNames].sort()).toEqual(['boards', 'folders', 'notes', 'sessions', 'tabs', 'tasks']);
    });

    it.each(collections)('supports CRUD for %s', async (name, make) => {
        const item = make({ id: `${name}-1` } as never);
        await api[`add${name}`](item);
        await api[`add${name}`](item); // put: adding twice is safe
        expect(await api[`get${name}`](`${name}-1`)).toEqual(item);

        const updated = { ...item, updatedAt: 'changed' };
        await api[`update${name}`](updated);
        expect(await api[`getAll${name}s`]()).toEqual([updated]);

        await api[`delete${name}`](`${name}-1`);
        expect(await api[`get${name}`](`${name}-1`)).toBeUndefined();
    });

    it('clearAllData empties every store', async () => {
        await db.addTask(makeTask());
        await db.addNote(makeNote());
        await db.clearAllData();
        expect(await db.getAllTasks()).toEqual([]);
        expect(await db.getAllNotes()).toEqual([]);
    });
});
