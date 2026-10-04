import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    downloadExportFile,
    exportData,
    importData,
    importFromFile,
    isImportInThisTab,
    markImportInThisTab,
} from '../exportImport';
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
        expect(parsed.version).toBe('1.0.0');
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
        await expect(importData(JSON.stringify({ version: '2.0.0', data: {} }))).rejects.toThrow(
            'Unsupported export version'
        );
        await expect(importData('{nope')).rejects.toThrow();
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
