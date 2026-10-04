import { describe, expect, it } from 'vitest';
import { getFaviconUrl } from '../favicon';
import { EXTENSION_BASE } from '../../test/chromeMock';

describe('getFaviconUrl', () => {
    it("points at Chrome's local favicon cache for web pages", () => {
        expect(getFaviconUrl('https://github.com/a?b=1')).toBe(
            `${EXTENSION_BASE}_favicon/?pageUrl=${encodeURIComponent('https://github.com/a?b=1')}&size=32`
        );
        expect(getFaviconUrl('http://localhost:3000/', 64)).toContain('&size=64');
    });

    it.each([undefined, '', 'newtab', 'not a url', 'chrome://settings', 'file:///C:/x.pdf', 'mailto:a@b.c'])(
        'returns null for %s (no favicon Chrome can serve)',
        url => {
            expect(getFaviconUrl(url)).toBeNull();
        }
    );
});
