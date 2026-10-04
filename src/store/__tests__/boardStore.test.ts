import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardStore } from '../boardStore';
import * as db from '../../utils/storage';
import { respondToMessages, flushPromises } from '../../test/chromeMock';
import { makeBoard, makeFolder, makeNote, makeSession, makeTab, makeTask } from '../../test/factories';

const store = () => useBoardStore.getState();
const types = (messages: { type: string }[]) => messages.map(m => m.type);

describe('board store', () => {
    let messages: { type: string; payload?: unknown }[];

    beforeEach(async () => {
        useBoardStore.setState({
            boards: [],
            folders: [],
            tabs: [],
            tasks: [],
            notes: [],
            sessions: [],
            history: [],
            bookmarks: [],
            bookmarkTree: [],
            isLoading: false,
            error: null,
        });
        await db.clearAllData();
        messages = respondToMessages();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    describe('boards & folders', () => {
        it('adds, updates and deletes boards, notifying the background', async () => {
            store().addBoard({ id: 'b1', name: 'Work' });
            expect(store().boards[0]).toMatchObject({ id: 'b1', createdAt: expect.any(String) });
            store().updateBoard('b1', { name: 'Home' });
            store().updateBoard('missing', { name: 'x' });
            expect(store().boards[0].name).toBe('Home');
            store().addBoardSilently(makeBoard({ id: 'b2' }));
            store().addBoardSilently(makeBoard({ id: 'b2' }));
            expect(store().boards).toHaveLength(2);
            store().deleteBoard('b1');
            store().deleteBoardSilently('b2');
            expect(store().boards).toEqual([]);
            await flushPromises();
            // Edits reach the background and other open tabs too
            expect(types(messages)).toEqual(['ADD_BOARD', 'UPDATE_BOARD', 'DELETE_BOARD']);
            expect(messages[1].payload).toEqual(expect.objectContaining({ id: 'b1', name: 'Home' }));
            expect((await db.getAllBoards()).length).toBe(0); // deleted at the end
        });

        it('adds folders and deletes them, moving or dropping their tabs', async () => {
            store().addFolder({ id: 'f1', name: 'A', boardId: 'b', color: '#000', order: 0 });
            store().addFolderSilently(makeFolder({ id: 'f2' }));
            store().addFolderSilently(makeFolder({ id: 'f2' }));
            store().updateFolder('f1', { name: 'Renamed' });
            store().updateFolder('missing', { name: 'x' });
            expect(store().folders.map(f => f.name)).toEqual(['Renamed', 'Inbox']);

            useBoardStore.setState({
                tabs: [makeTab({ id: 't1', folderId: 'f1' }), makeTab({ id: 't2', folderId: 'f2' })],
            });
            store().deleteFolder('f1', true, 'f2');
            expect(store().tabs.map(t => t.folderId)).toEqual(['f2', 'f2']);
            store().deleteFolderSilently('f2');
            expect(store().tabs).toEqual([]);

            useBoardStore.setState({ folders: [makeFolder({ id: 'f3' })], tabs: [makeTab({ folderId: 'f3' })] });
            store().deleteFolder('f3');
            expect(store().tabs).toEqual([]);
            store().addFolderSilently(makeFolder({ id: 'f4' }));
            store().deleteFolderSilently('f4', true, 'f9');
            await flushPromises();
            expect(types(messages)).toEqual(['ADD_FOLDER', 'UPDATE_FOLDER', 'DELETE_FOLDER', 'DELETE_FOLDER']);
            expect(messages[1].payload).toEqual(expect.objectContaining({ id: 'f1', name: 'Renamed' }));
            expect(messages[2].payload).toEqual({ id: 'f1', moveTabs: true, targetFolderId: 'f2' });
        });
    });

    describe('tabs', () => {
        it('adds tabs with an order, updates, moves and deletes them', async () => {
            store().addTab({
                id: 't1',
                title: 'A',
                url: 'https://a',
                folderId: 'f1',
                tabId: null,
                lastAccessed: '',
                status: 'open',
            });
            store().addTab({
                id: 't2',
                title: 'B',
                url: 'https://b',
                folderId: 'f1',
                tabId: null,
                lastAccessed: '',
                status: 'open',
            });
            expect(store().tabs.map(t => t.order)).toEqual([0, 1]);
            store().updateTab('t1', { title: 'A2' });
            store().moveTab('t1', 'f2');
            store().moveTab('missing', 'f2');
            expect(store().tabs[0]).toMatchObject({ title: 'A2', folderId: 'f2' });
            store().moveAllTabsToFolder('f2', 'f3');
            expect(store().tabs[0].folderId).toBe('f3');
            store().deleteTab('t1');
            store().deleteTabSilently('t2');
            expect(store().tabs).toEqual([]);
            await flushPromises();
            // updateTab, moveTab and moveAllTabsToFolder each sync the changed tab; a missing tab sends nothing
            expect(types(messages)).toEqual([
                'ADD_TAB',
                'ADD_TAB',
                'UPDATE_TAB',
                'UPDATE_TAB',
                'UPDATE_TAB',
                'DELETE_TAB',
            ]);
            expect(messages.slice(2, 5).map(m => m.payload)).toEqual([
                expect.objectContaining({ id: 't1', title: 'A2', folderId: 'f1' }),
                expect.objectContaining({ id: 't1', folderId: 'f2' }),
                expect.objectContaining({ id: 't1', folderId: 'f3' }),
            ]);
            await flushPromises();
            expect(await db.getAllTabs()).toEqual([]);
        });

        it('reorders tabs within a folder', async () => {
            useBoardStore.setState({
                tabs: [
                    makeTab({ id: 'a', order: 0 }),
                    makeTab({ id: 'b', order: 1 }),
                    makeTab({ id: 'c' }),
                    makeTab({ id: 'x', folderId: 'other' }),
                ],
            });
            store().reorderTab('c', 0, 'folder_1');
            await flushPromises();
            // Only tabs whose order changed are saved and synced
            expect(messages.filter(m => m.type === 'UPDATE_TAB').map(m => (m.payload as { id: string }).id)).toEqual([
                'c',
                'a',
                'b',
            ]);
            const inFolder = store().tabs.filter(t => t.folderId === 'folder_1');
            expect(inFolder.map(t => [t.id, t.order])).toEqual([
                ['c', 0],
                ['a', 1],
                ['b', 2],
            ]);
            const before = store().tabs;
            store().reorderTab('missing', 0, 'folder_1');
            expect(store().tabs).toBe(before);
        });
    });

    describe('tasks', () => {
        it('adds, updates (tracking completion) and deletes tasks', async () => {
            store().addTask({ id: 't1', title: 'T', status: 'todo', priority: 'low' });
            store().updateTask('t1', { status: 'done' });
            const done = store().tasks[0];
            expect(done.completedAt).toEqual(expect.any(String));
            store().updateTask('t1', { title: 'renamed' });
            expect(store().tasks[0].completedAt).toBe(done.completedAt);
            store().updateTask('t1', { status: 'doing' });
            expect(store().tasks[0].completedAt).toBeUndefined();
            store().updateTask('missing', { title: 'x' });
            await flushPromises();
            expect(types(messages)).toEqual(['ADD_TASK', 'UPDATE_TASK', 'UPDATE_TASK', 'UPDATE_TASK']);
            expect((await db.getTask('t1'))?.title).toBe('renamed');

            store().upsertTaskSilently(makeTask({ id: 't2' }));
            store().upsertTaskSilently(makeTask({ id: 't2', title: 'updated' }));
            expect(store().tasks.map(t => t.title)).toEqual(['renamed', 'updated']);
            store().deleteTask('t1');
            store().deleteTaskSilently('t2');
            expect(store().tasks).toEqual([]);
            await flushPromises();
            expect(types(messages).slice(-1)[0]).toBe('DELETE_TASK');
        });
    });

    describe('notes', () => {
        it('adds, updates and deletes notes', async () => {
            store().addNote({ id: 'n1', title: 'N', content: 'c', format: 'text' });
            store().updateNote('n1', { content: 'changed' });
            store().updateNote('missing', { content: 'x' });
            expect(store().notes[0].content).toBe('changed');
            store().deleteNote('n1');
            useBoardStore.setState({ notes: [makeNote()] });
            store().deleteNoteSilently('note_1');
            expect(store().notes).toEqual([]);
            await flushPromises();
            // An edit reaches the background (and other open tabs); a missing note sends nothing
            expect(types(messages)).toEqual(['ADD_NOTE', 'UPDATE_NOTE', 'DELETE_NOTE']);
            expect(messages[1].payload).toEqual(expect.objectContaining({ id: 'n1', content: 'changed' }));
        });

        it('keeps the title in step with the first line when the content changes', async () => {
            store().addNote({ id: 'n1', title: 'Old idea', content: 'Old idea', format: 'markdown' });
            store().updateNote('n1', { content: '\n  # Q4 pricing plan  \nDetails' });
            expect(store().notes[0].title).toBe('Q4 pricing plan');

            store().updateNote('n1', { content: '   ' });
            expect(store().notes[0].title).toBe('Untitled Note');

            store().updateNote('n1', { content: 'x'.repeat(80) });
            expect(store().notes[0].title).toHaveLength(50);

            // An explicit title wins; changes that don't touch the content keep the title
            store().updateNote('n1', { content: 'Body', title: 'Chosen' });
            expect(store().notes[0].title).toBe('Chosen');
            store().updateNote('n1', { pinned: true });
            expect(store().notes[0].title).toBe('Chosen');

            await flushPromises();
            expect((await db.getAllNotes())[0]).toEqual(expect.objectContaining({ title: 'Chosen', pinned: true }));
        });
    });

    describe('sessions', () => {
        it('manages sessions locally', async () => {
            store().addSession({ id: 's1', name: 'S', startTime: 'now' } as never);
            expect(store().sessions[0].tabIds).toEqual([]);
            store().addSession(makeSession({ id: 's2', tabIds: ['x'] }));
            store().updateSession('s1', { name: 'Renamed' });
            expect(store().sessions[0].name).toBe('Renamed');
            store().deleteSession('s1');
            store().deleteSessionSilently('s2');
            expect(store().sessions).toEqual([]);
            await flushPromises();
            expect(types(messages)).toEqual(['ADD_SESSION', 'ADD_SESSION', 'DELETE_SESSION']);
        });

        it('syncs sessions through the background', async () => {
            const sessions = [makeSession()];
            respondToMessages(m => (m.type === 'GET_SESSIONS' ? sessions : undefined));
            await store().fetchSessions();
            expect(store().sessions).toEqual(sessions);

            await store().addSessionFromBackground({ id: 's2', name: 'N', startTime: 'now' } as never);
            await store().updateSessionFromBackground('s2', { name: 'X' });
            await store().updateSessionFromBackground('s2', { tabIds: ['t'] });
            expect(store().sessions[1]).toMatchObject({ name: 'X', tabIds: ['t'] });
            await store().deleteSessionFromBackground('s2');
            expect(store().sessions).toHaveLength(1);
        });

        it('keeps state when the background fails', async () => {
            respondToMessages(m => (m.type === 'GET_SESSIONS' ? { error: 'nope' } : undefined));
            await store().fetchSessions();
            expect(store().sessions).toEqual([]);

            chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('down'));
            await store().fetchSessions();
            await store().addSessionFromBackground(makeSession());
            await store().updateSessionFromBackground('session_1', { name: 'x' });
            await store().deleteSessionFromBackground('session_1');
            expect(store().sessions).toEqual([]);
            expect(console.error).toHaveBeenCalledTimes(4);
        });
    });

    describe('history', () => {
        it('manages local history entries', () => {
            store().addHistory({ id: 'h1', url: 'u', title: 't' });
            store().updateHistory('h1', { title: 'x' });
            store().updateHistory('nope', { title: 'y' });
            expect(store().history[0]).toMatchObject({ title: 'x', createdAt: expect.any(String) });
            store().deleteHistory('h1');
            expect(store().history).toEqual([]);
        });

        it('fetches stored and browser history, skipping duplicates', async () => {
            respondToMessages(m => {
                if (m.type === 'GET_HISTORY') return [{ id: 'h1', url: 'u', title: 't', createdAt: '' }];
                if (m.type === 'GET_BROWSER_HISTORY')
                    return [
                        { id: 'h1', url: 'u' },
                        { id: 'h2', title: 'Two', lastVisitTime: 0, visitCount: 3 },
                        { id: 'h3', url: 'v', title: 'Three', lastVisitTime: 1_700_000_000_000 },
                    ];
                return undefined;
            });
            await store().fetchHistory();
            const result = await store().fetchBrowserHistory();
            expect(result).toHaveLength(3);
            expect(store().history.map(h => h.id)).toEqual(['h1', 'h2', 'h3']);
            expect(store().history[1]).toMatchObject({
                url: '',
                title: 'Two',
                lastVisitTime: undefined,
                visitCount: 3,
            });
            expect(store().history[2].lastVisitTime).toBe(new Date(1_700_000_000_000).toISOString());
        });

        it('handles history errors', async () => {
            respondToMessages(() => ({ error: 'x' }));
            await store().fetchHistory();
            expect(await store().fetchBrowserHistory()).toEqual([]);
            chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('down'));
            await store().fetchHistory();
            await expect(store().fetchBrowserHistory()).rejects.toThrow('down');
        });
    });

    describe('bookmarks', () => {
        const tree = [
            {
                id: '0',
                title: '',
                children: [{ id: '1', title: 'Bar', children: [{ id: '2', title: 'G', url: 'https://g' }] }],
            },
        ];

        it('fetches and flattens the bookmark tree', async () => {
            respondToMessages(m => (m.type === 'GET_BOOKMARKS' ? tree : undefined));
            await store().fetchBookmarks();
            expect(store().bookmarkTree).toEqual(tree);
            expect(store().bookmarks.map(b => b.id)).toEqual(['0', '1', '2']);
            expect(store().isLoading).toBe(false);
        });

        it('wraps a single node response and reports errors', async () => {
            const answers: unknown[] = [{ id: 'solo', title: 'S' }, { error: 'denied' }, undefined];
            respondToMessages(() => answers.shift());
            await store().fetchBookmarks();
            expect(store().bookmarkTree).toHaveLength(1);
            await store().fetchBookmarks();
            expect(store().error).toBe('denied');
            await store().fetchBookmarks();
            expect(store().error).toBe('Failed to fetch bookmarks');
            chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('offline'));
            await store().fetchBookmarks();
            expect(store().error).toBe('offline');
        });

        it('performs bookmark operations through the background', async () => {
            useBoardStore.setState({
                bookmarks: [
                    { id: 'a', title: 'A' },
                    { id: 'child', title: 'C', parentId: 'f' },
                    { id: 'f', title: 'F' },
                ] as never,
            });
            respondToMessages(m => {
                switch (m.type) {
                    case 'GET_BOOKMARK':
                        return { id: m.payload.id, title: 'one' };
                    case 'CREATE_BOOKMARK':
                    case 'CREATE_BOOKMARK_FOLDER':
                        return { id: 'new-' + m.type, ...m.payload };
                    case 'UPDATE_BOOKMARK':
                        return { id: m.payload.id, ...m.payload.changes };
                    case 'MOVE_BOOKMARK':
                        return { id: m.payload.id, parentId: m.payload.destination.parentId };
                    case 'SEARCH_BOOKMARKS':
                    case 'GET_BOOKMARK_CHILDREN':
                        return [{ id: 'r' }];
                    default:
                        return { success: true };
                }
            });

            expect(await store().fetchBookmark('a')).toEqual({ id: 'a', title: 'one' });
            expect(await store().createBookmark({ title: 'B', url: 'https://b' })).toMatchObject({
                id: 'new-CREATE_BOOKMARK',
            });
            expect(await store().createBookmarkFolder({ title: 'Dir' })).toMatchObject({ title: 'Dir' });
            expect(await store().updateBookmark('a', { title: 'A2' })).toEqual({ id: 'a', title: 'A2' });
            expect(store().bookmarks.find(b => b.id === 'a')?.title).toBe('A2');
            expect(await store().moveBookmark('a', { parentId: 'f' })).toEqual({ id: 'a', parentId: 'f' });
            expect(await store().searchBookmarks('q')).toEqual([{ id: 'r' }]);
            expect(await store().getBookmarkChildren('f')).toEqual([{ id: 'r' }]);
            await store().deleteBookmarkTree('f');
            expect(store().bookmarks.map(b => b.id)).toEqual([
                'a',
                'new-CREATE_BOOKMARK',
                'new-CREATE_BOOKMARK_FOLDER',
            ]);
            await store().deleteBookmark('a');
            expect(store().bookmarks.map(b => b.id)).not.toContain('a');
        });

        it('returns empty results when the background errors or fails', async () => {
            respondToMessages(() => ({ error: 'no' }));
            expect(await store().fetchBookmark('a')).toBeNull();
            expect(await store().createBookmark({ title: 'x' })).toBeNull();
            expect(await store().createBookmarkFolder({ title: 'x' })).toBeNull();
            expect(await store().updateBookmark('a', {})).toBeNull();
            expect(await store().moveBookmark('a', {})).toBeNull();
            expect(await store().searchBookmarks('q')).toEqual([]);
            expect(await store().getBookmarkChildren('a')).toEqual([]);
            await store().deleteBookmark('a');
            await store().deleteBookmarkTree('a');

            chrome.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('down'));
            expect(await store().fetchBookmark('a')).toBeNull();
            expect(await store().createBookmark({ title: 'x' })).toBeNull();
            expect(await store().createBookmarkFolder({ title: 'x' })).toBeNull();
            expect(await store().updateBookmark('a', {})).toBeNull();
            expect(await store().moveBookmark('a', {})).toBeNull();
            expect(await store().searchBookmarks('q')).toEqual([]);
            expect(await store().getBookmarkChildren('a')).toEqual([]);
            await store().deleteBookmark('a');
            await store().deleteBookmarkTree('a');
            expect(console.error).toHaveBeenCalledTimes(9);
        });
    });
});
