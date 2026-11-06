import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcast, respondWith, safeSendResponse, WRITE_TIMEOUT_ERROR } from '../respond';
import { fakeChrome } from '../../test/chromeMock';

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe('respondWith', () => {
    it('keeps the channel open and replies success when the work finishes', async () => {
        const sendResponse = vi.fn();
        expect(respondWith(Promise.resolve('ignored'), sendResponse)).toBe(true);
        await flush();
        expect(sendResponse).toHaveBeenCalledExactlyOnceWith({ success: true });
    });

    it('replies with what map builds', async () => {
        const sendResponse = vi.fn();
        respondWith(Promise.resolve(2), sendResponse, { map: value => ({ doubled: value * 2 }) });
        await flush();
        expect(sendResponse).toHaveBeenCalledExactlyOnceWith({ doubled: 4 });
    });

    it('replies with the error message when the work fails, for errors and for other values', async () => {
        const first = vi.fn();
        respondWith(Promise.reject(new Error('disk full')), first);
        const second = vi.fn();
        respondWith(Promise.reject('plain text'), second);
        await flush();
        expect(first).toHaveBeenCalledExactlyOnceWith({ error: 'disk full' });
        expect(second).toHaveBeenCalledExactlyOnceWith({ error: 'plain text' });
    });

    it('replies with an error, not a success, when the work is too slow, and ignores the late result', async () => {
        const sendResponse = vi.fn();
        let finish!: () => void;
        respondWith(new Promise<void>(resolve => (finish = resolve)), sendResponse, { timeoutMs: 1000 });
        await vi.advanceTimersByTimeAsync(999);
        expect(sendResponse).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(sendResponse).toHaveBeenCalledExactlyOnceWith({ error: WRITE_TIMEOUT_ERROR });
        finish();
        await flush();
        expect(sendResponse).toHaveBeenCalledTimes(1);
    });

    it('waits five seconds by default and uses the given timeout message', async () => {
        const sendResponse = vi.fn();
        respondWith(new Promise<void>(() => undefined), sendResponse, { timeoutError: 'Too slow' });
        await vi.advanceTimersByTimeAsync(4999);
        expect(sendResponse).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(sendResponse).toHaveBeenCalledExactlyOnceWith({ error: 'Too slow' });
    });

    it('does not leave a timer running once it has replied', async () => {
        respondWith(Promise.resolve(), vi.fn());
        await flush();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('answers with an error when the reply cannot be built', async () => {
        const sendResponse = vi.fn();
        respondWith(Promise.resolve(1), sendResponse, {
            map: () => {
                throw new Error('bad shape');
            },
        });
        await flush();
        expect(sendResponse).toHaveBeenCalledExactlyOnceWith({ error: 'bad shape' });
    });

    it('survives a closed channel', async () => {
        const sendResponse = vi.fn(() => {
            throw new Error('closed');
        });
        respondWith(Promise.resolve(), sendResponse);
        await flush();
        expect(console.warn).toHaveBeenCalledWith('Failed to send response:', expect.any(Error));
    });
});

describe('safeSendResponse and broadcast', () => {
    it('never throws', () => {
        expect(() =>
            safeSendResponse(() => {
                throw new Error('closed');
            }, 1)
        ).not.toThrow();
    });

    it('broadcasts with or without a payload, and tolerates nobody listening', async () => {
        const send = fakeChrome().runtime.sendMessage;
        broadcast('STORAGE_X');
        broadcast('STORAGE_Y', { id: 1 });
        expect(send).toHaveBeenCalledWith({ type: 'STORAGE_X' });
        expect(send).toHaveBeenCalledWith({ type: 'STORAGE_Y', payload: { id: 1 } });

        send.mockRejectedValueOnce(new Error('Receiving end does not exist'));
        expect(() => broadcast('STORAGE_Z')).not.toThrow();
        await flush();
    });
});
