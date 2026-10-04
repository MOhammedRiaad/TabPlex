import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, EXTENSION_BASE } from '../../test/chromeMock';
import { makeContext, makeTask } from '../../test/factories';
import { BACKGROUND_TASKS_KEY, CONTEXT_MESSAGES, ContextResponse } from '../../utils/taskContext';
import { ApplyGroupsResponse, ORGANIZE_MESSAGES, UndoGroupsResponse } from '../../utils/organizeTabs';
import { Task } from '../../types';

type Service = typeof import('../organize-service');

let mock: ChromeMock;
let service: Service;

const web = (n: number, windowId?: number) =>
    Array.from({ length: n }, (_, i) => mock.browser.addTab({ url: `https://site${i}.dev/`, windowId }).id);

function send(type: string, payload?: unknown) {
    return new Promise<ApplyGroupsResponse & UndoGroupsResponse>(resolve => {
        expect(service.handleOrganizeMessage({ type, payload }, resolve)).toBe(true);
    });
}

describe('organize-service', () => {
    beforeEach(async () => {
        mock = installChromeMock();
        vi.resetModules();
        service = await import('../organize-service');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('creates one titled, coloured group per payload group', async () => {
        const [a, b, c, d] = web(4);
        const res = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: mock.browser.lastFocusedWindow,
            collapsed: true,
            groups: [
                { title: 'Reading', color: 'green', tabIds: [a, b] },
                { title: 'Shopping', color: 'red', tabIds: [c, d] },
            ],
        });
        expect(res.success).toBe(true);
        expect(res.skippedTabIds).toEqual([]);
        expect(res.created!.map(g => [g.title, g.color, g.tabIds])).toEqual([
            ['Reading', 'green', [a, b]],
            ['Shopping', 'red', [c, d]],
        ]);
        for (const created of res.created!) {
            expect(await chrome.tabGroups.get(created.groupId)).toMatchObject({
                title: created.title,
                color: created.color,
                collapsed: true,
            });
            expect(mock.browser.groupTabs(created.groupId).map(t => t.id)).toEqual(created.tabIds);
        }
    });

    it('skips tabs that closed, moved window, got pinned or grouped, or are not web pages', async () => {
        const windowId = mock.browser.lastFocusedWindow;
        const [ok1, ok2] = web(2, windowId);
        const pinned = mock.browser.addTab({ url: 'https://pinned.dev', pinned: true, windowId }).id;
        const other = mock.browser.addTab({ url: 'https://other.dev', windowId: mock.browser.openWindow() }).id;
        const inGroup = mock.browser.addTab({ url: 'https://grouped.dev', windowId }).id;
        mock.browser.addGroup({ tabIds: [inGroup] });
        const browserPage = mock.browser.addTab({ url: 'chrome://settings', windowId }).id;
        const tabplex = mock.browser.addTab({ url: `${EXTENSION_BASE}index.html`, windowId }).id;

        const res = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId,
            collapsed: false,
            groups: [
                {
                    title: 'Mixed',
                    color: 'blue',
                    tabIds: [ok1, 999, pinned, other, inGroup, browserPage, tabplex, ok2],
                },
            ],
        });
        expect(res.created!.map(g => g.tabIds)).toEqual([[ok1, ok2]]);
        expect(res.skippedTabIds).toEqual([999, pinned, other, inGroup, browserPage, tabplex]);
    });

    it("doesn't create a group left with one valid tab", async () => {
        const [a] = web(1);
        const res = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: mock.browser.lastFocusedWindow,
            collapsed: false,
            groups: [{ title: 'Lonely', color: 'blue', tabIds: [a, 12345] }],
        });
        expect(res.created).toEqual([]);
        expect(res.skippedTabIds).toEqual([12345, a]);
        expect(await chrome.tabGroups.query({})).toEqual([]);
    });

    it('uses a tab listed twice only in the first group; fixes bad colours and long titles', async () => {
        const [a, b, c] = web(3);
        const res = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: mock.browser.lastFocusedWindow,
            collapsed: false,
            groups: [
                { title: 'x'.repeat(40), color: 'magenta', tabIds: [a, b] },
                { title: 'Second', color: 'red', tabIds: [b, c] },
            ],
        });
        expect(res.created).toHaveLength(1);
        expect(res.created![0]).toMatchObject({ title: 'x'.repeat(24), color: 'grey', tabIds: [a, b] });
        expect(res.skippedTabIds).toEqual([c]);
    });

    it('keeps going when Chrome refuses one group', async () => {
        const [a, b, c, d] = web(4);
        vi.mocked(chrome.tabs.group).mockRejectedValueOnce(new Error('window closed'));
        const res = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: mock.browser.lastFocusedWindow,
            collapsed: false,
            groups: [
                { title: 'A', color: 'blue', tabIds: [a, b] },
                { title: 'B', color: 'red', tabIds: [c, d] },
            ],
        });
        expect(res.created!.map(g => g.title)).toEqual(['B']);
        expect(res.skippedTabIds).toEqual([a, b]);
    });

    it('undoes: ungroups the created groups, ignoring unknown ids', async () => {
        const [a, b, c, d] = web(4);
        const applied = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: mock.browser.lastFocusedWindow,
            collapsed: false,
            groups: [
                { title: 'A', color: 'blue', tabIds: [a, b] },
                { title: 'B', color: 'red', tabIds: [c, d] },
            ],
        });
        const ids = applied.created!.map(g => g.groupId);
        const res = await send(ORGANIZE_MESSAGES.UNDO, { groupIds: [...ids, 4242] });
        expect(res).toEqual({ success: true, ungroupedTabs: 4 });
        expect(await chrome.tabGroups.query({})).toEqual([]);
        expect([...mock.browser.tabs.values()].every(t => t.groupId === -1)).toBe(true);
    });

    it('never touches the active Park & Resume task group', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        const context = await import('../context-service');
        const task = makeTask({ context: makeContext({ state: 'parked' }) });
        await chrome.storage.local.set({ [BACKGROUND_TASKS_KEY]: [task] });
        const started = await new Promise<ContextResponse>(resolve =>
            context.handleContextMessage({ type: CONTEXT_MESSAGES.RESUME, payload: { task, windowId: 1 } }, resolve)
        );
        await vi.advanceTimersByTimeAsync(400);
        const groupId = started.task!.context!.chromeGroupId as number;
        const taskTabs = mock.browser.groupTabs(groupId).map(t => t.id);
        expect(taskTabs.length).toBeGreaterThan(1);

        const res = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: 1,
            collapsed: false,
            groups: [{ title: 'Steal', color: 'red', tabIds: taskTabs }],
        });
        await vi.advanceTimersByTimeAsync(2000);
        expect(res.created).toEqual([]);
        expect(res.skippedTabIds).toEqual(taskTabs);
        expect(mock.browser.groupTabs(groupId).map(t => t.id)).toEqual(taskTabs);
        const stored = (mock.browser.store[BACKGROUND_TASKS_KEY] as Task[]).find(t => t.id === task.id)!;
        expect(stored.context!.state).toBe('active');
    });

    it('answers unknown types with an error and survives a closed channel', async () => {
        expect(await send('TABS_SOMETHING')).toEqual({ error: 'Unknown organize message: TABS_SOMETHING' });

        vi.mocked(chrome.tabGroups.get).mockRejectedValueOnce(new Error('x'));
        vi.mocked(chrome.tabs.query).mockRejectedValueOnce(new Error('query failed'));
        const [a, b] = web(2);
        const applied = await send(ORGANIZE_MESSAGES.APPLY, {
            windowId: mock.browser.lastFocusedWindow,
            collapsed: false,
            groups: [{ title: 'A', color: 'blue', tabIds: [a, b] }],
        });
        // tabGroups.get fails for the first id (skipped); tabs.query then throws for the real group
        const failed = await send(ORGANIZE_MESSAGES.UNDO, { groupIds: [777, applied.created![0].groupId] });
        expect(failed).toEqual({ error: 'query failed' });

        const throwing = vi.fn(() => {
            throw new Error('closed');
        });
        vi.mocked(chrome.tabGroups.get).mockRejectedValueOnce(new Error('x'));
        vi.mocked(chrome.tabs.query).mockRejectedValueOnce(new Error('boom'));
        service.handleOrganizeMessage(
            { type: ORGANIZE_MESSAGES.UNDO, payload: { groupIds: [1, applied.created![0].groupId] } },
            throwing
        );
        await new Promise(r => setTimeout(r, 0));
        expect(throwing).toHaveBeenCalledWith({ error: 'boom' });
    });

    it('lists the message types it handles', () => {
        expect(service.ORGANIZE_MESSAGE_TYPES).toEqual(['TABS_APPLY_GROUPS', 'TABS_UNDO_GROUPS']);
    });
});
