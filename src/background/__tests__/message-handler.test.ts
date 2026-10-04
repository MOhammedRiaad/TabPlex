/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, fakeChrome, EXTENSION_BASE } from '../../test/chromeMock';
import { makeTab, makeTask } from '../../test/factories';

let mock: ChromeMock;

/** Send a message through the real chrome.runtime.onMessage listener registered by message-handler */
function dispatch(message: { type: string; payload?: unknown }) {
    const sendResponse = vi.fn();
    const results = mock.browser.events.runtimeMessage.emit(message, {}, sendResponse);
    return { keepOpen: results[0], sendResponse };
}

const flush = () => vi.advanceTimersByTimeAsync(0);
const store = () => mock.browser.store as Record<string, any>;

describe('message-handler', () => {
    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'Date'] });
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        mock = installChromeMock();
        vi.resetModules();
        await import('../message-handler');
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('ignores STORAGE_* notifications', () => {
        const { keepOpen, sendResponse } = dispatch({ type: 'STORAGE_TASK_ADDED' });
        expect(keepOpen).toBe(false);
        expect(sendResponse).not.toHaveBeenCalled();
    });

    it('answers unknown messages with an error', () => {
        const { keepOpen, sendResponse } = dispatch({ type: 'WHAT_IS_THIS' });
        expect(keepOpen).toBe(false);
        expect(sendResponse).toHaveBeenCalledWith({ error: 'Unknown message type: WHAT_IS_THIS' });
    });

    it('returns the Chrome profile email', () => {
        const { keepOpen, sendResponse } = dispatch({ type: 'GET_USER_INFO' });
        expect(keepOpen).toBe(true);
        expect(sendResponse).toHaveBeenCalledWith({ email: 'user@example.com' });
    });

    it('reports identity errors and missing emails', () => {
        fakeChrome().identity.getProfileUserInfo.mockImplementationOnce((_o: unknown, cb: (i: any) => void) => {
            fakeChrome().runtime.lastError = { message: 'not signed in' };
            cb(undefined);
            fakeChrome().runtime.lastError = undefined;
        });
        expect(dispatch({ type: 'GET_USER_INFO' }).sendResponse).toHaveBeenCalledWith({ error: 'not signed in' });
        fakeChrome().identity.getProfileUserInfo.mockImplementationOnce((_o: unknown, cb: (i: any) => void) =>
            cb(undefined)
        );
        expect(dispatch({ type: 'GET_USER_INFO' }).sendResponse).toHaveBeenCalledWith({ email: '' });
    });

    it('moves a tab to another folder', async () => {
        await chrome.storage.local.set({ tabboard_tabs: [makeTab({ id: 't1' })] });
        const { keepOpen, sendResponse } = dispatch({ type: 'MOVE_TAB', payload: { tabId: 't1', newFolderId: 'f2' } });
        expect(keepOpen).toBe(true);
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
        expect(store().tabboard_tabs[0].folderId).toBe('f2');
        // Unknown tab: nothing to move, still succeeds
        const missing = dispatch({ type: 'MOVE_TAB', payload: { tabId: 'nope', newFolderId: 'f2' } });
        await flush();
        expect(missing.sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('reports MOVE_TAB errors and falls back after a timeout', async () => {
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('read'));
        const failed = dispatch({ type: 'MOVE_TAB', payload: { tabId: 't1', newFolderId: 'f2' } });
        await flush();
        expect(failed.sendResponse).toHaveBeenCalledWith({ error: 'read' });

        fakeChrome().storage.local.get.mockReturnValueOnce(new Promise(() => undefined));
        const slow = dispatch({ type: 'MOVE_TAB', payload: { tabId: 't1', newFolderId: 'f2' } });
        await vi.advanceTimersByTimeAsync(1000);
        expect(slow.sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('adds and deletes tabs', async () => {
        const added = dispatch({ type: 'ADD_TAB', payload: makeTab({ id: 'n' }) });
        expect(added.keepOpen).toBe(true);
        await flush();
        expect(added.sendResponse).toHaveBeenCalledWith({ success: true });
        expect(store().tabboard_tabs.map((t: any) => t.id)).toEqual(['n']);

        const deleted = dispatch({ type: 'DELETE_TAB', payload: { id: 'n' } });
        await flush();
        expect(deleted.sendResponse).toHaveBeenCalledWith({ success: true });
        expect(store().tabboard_tabs).toEqual([]);

        expect(dispatch({ type: 'ADD_TAB' }).keepOpen).toBe(false);
        expect(dispatch({ type: 'DELETE_TAB', payload: {} }).keepOpen).toBe(false);
    });

    it.each(['ADD_TAB', 'DELETE_TAB'])('%s reports errors and times out with success', async type => {
        const payload = type === 'ADD_TAB' ? makeTab() : { id: 'x' };
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('nope'));
        const failed = dispatch({ type, payload });
        await flush();
        expect(failed.sendResponse).toHaveBeenCalledWith({ error: 'nope' });
        await vi.advanceTimersByTimeAsync(1000);
        expect(failed.sendResponse).toHaveBeenCalledTimes(1);

        fakeChrome().storage.local.get.mockReturnValueOnce(new Promise(() => undefined));
        const slow = dispatch({ type, payload });
        await vi.advanceTimersByTimeAsync(1000);
        expect(slow.sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('returns information about the active tab', async () => {
        const tab = mock.browser.addTab({ url: 'https://now.dev', title: 'Now', active: true, favIconUrl: 'f.png' });
        const { keepOpen, sendResponse } = dispatch({ type: 'GET_ACTIVE_TAB' });
        expect(keepOpen).toBe(true);
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({
            id: `tab_${Date.now()}_${tab.id}`,
            title: 'Now',
            url: 'https://now.dev',
            favicon: 'f.png',
            tabId: tab.id,
        });
    });

    it('handles no active tab, errors and timeouts for GET_ACTIVE_TAB', async () => {
        const none = dispatch({ type: 'GET_ACTIVE_TAB' });
        await flush();
        expect(none.sendResponse).toHaveBeenCalledWith(null);

        mock.browser.addTab({ url: '', title: '', active: true });
        const blank = dispatch({ type: 'GET_ACTIVE_TAB' });
        await flush();
        expect(blank.sendResponse).toHaveBeenCalledWith(expect.objectContaining({ title: '', url: '', favicon: '' }));

        fakeChrome().tabs.query.mockRejectedValueOnce(new Error('q'));
        const failed = dispatch({ type: 'GET_ACTIVE_TAB' });
        await flush();
        expect(failed.sendResponse).toHaveBeenCalledWith({ error: 'q' });

        fakeChrome().tabs.query.mockReturnValueOnce(new Promise(() => undefined));
        const slow = dispatch({ type: 'GET_ACTIVE_TAB' });
        await vi.advanceTimersByTimeAsync(1000);
        expect(slow.sendResponse).toHaveBeenCalledWith({ error: 'Timeout getting active tab info' });
    });

    it('opens a tab in a folder', async () => {
        const { keepOpen, sendResponse } = dispatch({
            type: 'CREATE_TAB_IN_FOLDER',
            payload: { url: 'https://new.dev/', folderId: 'f1' },
        });
        expect(keepOpen).toBe(false);
        expect(sendResponse).toHaveBeenCalledWith({ success: true });
        await flush();
        await flush();
        expect(store().tabboard_tabs[0]).toMatchObject({ url: 'https://new.dev/', folderId: 'f1', status: 'open' });
    });

    it('adds, updates and deletes boards', async () => {
        const board = { id: 'b1', name: 'Work', createdAt: '', updatedAt: '' };
        const added = dispatch({ type: 'ADD_BOARD', payload: board });
        expect(added.keepOpen).toBe(true);
        await flush();
        expect(added.sendResponse).toHaveBeenCalledWith({ success: true });
        const broadcasts = () => fakeChrome().runtime.sendMessage.mock.calls.map((c: any[]) => c[0].type);
        expect(broadcasts()).toContain('STORAGE_BOARD_ADDED');

        fakeChrome().runtime.sendMessage.mockClear();
        dispatch({ type: 'ADD_BOARD', payload: { ...board, name: 'Renamed' } });
        await flush();
        expect(store().tabboard_boards).toEqual([{ ...board, name: 'Renamed' }]);
        expect(broadcasts()).not.toContain('STORAGE_BOARD_ADDED');

        const deleted = dispatch({ type: 'DELETE_BOARD', payload: { id: 'b1' } });
        await flush();
        expect(deleted.sendResponse).toHaveBeenCalledWith({ success: true });
        expect(store().tabboard_boards).toEqual([]);
        expect(broadcasts()).toContain('STORAGE_BOARD_DELETED');

        expect(dispatch({ type: 'ADD_BOARD' }).keepOpen).toBe(false);
        expect(dispatch({ type: 'DELETE_BOARD', payload: {} }).keepOpen).toBe(false);
    });

    it.each(['ADD_BOARD', 'DELETE_BOARD'])('%s reports storage errors', async type => {
        fakeChrome().storage.local.get.mockRejectedValueOnce(new Error('broken'));
        const { sendResponse } = dispatch({ type, payload: { id: 'b1' } });
        await flush();
        expect(sendResponse).toHaveBeenCalledWith({ error: 'broken' });
    });

    it.each([
        ['ADD_FOLDER', { id: 'f', name: 'F' }],
        ['DELETE_FOLDER', { id: 'f' }],
        ['ADD_TASK', makeTask()],
        ['UPDATE_TASK', makeTask()],
        ['DELETE_TASK', { id: 'task_1' }],
        ['ADD_NOTE', { id: 'n' }],
        ['DELETE_NOTE', { id: 'n' }],
        ['GET_HISTORY', undefined],
        ['GET_SESSIONS', undefined],
        ['EXPORT_ALL_DATA', undefined],
        ['GET_BOOKMARKS', undefined],
        ['TASK_CONTEXT_PARK_ACTIVE', undefined],
    ])('routes %s to its service', async (type, payload) => {
        const { keepOpen, sendResponse } = dispatch({ type, payload });
        expect(keepOpen).toBe(true);
        await flush();
        expect(sendResponse).toHaveBeenCalled();
    });

    it('logs but survives a closed response channel', () => {
        const sendResponse = vi.fn(() => {
            throw new Error('closed');
        });
        mock.browser.events.runtimeMessage.emit({ type: 'NOPE' }, {}, sendResponse);
        expect(console.warn).toHaveBeenCalledWith('Failed to send response:', expect.any(Error));
        expect(EXTENSION_BASE).toBeTruthy();
    });
});
