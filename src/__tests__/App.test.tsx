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
            if (m.type === 'GET_USER_INFO') return { email: 'me@example.com' };
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
            expect((await screen.findAllByText(text, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
        }
    });

    it('navigates with the nav bar and opens the command palette', async () => {
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        fireEvent.click(screen.getByRole('button', { name: /Boards/ }));
        await waitFor(() => expect(window.location.hash).toBe('#/boards'));
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        expect(await screen.findByText('Resume "Parked work"')).toBeInTheDocument();
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });

    it('opens the park dialog from the header pill', async () => {
        render(<App />);
        await screen.findAllByText('Parked work', {}, { timeout: 3000 });
        fireEvent.click(document.querySelector('.active-context-park')!);
        expect(await screen.findByRole('dialog', { name: /Park “Active work”/ })).toBeInTheDocument();
    });
});
