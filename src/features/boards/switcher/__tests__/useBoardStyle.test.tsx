import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fakeChrome } from '../../../../test/chromeMock';
import { BOARD_STYLE_KEY } from '../boardStyle';
import { useBoardStyle } from '../useBoardStyle';

describe('useBoardStyle', () => {
    it('starts on the default and loads the saved style', async () => {
        await chrome.storage.local.set({ [BOARD_STYLE_KEY]: 'bookshelf' });
        const { result } = renderHook(() => useBoardStyle());
        expect(result.current.style).toBe('tabs');
        await waitFor(() => expect(result.current.style).toBe('bookshelf'));
    });

    it('follows changes from other tabs and ignores unrelated ones', async () => {
        const { result } = renderHook(() => useBoardStyle());
        await act(() => chrome.storage.local.set({ [BOARD_STYLE_KEY]: 'dock' }));
        expect(result.current.style).toBe('dock');

        await act(() => chrome.storage.local.set({ other: 'value' }));
        act(() => fakeChrome().storage.onChanged.emit({ [BOARD_STYLE_KEY]: { newValue: 'overview' } }, 'sync'));
        expect(result.current.style).toBe('dock');

        await act(() => chrome.storage.local.set({ [BOARD_STYLE_KEY]: 'nonsense' }));
        expect(result.current.style).toBe('tabs');
    });

    it('saves a new style', async () => {
        const { result, unmount } = renderHook(() => useBoardStyle());
        await act(async () => result.current.updateStyle('carousel'));
        expect(result.current.style).toBe('carousel');
        expect((await chrome.storage.local.get([BOARD_STYLE_KEY]))[BOARD_STYLE_KEY]).toBe('carousel');
        unmount();
    });
});
