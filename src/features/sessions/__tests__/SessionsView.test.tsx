import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionsView from '../SessionsView';
import { useBoardStore } from '../../../store/boardStore';
import { fakeChrome, ChromeMock, installChromeMock, respondToMessages } from '../../../test/chromeMock';
import { makeSession, makeTab } from '../../../test/factories';

let mock: ChromeMock;
let sessions: ReturnType<typeof makeSession>[];

function renderView() {
    return render(<SessionsView />);
}

describe('SessionsView', () => {
    beforeEach(() => {
        mock = installChromeMock();
        sessions = [];
        useBoardStore.setState({ sessions: [], tabs: [] });
        respondToMessages(m => {
            if (m.type === 'GET_SESSIONS') return sessions;
            if (['ADD_SESSION', 'UPDATE_SESSION', 'DELETE_SESSION', 'ADD_TAB'].includes(m.type))
                return { success: true };
            return undefined;
        });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('shows the empty state and creates a named session', async () => {
        renderView();
        expect(await screen.findByText(/No sessions found/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('+ Create New Session'));
        fireEvent.click(screen.getByText('Create')); // empty name ignored
        fireEvent.change(screen.getByPlaceholderText('Enter session name'), { target: { value: 'Deep work' } });
        fireEvent.click(screen.getByText('Create'));
        await screen.findByText('Deep work');
        fireEvent.click(screen.getByText('+ Create New Session'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.queryByPlaceholderText('Enter session name')).not.toBeInTheDocument();
    });

    it('starts a session from the current window tabs', async () => {
        const known = mock.browser.addTab({ url: 'https://known.dev', title: 'Known' });
        mock.browser.addTab({ url: 'https://new.dev' });
        mock.browser.addTab({ url: '' });
        useBoardStore.setState({ tabs: [makeTab({ id: 'stored', tabId: known.id })] });
        renderView();
        fireEvent.click(screen.getByText('Start Session from Current Tabs'));
        await waitFor(() => expect(useBoardStore.getState().sessions).toHaveLength(1));
        const session = useBoardStore.getState().sessions[0];
        expect(session.tabIds[0]).toBe('stored');
        expect(session.tabIds).toHaveLength(3);
        expect(session.summary).toBe('Session with 3 tabs from current window');
    });

    it('logs failures when starting from current tabs', async () => {
        fakeChrome().tabs.query.mockRejectedValueOnce(new Error('no tabs'));
        renderView();
        fireEvent.click(screen.getByText('Start Session from Current Tabs'));
        await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith('Error creating session from current tabs:', expect.any(Error))
        );
    });

    it('infers sessions from history clusters and recently closed tabs', async () => {
        const now = Date.now();
        fakeChrome().history.search.mockResolvedValueOnce([
            { url: 'https://docs.dev/a', lastVisitTime: now - 1000 },
            { url: 'https://docs.dev/b', lastVisitTime: now - 2000 },
            { url: 'https://docs.dev/c', lastVisitTime: now - 3 * 3600_000 },
            { url: 'https://docs.dev/d', lastVisitTime: now - 3 * 3600_000 - 1000 },
            { url: 'https://docs.dev/e', lastVisitTime: now - 9 * 3600_000 },
            { url: 'https://www.google.com/search', lastVisitTime: now },
            { url: 'https://www.google.com/x', lastVisitTime: now },
            { url: 'https://www.google.com/y', lastVisitTime: now },
            { url: 'https://one.dev', lastVisitTime: now },
            { url: 'not a url' },
            {},
        ]);
        fakeChrome().sessions.getRecentlyClosed.mockResolvedValueOnce([
            { tab: { url: 'https://closed.dev/x', windowId: 1 } },
            { tab: { url: 'https://closed2.dev/x' } },
            { tab: {} },
            { window: {} },
        ]);
        renderView();
        fireEvent.click(screen.getByText('Infer Sessions from History'));
        await waitFor(() => expect(useBoardStore.getState().sessions).toHaveLength(4));
        const names = useBoardStore.getState().sessions.map(s => s.name);
        expect(names.filter(n => n.startsWith('docs.dev'))).toHaveLength(2);
        expect(names).toContain('Recently Closed: closed.dev');
        expect(names).toContain('Recently Closed: closed2.dev');
    });

    it('skips recently closed tabs that already have a recent session, and logs errors', async () => {
        sessions = [makeSession({ name: 'Recently Closed: closed.dev', startTime: new Date().toISOString() })];
        fakeChrome().sessions.getRecentlyClosed.mockResolvedValueOnce([{ tab: { url: 'https://closed.dev/x' } }]);
        renderView();
        await screen.findByText('Recently Closed: closed.dev');
        fireEvent.click(screen.getByText('Infer Sessions from History'));
        await waitFor(() => expect(fakeChrome().sessions.getRecentlyClosed).toHaveBeenCalled());
        expect(useBoardStore.getState().sessions).toHaveLength(1);

        fakeChrome().history.search.mockRejectedValueOnce(new Error('denied'));
        fireEvent.click(screen.getByText('Infer Sessions from History'));
        await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error inferring sessions:', expect.any(Error)));
    });

    it('restores, ends and deletes sessions', async () => {
        const live = mock.browser.addTab({ url: 'https://live.dev', title: 'Live' });
        sessions = [
            makeSession({
                id: 's1',
                name: 'Active one',
                tabIds: ['stored', `tab_1_${live.id}`, 'tab_1_99999', 'bad'],
                summary: 'Sum',
            }),
            makeSession({
                id: 's2',
                name: 'Done one',
                endTime: '2026-10-03T12:30:00Z',
                startTime: '2026-10-03T10:00:00Z',
            }),
        ];
        useBoardStore.setState({ tabs: [makeTab({ id: 'stored', url: 'https://stored.dev' })] });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        renderView();
        const active = (await screen.findByText('Active one')).closest('article')!;
        fireEvent.click(within(active).getAllByLabelText('Restore session tabs')[0]);
        await screen.findByText('Restored 2 tabs from session: Active one');
        expect(fakeChrome().tabs.create).toHaveBeenCalledWith({ url: 'https://stored.dev', active: false });

        fireEvent.click(within(active).getAllByLabelText('End session')[0]);
        await waitFor(() => expect(useBoardStore.getState().sessions[0].endTime).toBeDefined());

        const ended = screen.getByText('Done one').closest('article')!;
        fireEvent.click(within(ended).getAllByLabelText('Delete session').slice(-1)[0]);
        await waitFor(() => expect(useBoardStore.getState().sessions.map(s => s.id)).toEqual(['s1']));
    });

    it('reports restore problems', async () => {
        sessions = [makeSession({ id: 's1', name: 'No tabs', tabIds: undefined as unknown as string[] })];
        renderView();
        const card = (await screen.findByText('No tabs')).closest('article')!;
        fireEvent.click(within(card).getAllByLabelText('Restore session tabs')[0]);
        await screen.findByText('This session has no tabs to restore.');

        act(() => useBoardStore.setState({ sessions: [makeSession({ id: 's2', name: 'Broken', tabIds: ['x'] })] }));
        fakeChrome().tabs.create.mockRejectedValueOnce(new Error('cannot open'));
        useBoardStore.setState({ tabs: [makeTab({ id: 'x' })] });
        const broken = (await screen.findByText('Broken')).closest('article')!;
        fireEvent.click(within(broken).getAllByLabelText('Restore session tabs')[0]);
        await screen.findByText('Error restoring session. Please try again.');
    });
});
