// Replying to a runtime message once, honestly. Every handler that answers asynchronously goes through here.

export const WRITE_TIMEOUT_ERROR = 'Timed out: the change may not have been saved';

/** sendResponse that never throws (the channel may already be closed) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeSendResponse(sendResponse: (response: any) => void, response: unknown) {
    try {
        sendResponse(response);
    } catch (error) {
        // Response already sent or channel closed
        console.warn('Failed to send response:', error);
    }
}

/** Tells the other open TabPlex pages. Nobody listening is fine. */
export function broadcast(type: string, payload?: unknown): void {
    const message = payload === undefined ? { type } : { type, payload };
    chrome.runtime.sendMessage(message).catch(() => {});
}

interface RespondOptions<T> {
    /** Gives up after this long with an error (default 5 s). The work itself is not cancelled. */
    timeoutMs?: number;
    /** The error sent on a timeout */
    timeoutError?: string;
    /** What a success sends (default `{ success: true }`) */
    map?: (value: T) => unknown;
}

/**
 * Sends the result of `work` as the reply: `map(value)` when it resolves, `{ error }` when it rejects, and `{ error }`
 * when it takes too long. Only the first of these is sent. A timeout is an error, never a made-up success: the UI
 * must not believe a write happened that may not have.
 *
 * Returns true so a handler can `return respondWith(...)` (true keeps the message channel open for the async reply).
 */
export function respondWith<T>(
    work: Promise<T>,
    sendResponse: (response: unknown) => void,
    { timeoutMs = 5000, timeoutError = WRITE_TIMEOUT_ERROR, map = () => ({ success: true }) }: RespondOptions<T> = {}
): true {
    let sent = false;
    const send = (response: unknown) => {
        if (sent) return;
        sent = true;
        clearTimeout(timer);
        safeSendResponse(sendResponse, response);
    };
    const timer = setTimeout(() => send({ error: timeoutError }), timeoutMs);

    const fail = (error: unknown) => send({ error: error instanceof Error ? error.message : String(error) });
    work.then(value => {
        try {
            send(map(value));
        } catch (error) {
            fail(error); // A reply that can't be built is still a reply
        }
    }, fail);
    return true;
}
