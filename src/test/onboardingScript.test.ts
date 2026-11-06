import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeChrome } from './chromeMock';

const script = readFileSync(resolve(__dirname, '../../onboarding.js'), 'utf8');

/** Runs onboarding.js on a page with the "Get started" button and fires DOMContentLoaded */
function loadOnboarding() {
    document.body.innerHTML = '<button id="getStartedBtn">Get started</button>';
    (0, eval)(script);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.getElementById('getStartedBtn')!.click();
}

describe('onboarding.js · Get started', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(window, 'close').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const answerWith = (response: unknown) =>
        fakeChrome().runtime.sendMessage.mockImplementation((_message: unknown, callback?: (r: unknown) => void) => {
            callback?.(response);
            return Promise.resolve(response);
        });

    it('asks the background to open TabPlex and closes itself when that works', () => {
        answerWith({ success: true });
        loadOnboarding();
        expect(fakeChrome().runtime.sendMessage.mock.calls[0][0]).toEqual({ type: 'OPEN_TABBOARD' });
        vi.advanceTimersByTime(500);
        expect(window.close).toHaveBeenCalledTimes(1);
    });

    it('opens the app in its own tab, and stays open, when the background answers with an error', () => {
        answerWith({ error: 'Unknown message type: OPEN_TABBOARD' });
        const getURL = vi.spyOn(fakeChrome().runtime, 'getURL');
        loadOnboarding();
        vi.advanceTimersByTime(1000);
        expect(getURL).toHaveBeenCalledWith('index.html');
        expect(window.close).not.toHaveBeenCalled();
    });

    it('does the same when nobody answers', () => {
        answerWith(undefined);
        const getURL = vi.spyOn(fakeChrome().runtime, 'getURL');
        loadOnboarding();
        expect(getURL).toHaveBeenCalledWith('index.html');
        expect(window.close).not.toHaveBeenCalled();
    });
});
