/* eslint-disable @typescript-eslint/no-explicit-any */
// Written from docs/specs/PRE_RELEASE_REVIEW_FIXES.md (AC1 background half, AC9), treating the code as a black box.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeMock, ChromeMock, fakeChrome } from '../../test/chromeMock';
import { makeTab } from '../../test/factories';

const LEGACY_ALARM = 'tabplex-infer-sessions';
let mock: ChromeMock;

/** Messages the background pushed to the UI pages */
const sentOfType = (type: string) =>
    vi
        .mocked(chrome.runtime.sendMessage)
        .mock.calls.map(c => c[0] as unknown as { type: string; payload?: any })
        .filter(m => m.type === type);

function send(message: { type: string; payload?: unknown }) {
    const sendResponse = vi.fn();
    mock.browser.events.runtimeMessage.emit(message, { id: 'test-extension-id' }, sendResponse);
    return sendResponse;
}

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'Date'] });
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    mock = installChromeMock();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('AC1: DELETE_FOLDER broadcast carries what the background really did', () => {
    beforeEach(async () => {
        await import('../message-handler');
        await chrome.storage.local.set({
            tabboard_tabs: [
                makeTab({ id: 'in-a', folderId: 'A' }),
                makeTab({ id: 'in-a-2', folderId: 'A' }),
                makeTab({ id: 'elsewhere', folderId: 'C' }),
            ],
        });
    });

    const folderOf = () =>
        Object.fromEntries(((mock.browser.store.tabboard_tabs ?? []) as any[]).map(t => [t.id, t.folderId]));

    it('moveTabs with a target: tabs land in B, payload says so', async () => {
        const reply = send({ type: 'DELETE_FOLDER', payload: { id: 'A', moveTabs: true, targetFolderId: 'B' } });
        await vi.advanceTimersByTimeAsync(10);
        expect(reply).toHaveBeenCalledTimes(1);
        expect(reply).toHaveBeenCalledWith({ success: true });
        expect(folderOf()).toEqual({ 'in-a': 'B', 'in-a-2': 'B', elsewhere: 'C' });
        expect(sentOfType('STORAGE_FOLDER_DELETED')).toEqual([
            { type: 'STORAGE_FOLDER_DELETED', payload: { id: 'A', moveTabs: true, targetFolderId: 'B' } },
        ]);
    });

    it.each([
        ['omitted', undefined],
        ['empty text', ''],
        ['null', null],
    ])('moveTabs with the target %s: unfiled, payload says empty text', async (_label, target) => {
        send({ type: 'DELETE_FOLDER', payload: { id: 'A', moveTabs: true, targetFolderId: target } });
        await vi.advanceTimersByTimeAsync(10);
        expect(folderOf()).toEqual({ 'in-a': '', 'in-a-2': '', elsewhere: 'C' });
        expect(sentOfType('STORAGE_FOLDER_DELETED')[0].payload).toStrictEqual({
            id: 'A',
            moveTabs: true,
            targetFolderId: '',
        });
    });

    it.each([
        ['absent', undefined],
        ['false', false],
    ])('moveTabs %s: tabs are deleted and the payload says moveTabs false', async (_label, moveTabs) => {
        send({ type: 'DELETE_FOLDER', payload: { id: 'A', moveTabs, targetFolderId: 'B' } });
        await vi.advanceTimersByTimeAsync(10);
        expect(folderOf()).toEqual({ elsewhere: 'C' });
        expect(sentOfType('STORAGE_FOLDER_DELETED')[0].payload).toStrictEqual({
            id: 'A',
            moveTabs: false,
            targetFolderId: 'B',
        });
    });

    it('a truthy non-boolean moveTabs: the broadcast must match what the background did', async () => {
        // The background moves tabs for any truthy moveTabs but broadcasts `moveTabs === true`. If the two disagree,
        // other tabs drop tabs that the background kept (and then delete them from the shared IndexedDB).
        send({ type: 'DELETE_FOLDER', payload: { id: 'A', moveTabs: 'yes', targetFolderId: 'B' } });
        await vi.advanceTimersByTimeAsync(10);
        const keptInBackground = 'in-a' in folderOf();
        expect(sentOfType('STORAGE_FOLDER_DELETED')[0].payload.moveTabs).toBe(keptInBackground);
    });

    it('does not broadcast and answers with an error when the write fails', async () => {
        vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('quota'));
        const reply = send({ type: 'DELETE_FOLDER', payload: { id: 'A', moveTabs: true, targetFolderId: 'B' } });
        await vi.advanceTimersByTimeAsync(10);
        expect(reply).toHaveBeenCalledTimes(1);
        expect(reply.mock.calls[0][0]).toHaveProperty('error');
        expect(sentOfType('STORAGE_FOLDER_DELETED')).toEqual([]);
    });

    it('a folder with no tabs still broadcasts the full payload', async () => {
        send({ type: 'DELETE_FOLDER', payload: { id: 'nobody-here', moveTabs: true, targetFolderId: 'B' } });
        await vi.advanceTimersByTimeAsync(10);
        expect(sentOfType('STORAGE_FOLDER_DELETED')[0].payload).toStrictEqual({
            id: 'nobody-here',
            moveTabs: true,
            targetFolderId: 'B',
        });
    });

    it('answers once with success when no UI page is open (sendMessage rejects)', async () => {
        vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(new Error('Receiving end does not exist.'));
        const reply = send({ type: 'DELETE_FOLDER', payload: { id: 'A' } });
        await vi.advanceTimersByTimeAsync(2500);
        expect(reply).toHaveBeenCalledTimes(1);
        expect(reply).toHaveBeenCalledWith({ success: true });
    });
});

describe('AC9: no background session inference', () => {
    it('the whole worker creates no infer alarm and clears the legacy one once', async () => {
        await chrome.alarms.create(LEGACY_ALARM, { periodInMinutes: 30 });
        vi.mocked(fakeChrome().alarms.create).mockClear();

        await import('../index');
        await vi.advanceTimersByTimeAsync(10);

        const clears = vi.mocked(fakeChrome().alarms.clear).mock.calls.filter(c => c[0] === LEGACY_ALARM);
        expect(clears).toHaveLength(1);
        expect(await chrome.alarms.get(LEGACY_ALARM)).toBeUndefined();
        expect(vi.mocked(fakeChrome().alarms.create).mock.calls.map(c => c[0])).not.toContain(LEGACY_ALARM);
    });

    it('a worker restart clears again', async () => {
        await import('../session-service');
        vi.resetModules();
        await import('../session-service');
        expect(vi.mocked(fakeChrome().alarms.clear).mock.calls.filter(c => c[0] === LEGACY_ALARM)).toHaveLength(2);
    });

    it('survives alarms.clear rejecting', async () => {
        vi.mocked(fakeChrome().alarms.clear).mockRejectedValue(new Error('boom'));
        await expect(import('../session-service')).resolves.toBeDefined();
        await vi.advanceTimersByTimeAsync(10);
    });

    it('no session appears after browser start, a stray legacy alarm or an hour of timers', async () => {
        await import('../index');
        await chrome.storage.local.set({ tabboard_tabs: [makeTab({ lastAccessed: new Date().toISOString() })] });
        mock.browser.events.startup.emit();
        mock.browser.events.alarm.emit({ name: LEGACY_ALARM });
        await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
        expect(mock.browser.store.tabboard_sessions ?? []).toEqual([]);
        expect(sentOfType('SESSION_INFERENCE_COMPLETE')).toEqual([]);
        expect(sentOfType('STORAGE_SESSION_ADDED')).toEqual([]);
    });

    it('session-service registers no startup or alarm listener of its own', async () => {
        const startup = mock.browser.events.startup.listeners.size;
        const alarm = mock.browser.events.alarm.listeners.size;
        await import('../session-service');
        expect(mock.browser.events.startup.listeners.size).toBe(startup);
        expect(mock.browser.events.alarm.listeners.size).toBe(alarm);
    });

    it('SESSION_INFERENCE_COMPLETE is an unknown message and the other session messages still work', async () => {
        await import('../message-handler');
        const stray = send({ type: 'SESSION_INFERENCE_COMPLETE', payload: { id: 's' } });
        expect(stray).toHaveBeenCalledWith({ error: 'Unknown message type: SESSION_INFERENCE_COMPLETE' });

        const session = { id: 's1', name: 'Mine', tabIds: [], startTime: '2026-10-01T00:00:00.000Z', createdAt: 'x' };
        const added = send({ type: 'ADD_SESSION', payload: session });
        await vi.advanceTimersByTimeAsync(10);
        expect(added).toHaveBeenCalledTimes(1);
        expect(mock.browser.store.tabboard_sessions).toEqual([session]);
    });
});
