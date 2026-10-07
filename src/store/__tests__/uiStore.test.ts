import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadStore() {
    vi.resetModules();
    return (await import('../../features/ui/store/uiStore')).useUIStore;
}

describe('ui store', () => {
    afterEach(() => {
        window.location.hash = '';
    });

    it.each([
        ['/today', 'today'],
        ['/boards', 'boards'],
        ['/history', 'history'],
        ['/sessions', 'sessions'],
        ['/analytics', 'analytics'],
        ['/canvas', 'canvas'],
        ['/bookmarks', 'bookmarks'],
        ['/notes', 'notes'],
        ['/tasks', 'tasks'],
        ['/pomodoro', 'pomodoro'],
        ['/settings', 'settings'],
    ])('starts on the view in the URL hash (%s)', async (hash, view) => {
        window.location.hash = hash;
        expect((await loadStore()).getState().activeView).toBe(view);
    });

    it('falls back to the saved view, then Today', async () => {
        window.location.hash = '/unknown';
        localStorage.setItem('tabboard-active-view', 'notes');
        expect((await loadStore()).getState().activeView).toBe('notes');
        localStorage.clear();
        window.location.hash = '';
        expect((await loadStore()).getState().activeView).toBe('today');
    });

    it('updates the view, palette, toasts and park dialog', async () => {
        const store = await loadStore();
        const { actions } = store.getState();
        actions.setActiveView('tasks');
        expect(localStorage.getItem('tabboard-active-view')).toBe('tasks');
        actions.toggleCommandPalette();
        expect(store.getState().isCommandPaletteOpen).toBe(true);
        actions.setCommandPaletteOpen(false);
        expect(store.getState().isCommandPaletteOpen).toBe(false);

        actions.showToast('Hi');
        const first = store.getState().toast!;
        expect(first).toMatchObject({ message: 'Hi', type: 'info' });
        actions.showToast('Again', 'error');
        expect(store.getState().toast!.id).toBeGreaterThan(first.id);
        actions.clearToast();
        expect(store.getState().toast).toBeNull();

        actions.openParkDialog('t1');
        expect(store.getState().parkDialogTaskId).toBe('t1');
        actions.closeParkDialog();
        expect(store.getState().parkDialogTaskId).toBeNull();
    });

    it('remembers the active board across reloads', async () => {
        localStorage.clear();
        let store = await loadStore();
        expect(store.getState().activeBoardId).toBeNull();
        store.getState().actions.setActiveBoard('b2');
        expect(localStorage.getItem('tabplex_active_board')).toBe('b2');
        store = await loadStore();
        expect(store.getState().activeBoardId).toBe('b2');
        store.getState().actions.setActiveBoard(null);
        expect(localStorage.getItem('tabplex_active_board')).toBeNull();
    });

    it('keeps working when localStorage is unavailable', async () => {
        window.location.hash = '/boards'; // the view comes from the URL, not storage
        const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const store = await loadStore();
        expect(store.getState().activeBoardId).toBeNull();
        store.getState().actions.setActiveBoard('b1');
        expect(store.getState().activeBoardId).toBe('b1');
        get.mockRestore();
        set.mockRestore();
    });
});
