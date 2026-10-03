import { describe, expect, it, vi } from 'vitest';
import { ChromeStorageService, storageService } from './storage';

describe('ChromeStorageService', () => {
    it('gets, sets, removes and lists values', async () => {
        const service = new ChromeStorageService();
        expect(await service.get('missing')).toBeNull();
        await service.set('k', { a: 1 });
        expect(await service.get('k')).toEqual({ a: 1 });
        expect(await service.getAll()).toEqual({ k: { a: 1 } });
        await service.remove('k');
        expect(await service.get('k')).toBeNull();
        expect(storageService).toBeInstanceOf(ChromeStorageService);
    });

    it('handles chrome.storage failures', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failing = vi.fn().mockRejectedValue(new Error('quota'));
        chrome.storage.local.get = failing;
        chrome.storage.local.set = failing;
        chrome.storage.local.remove = failing;
        const service = new ChromeStorageService();
        expect(await service.get('k')).toBeNull();
        expect(await service.getAll()).toEqual({});
        await expect(service.set('k', 1)).rejects.toThrow('quota');
        await expect(service.remove('k')).rejects.toThrow('quota');
    });
});
