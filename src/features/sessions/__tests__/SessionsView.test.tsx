import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionsView from '../SessionsView';
import { useBoardStore } from '../../../store/boardStore';
import { fakeChrome, ChromeMock, FakeTab, installChromeMock, respondToMessages } from '../../../test/chromeMock';
import { makeSession, makeTab } from '../../../test/factories';
import { SESSION_NAME_MAX } from '../utils/sessionName';

let mock: ChromeMock;
let sessions: ReturnType<typeof makeSession>[];
let received: ReturnType<typeof respondToMessages>;

function renderView() {
    return render(<SessionsView />);
}

describe('SessionsView', () => {
    beforeEach(() => {
        mock = installChromeMock();
        sessions = [];
        useBoardStore.setState({ sessions: [], tabs: [] });
        received = respondToMessages(m => {
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

    it('trims and shortens a renamed session to the maximum length', async () => {
        sessions = [makeSession({ id: 's1', name: 'Old name' })];
        renderView();
        const card = (await screen.findByText('Old name')).closest('article')!;
        fireEvent.click(within(card).getByLabelText('Toggle actions menu'));
        fireEvent.click(within(card).getByRole('menuitem', { name: /Rename/ }));
        const input = within(card).getByLabelText('Session name');
        fireEvent.change(input, { target: { value: `  ${'n'.repeat(SESSION_NAME_MAX + 20)}  ` } });
        fireEvent.keyDown(input, { key: 'Enter' });

        await waitFor(() => expect(received.some(m => m.type === 'UPDATE_SESSION')).toBe(true));
        expect(received.find(m => m.type === 'UPDATE_SESSION')!.payload).toEqual({
            id: 's1',
            name: 'n'.repeat(SESSION_NAME_MAX),
        });
    });

    it('stores tabs without an id or title using the url as title and a null browser tab id', async () => {
        fakeChrome().tabs.query.mockImplementationOnce(async () => [{ url: 'https://a.test' }, {}] as FakeTab[]);
        renderView();
        fireEvent.click(screen.getByText('Start Session from Current Tabs'));
        await waitFor(() => expect(useBoardStore.getState().sessions).toHaveLength(1));

        const stored = useBoardStore.getState().tabs;
        expect(stored.map(t => t.tabId)).toEqual([null, null]);
        expect(stored.map(t => ({ title: t.title, url: t.url }))).toEqual([
            { title: 'https://a.test', url: 'https://a.test' },
            { title: '', url: '' },
        ]);
    });

    it('infers one session from visits that have no visit time, dated now', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const now = new Date('2026-10-05T12:00:00.000Z');
        vi.setSystemTime(now);
        fakeChrome().history.search.mockResolvedValueOnce([
            { url: 'https://docs.dev/a' },
            { url: 'https://docs.dev/b' },
            { url: 'https://docs.dev/c' },
        ]);
        renderView();
        fireEvent.click(screen.getByText('Infer Sessions from History'));

        await waitFor(() => expect(received.filter(m => m.type === 'ADD_SESSION')).toHaveLength(1));
        const added = received.find(m => m.type === 'ADD_SESSION')!.payload as {
            startTime: string;
            endTime: string;
            summary: string;
        };
        expect(added.startTime).toBe(now.toISOString());
        expect(added.endTime).toBe(now.toISOString());
        expect(added.summary).toBe('Browsing session with 3 related visits to docs.dev');
    });

    it('creates no session when visits to a domain are hours apart', async () => {
        const now = Date.now();
        fakeChrome().history.search.mockResolvedValueOnce([
            { url: 'https://docs.dev/a', lastVisitTime: now },
            { url: 'https://docs.dev/b', lastVisitTime: now - 2 * 3600_000 },
            { url: 'https://docs.dev/c', lastVisitTime: now - 4 * 3600_000 },
        ]);
        renderView();
        fireEvent.click(screen.getByText('Infer Sessions from History'));

        await waitFor(() => expect(fakeChrome().sessions.getRecentlyClosed).toHaveBeenCalled());
        expect(received.some(m => m.type === 'ADD_SESSION')).toBe(false);
    });

    it('infers from history alone when the sessions API is missing', async () => {
        Reflect.deleteProperty(fakeChrome(), 'sessions');
        const now = Date.now();
        fakeChrome().history.search.mockResolvedValueOnce([
            { url: 'https://docs.dev/a', lastVisitTime: now },
            { url: 'https://docs.dev/b', lastVisitTime: now - 1000 },
            { url: 'https://docs.dev/c', lastVisitTime: now - 2000 },
        ]);
        renderView();
        fireEvent.click(screen.getByText('Infer Sessions from History'));

        await waitFor(() => expect(received.filter(m => m.type === 'ADD_SESSION')).toHaveLength(1));
        expect(console.error).not.toHaveBeenCalled();
    });

    it('restores no tabs when the browser no longer has the session tabs', async () => {
        sessions = [makeSession({ id: 's1', name: 'Gone', tabIds: ['tab_1_42'] })];
        fakeChrome().tabs.get.mockImplementationOnce(async () => undefined as unknown as FakeTab);
        renderView();
        const card = (await screen.findByText('Gone')).closest('article')!;
        fireEvent.click(within(card).getAllByLabelText('Restore session tabs')[0]);

        await screen.findByText('Restored 0 tabs from session: Gone');
        expect(received.some(m => m.type === 'ADD_TAB')).toBe(false);
        expect(fakeChrome().tabs.create).not.toHaveBeenCalled();
    });

    it('recreates still-open session tabs, using the url or an empty title when there is no title', async () => {
        sessions = [makeSession({ id: 's1', name: 'Mixed', tabIds: ['tab_1_42', 'tab_1_43'] })];
        fakeChrome()
            .tabs.get.mockImplementationOnce(async () => ({ url: 'https://a.test' }) as FakeTab)
            .mockImplementationOnce(async () => ({}) as FakeTab);
        renderView();
        const card = (await screen.findByText('Mixed')).closest('article')!;
        fireEvent.click(within(card).getAllByLabelText('Restore session tabs')[0]);

        await screen.findByText('Restored 2 tabs from session: Mixed');
        const stored = useBoardStore.getState().tabs.map(t => ({ title: t.title, url: t.url, tabId: t.tabId }));
        expect(stored).toEqual([
            { title: 'https://a.test', url: 'https://a.test', tabId: 42 },
            { title: '', url: '', tabId: 43 },
        ]);
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
