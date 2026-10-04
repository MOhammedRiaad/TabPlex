import { describe, expect, it } from 'vitest';

describe('test setup', () => {
    it('provides a chrome fake', async () => {
        await chrome.storage.local.set({ a: 1 });
        expect(await chrome.storage.local.get('a')).toEqual({ a: 1 });
    });
});
