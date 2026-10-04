import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { useBoardStore } from '../store/boardStore';
import { useUIStore } from '../features/ui/store/uiStore';
import * as db from '../utils/storage';
import { respondToMessages } from '../test/chromeMock';
import { makeBoard, makeContext, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../test/factories';

// Canvas engines draw on <canvas>/WebGL and are covered by the E2E suite
vi.mock('../features/canvas/components/CanvasContainer', () => ({ default: () => <div>custom canvas</div> }));
vi.mock('../features/canvas/components/TldrawContainer', () => ({ default: () => <div>tldraw canvas</div> }));

async function seed() {
    await db.addBoard(makeBoard());
    await db.addFolder(makeFolder());
    await db.addTab(makeTab({ status: 'open' }));
    await db.addTask(
        makeTask({ id: 't-active', title: 'Active work', status: 'doing', context: makeContext({ state: 'active' }) })
    );
    await db.addTask(
        makeTask({ id: 't-parked', title: 'Parked work', context: makeContext({ resumeNote: 'left at VAT' }) })
    );
    await db.addTask(
        makeTask({ id: 't-done', title: 'Finished', status: 'done', completedAt: new Date().toISOString() })
    );
    await db.addNote(makeNote({ title: 'Meeting notes', createdAt: new Date().toISOString() }));
    await db.addSession(makeSession({ endTime: new Date().toISOString() }));
}

const go = async (hash: string) => {
    await act(async () => {
        window.location.hash = hash;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
};

describe('App', () => {
    beforeEach(async () => {
        await db.clearAllData();
        useBoardStore.setState({ boards: [], folders: [], tabs: [], tasks: [], notes: [], sessions: [], history: [] });
        useUIStore.setState({ activeView: 'today', toast: null, parkDialogTaskId: null, isCommandPaletteOpen: false });
        window.location.hash = '#/today';
        respondToMessages(m => {
            if (m.type === 'GET_BOOKMARKS')
                return [
                    {
                        id: '0',
                        title: '',
                        children: [
                            {
                                id: '1',
                                title: 'Bookmarks bar',
                                children: [{ id: '10', parentId: '1', title: 'GitHub', url: 'https://github.com' }],
                            },
                        ],
                    },
                ];
            if (m.type === 'GET_HISTORY' || m.type === 'GET_BROWSER_HISTORY') return [];
            return undefined;
        });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await seed();
    });

    it('loads data and renders every view', async () => {
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        expect(screen.getByText('Pick up where you left off')).toBeInTheDocument();
        expect(screen.getByText(/Active work/, { selector: '.active-context-title' })).toBeInTheDocument();

        const visits: [string, RegExp][] = [
            ['#/boards', /Inbox/],
            ['#/sessions', /Morning/],
            ['#/analytics', /Park & Resume · last 7 days/],
            ['#/canvas', /custom canvas/],
            ['#/bookmarks', /GitHub/],
            ['#/notes', /Meeting notes/],
            ['#/tasks', /Parked work/],
            ['#/pomodoro', /Focus|Pomodoro|Work/i],
            ['#/history', /History/i],
            ['#/settings', /Close tabs when parking/],
            ['#/unknown', /Pick up where you left off/],
        ];
        for (const [hash, text] of visits) {
            await go(hash);
            // Each view is lazy-loaded: the first visit compiles it, which is slow under coverage on a busy machine
            expect((await screen.findAllByText(text, {}, { timeout: 10_000 })).length).toBeGreaterThan(0);
        }
    }, 60_000); // visits all 11 lazy-loaded views

    it('navigates with the nav bar and opens the command palette', async () => {
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        fireEvent.click(screen.getByRole('button', { name: /Boards/ }));
        await waitFor(() => expect(window.location.hash).toBe('#/boards'));
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        expect(await screen.findByText('Resume "Parked work"')).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

        // Header buttons
        fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
        await waitFor(() => expect(window.location.hash).toBe('#/settings'));
        fireEvent.click(screen.getByRole('button', { name: 'Open command palette' }));
        expect(await screen.findByText('Resume "Parked work"')).toBeInTheDocument();
    });

    it.each([
        ['Parked', '#/tasks'], // tasks open the Tasks view (Today only lists today's work)
        ['Meeting', '#/notes'], // notes open the Notes view
        ['Inbox', '#/boards'], // folders open Boards
        ['Morning', '#/sessions'],
    ])('opens the right view for a "%s" search result', async (query, hash) => {
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        await go('#/settings');
        fireEvent.change(screen.getByPlaceholderText('Search tabs, tasks, notes...'), { target: { value: query } });
        fireEvent.keyDown(screen.getByPlaceholderText('Search tabs, tasks, notes...'), { key: 'Enter' });
        await waitFor(() => expect(window.location.hash).toBe(hash));
    });

    it('exports from the shortcut event and reports success or failure', async () => {
        Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });

        act(() => {
            window.dispatchEvent(new CustomEvent('exportData'));
        });
        expect(await screen.findByText('Data exported successfully!')).toBeInTheDocument();

        vi.spyOn(db, 'getAllBoards').mockRejectedValueOnce(new Error('db down'));
        act(() => {
            window.dispatchEvent(new CustomEvent('exportData'));
        });
        expect(await screen.findByText('Export failed. Please try again.')).toBeInTheDocument();
    });

    it('imports a file: success shows a toast then reloads once; a bad file shows an error', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const pick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        await go('#/settings');
        await screen.findAllByText(/Close tabs when parking/, {}, { timeout: 3000 });
        // Swap in a reload spy only now: a fake location object would break hash routing
        const reload = vi.fn();
        const realLocation = window.location;
        Object.defineProperty(window, 'location', { value: { ...realLocation, reload }, configurable: true });

        act(() => {
            window.dispatchEvent(new CustomEvent('importData')); // keyboard shortcut / command palette
        });
        expect(pick).toHaveBeenCalled();

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const json = JSON.stringify({ version: '1.0.0', timestamp: '', data: { tasks: [makeTask({ id: 'imp' })] } });
        fireEvent.change(input, { target: { files: [new File([json], 'backup.json')] } });
        expect(await screen.findByText('Data imported successfully! Reloading...')).toBeInTheDocument();
        await waitFor(() => expect(reload).toHaveBeenCalledTimes(1), { timeout: 5000 }); // reload is scheduled 1.5 s after the toast;
        expect((await db.getAllTasks()).map(t => t.id)).toEqual(['imp']);

        fireEvent.change(input, { target: { files: [new File(['not json'], 'bad.json')] } });
        expect(await screen.findByText('Import failed. Please check the file format.')).toBeInTheDocument();
        fireEvent.change(input, { target: { files: [] } }); // dialog cancelled: nothing happens
        Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
    });

    it('opens the park dialog from the header pill', async () => {
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        fireEvent.click(document.querySelector('.active-context-park')!);
        expect(await screen.findByRole('dialog', { name: /Park “Active work”/ })).toBeInTheDocument();
    });
});
