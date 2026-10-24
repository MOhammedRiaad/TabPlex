import { beforeEach, describe, expect, it } from 'vitest';
import { ChromeMock, fakeChrome, installChromeMock } from '../../../../test/chromeMock';
import { grantedOrigins, missingOrigins, originPatternFor, requestAccess, revokeAllPageAccess } from '../pageAccess';

describe('originPatternFor', () => {
    it('uses scheme and host, drops the path, query and port', () => {
        expect(originPatternFor('https://developer.mozilla.org/en-US/docs/Web?q=1#top')).toBe(
            'https://developer.mozilla.org/*'
        );
        expect(originPatternFor('http://localhost:8080/app')).toBe('http://localhost/*');
    });

    it('keeps http and https apart', () => {
        expect(originPatternFor('http://example.com/')).toBe('http://example.com/*');
        expect(originPatternFor('https://example.com/')).toBe('https://example.com/*');
    });
});

let browser: ChromeMock['browser'];
beforeEach(() => {
    browser = installChromeMock().browser;
});

describe('missingOrigins', () => {
    it('lists only the origins that are not granted yet, once each, in order', async () => {
        browser.grantedOrigins.add('https://a.dev/*');

        expect(
            await missingOrigins(['https://a.dev/*', 'https://b.dev/*', 'https://b.dev/*', 'http://c.dev/*'])
        ).toEqual(['https://b.dev/*', 'http://c.dev/*']);
        expect(await missingOrigins([])).toEqual([]);
    });
});

describe('requestAccess', () => {
    it('calls permissions.request synchronously, before anything is awaited', () => {
        // A click handler must start the prompt in the same turn as the click
        void requestAccess(['https://a.dev/*']);
        expect(fakeChrome().permissions.request).toHaveBeenCalledWith({ origins: ['https://a.dev/*'] });
    });

    it('resolves true and grants the origins when the user allows them', async () => {
        expect(await requestAccess(['https://a.dev/*'])).toBe(true);
        expect(await grantedOrigins()).toEqual(['https://a.dev/*']);
    });

    it('resolves false, without granting anything, when the user says no', async () => {
        browser.setPermissionRequestAnswer(false);

        expect(await requestAccess(['https://a.dev/*'])).toBe(false);
        expect(await grantedOrigins()).toEqual([]);
    });
});

describe('grantedOrigins and revokeAllPageAccess', () => {
    it('reports what Chrome has granted', async () => {
        browser.grantOrigins('https://a.dev/*', 'http://b.dev/*');

        expect(await grantedOrigins()).toEqual(['https://a.dev/*', 'http://b.dev/*']);
    });

    it('removes every origin that getAll returns', async () => {
        browser.grantOrigins('https://a.dev/*', 'http://b.dev/*');

        await revokeAllPageAccess();

        expect(fakeChrome().permissions.remove).toHaveBeenCalledWith({
            origins: ['https://a.dev/*', 'http://b.dev/*'],
        });
        expect(await grantedOrigins()).toEqual([]);
    });

    it('does nothing when no access is granted', async () => {
        await revokeAllPageAccess();

        expect(fakeChrome().permissions.remove).not.toHaveBeenCalled();
    });
});
