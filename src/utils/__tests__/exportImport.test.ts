import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    downloadExportFile,
    EXPORT_VERSION,
    EXTENSION_SETTING_KEYS,
    exportData,
    importData,
    importFromFile,
    isImportInThisTab,
    markImportInThisTab,
    PAGE_SETTING_KEYS,
} from '../exportImport';
import { useTimerStore } from '../../store/timerStore';
import { BACKGROUND_TASKS_KEY } from '../taskContext';
import * as db from '../storage';
import { makeFolder, makeTask } from '../../test/factories';
import { fakeChrome, respondToMessages } from '../../test/chromeMock';

describe('export / import', () => {
    beforeEach(async () => {
        await db.clearAllData();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it('round-trips all data through JSON', async () => {
        await db.addTask(makeTask({ context: { state: 'parked', tabs: [{ url: 'https://x.dev', title: 'X' }] } }));
        await db.addFolder(makeFolder());
        const json = await exportData();
        const parsed = JSON.parse(json);
        expect(parsed.version).toBe(EXPORT_VERSION);
        expect(parsed.data.tasks[0].context.tabs).toHaveLength(1);
        expect(parsed.data.history).toEqual([]);

        await db.clearAllData();
        await importData(json);
        expect(await db.getAllTasks()).toEqual(parsed.data.tasks);
        expect(await db.getAllFolders()).toHaveLength(1);
    });

    it('replaces existing data on import and tolerates missing collections', async () => {
        await db.addTask(makeTask({ id: 'old' }));
        await importData(
            JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [makeTask({ id: 'new' })] } })
        );
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['new']);
        expect(await db.getAllNotes()).toEqual([]);
    });

    it('exports the history kept by the background', async () => {
        const history = [{ id: 'h1', url: 'https://h.dev', title: 'H', createdAt: '2026-10-01T00:00:00.000Z' }];
        respondToMessages(m => (m.type === 'GET_HISTORY' ? history : undefined));
        expect(JSON.parse(await exportData()).data.history).toEqual(history);

        // A background that can't answer doesn't block the export
        fakeChrome().runtime.sendMessage.mockResolvedValueOnce({ error: 'asleep' });
        expect(JSON.parse(await exportData()).data.history).toEqual([]);
        fakeChrome().runtime.sendMessage.mockRejectedValueOnce(new Error('no background'));
        expect(JSON.parse(await exportData()).data.history).toEqual([]);
    });

    it('sends the imported data to the background so both copies match', async () => {
        const sent: { type: string; payload?: Record<string, unknown[]> }[] = [];
        respondToMessages(m => {
            sent.push(m);
            return m.type === 'IMPORT_ALL_DATA' ? { success: true } : undefined;
        });
        const history = [{ id: 'h1', url: 'https://h.dev', title: 'H', createdAt: '2026-10-01T00:00:00.000Z' }];
        await importData(
            JSON.stringify({
                version: '1.0.0',
                timestamp: '',
                data: { tasks: [makeTask({ id: 'restored' })], folders: [makeFolder({ id: 'f' })], history },
            })
        );
        const imported = sent.find(m => m.type === 'IMPORT_ALL_DATA');
        expect(imported?.payload?.tasks.map(t => (t as { id: string }).id)).toEqual(['restored']);
        expect(imported?.payload?.folders).toHaveLength(1);
        expect(imported?.payload?.boards).toEqual([]);
        expect(imported?.payload?.history).toEqual(history);
    });

    it('keeps the current history when the file has none (exports made before history was included)', async () => {
        const current = [{ id: 'keep', url: 'https://k.dev', title: 'K', createdAt: '2026-10-01T00:00:00.000Z' }];
        let payload: Record<string, unknown[]> | undefined;
        respondToMessages(m => {
            if (m.type === 'GET_HISTORY') return current;
            if (m.type === 'IMPORT_ALL_DATA') payload = m.payload;
            return { success: true };
        });
        await importData(JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [], history: [] } }));
        expect(payload?.history).toEqual(current);
    });

    it('fails the import when the background rejects it', async () => {
        respondToMessages(m => (m.type === 'IMPORT_ALL_DATA' ? { error: 'Import timed out' } : []));
        await expect(
            importData(JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [] } }))
        ).rejects.toThrow('Import timed out');
        // The tab goes back to reacting to imports made elsewhere
        expect(isImportInThisTab()).toBe(false);
    });

    it('marks this tab as the importer while the background imports', async () => {
        let duringImport: boolean | undefined;
        respondToMessages(m => {
            if (m.type === 'IMPORT_ALL_DATA') duringImport = isImportInThisTab();
            return { success: true };
        });
        await importData(JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [] } }));
        expect(duringImport).toBe(true);
        // Stays set: the page reloads itself once the success toast has been shown
        expect(isImportInThisTab()).toBe(true);
        markImportInThisTab(false);
    });

    it('rejects unsupported versions and invalid JSON', async () => {
        await expect(importData(JSON.stringify({ version: '9.0.0', data: {} }))).rejects.toThrow(
            'Unsupported export version'
        );
        await expect(importData('{nope')).rejects.toThrow();
    });

    describe('canvases and settings (2.0.0)', () => {
        const timerDefaults = useTimerStore.getState().settings;
        afterEach(() => useTimerStore.getState().updateSettings(timerDefaults));

        const canvases = [{ id: 'c1', name: 'Plan', elements: [{ id: 'e1', type: 'rectangle' }] }];
        const canvasSettings = { gridSize: 20, showGrid: false };

        async function seedEverything() {
            await chrome.storage.local.set({ canvases, canvasSettings });
            await chrome.storage.local.set(
                Object.fromEntries(EXTENSION_SETTING_KEYS.map((key, i) => [key, { marker: `ext-${i}` }]))
            );
            PAGE_SETTING_KEYS.forEach((key, i) => localStorage.setItem(key, `page-${i}`));
            useTimerStore.getState().updateSettings({ workDuration: 50, soundEnabled: false });
        }

        async function wipeEverything() {
            await chrome.storage.local.clear();
            localStorage.clear();
            useTimerStore.getState().updateSettings(timerDefaults);
        }

        it('exports every canvas and listed setting, and restores them all', async () => {
            await seedEverything();
            const json = await exportData();
            const parsed = JSON.parse(json);
            expect(parsed.data.canvases).toEqual(canvases);
            expect(parsed.data.canvasSettings).toEqual(canvasSettings);
            expect(Object.keys(parsed.settings.extension).sort()).toEqual([...EXTENSION_SETTING_KEYS].sort());
            expect(Object.keys(parsed.settings.page).sort()).toEqual([...PAGE_SETTING_KEYS].sort());
            expect(parsed.settings.timer).toMatchObject({ workDuration: 50, soundEnabled: false });

            await wipeEverything();
            await importData(json);

            const stored = await chrome.storage.local.get(null);
            expect(stored.canvases).toEqual(canvases);
            expect(stored.canvasSettings).toEqual(canvasSettings);
            EXTENSION_SETTING_KEYS.forEach((key, i) => expect(stored[key]).toEqual({ marker: `ext-${i}` }));
            PAGE_SETTING_KEYS.forEach((key, i) => expect(localStorage.getItem(key)).toBe(`page-${i}`));
            expect(useTimerStore.getState().settings).toMatchObject({ workDuration: 50, soundEnabled: false });
        });

        it('leaves out the tldraw room, which names a database the file does not contain', async () => {
            localStorage.setItem('tabboard_tldraw_room', 'room-1');
            expect(JSON.parse(await exportData()).settings.page).not.toHaveProperty('tabboard_tldraw_room');
        });

        it('a 2.0.0 import is a full restore: settings missing from the file are removed', async () => {
            await seedEverything();
            const empty = { version: EXPORT_VERSION, timestamp: '', data: {}, settings: { extension: {}, page: {} } };
            await importData(JSON.stringify(empty));

            const stored = await chrome.storage.local.get(null);
            expect(stored.canvases).toEqual([]);
            expect(stored).not.toHaveProperty('canvasSettings');
            EXTENSION_SETTING_KEYS.forEach(key => expect(stored).not.toHaveProperty(key));
            PAGE_SETTING_KEYS.forEach(key => expect(localStorage.getItem(key)).toBeNull());
            // No timer settings in the file: keep the current ones
            expect(useTimerStore.getState().settings.workDuration).toBe(50);
        });

        it('a 1.0.0 import keeps the current canvases and settings', async () => {
            await seedEverything();
            await importData(JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [] } }));

            const stored = await chrome.storage.local.get(null);
            expect(stored.canvases).toEqual(canvases);
            expect(stored[EXTENSION_SETTING_KEYS[0]]).toEqual({ marker: 'ext-0' });
            expect(localStorage.getItem(PAGE_SETTING_KEYS[0])).toBe('page-0');
        });
    });

    it("exports the background's newer task context when IndexedDB lags behind", async () => {
        await db.addTask(
            makeTask({ id: 't', updatedAt: '2026-10-01T00:00:00.000Z', context: { state: 'active', tabs: [] } })
        );
        const parked = makeTask({
            id: 't',
            updatedAt: '2026-10-02T00:00:00.000Z',
            context: { state: 'parked', tabs: [{ url: 'https://p.dev', title: 'P' }] },
        });
        await chrome.storage.local.set({ [BACKGROUND_TASKS_KEY]: [parked] });

        const [task] = JSON.parse(await exportData()).data.tasks;
        expect(task.context).toEqual(parked.context);
    });

    it('surfaces export failures', async () => {
        vi.spyOn(db, 'getAllBoards').mockRejectedValueOnce(new Error('db down'));
        await expect(exportData()).rejects.toThrow('db down');
    });

    it('downloads a dated JSON file', async () => {
        const createObjectURL = vi.fn(() => 'blob:x');
        const revokeObjectURL = vi.fn();
        Object.assign(URL, { createObjectURL, revokeObjectURL });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

        await downloadExportFile();

        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(click).toHaveBeenCalled();
        const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
        expect(anchor.download).toMatch(/^tabplex-export-\d{4}-\d{2}-\d{2}\.json$/);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    });

    it('reports download failures', async () => {
        vi.spyOn(db, 'getAllTasks').mockRejectedValueOnce(new Error('boom'));
        await expect(downloadExportFile()).rejects.toThrow('boom');
    });

    it('imports from a File and reports read/parse errors', async () => {
        const json = JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [makeTask({ id: 'f' })] } });
        await importFromFile(new File([json], 'export.json'));
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['f']);

        await expect(importFromFile(new File(['oops'], 'bad.json'))).rejects.toThrow();

        const original = FileReader.prototype.readAsText;
        FileReader.prototype.readAsText = function () {
            this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
        };
        try {
            await expect(importFromFile(new File(['x'], 'x.json'))).rejects.toThrow('Failed to read file');
        } finally {
            FileReader.prototype.readAsText = original;
        }
    });
});
