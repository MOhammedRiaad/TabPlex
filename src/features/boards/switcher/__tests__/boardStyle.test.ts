import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
    BOARD_STYLE_KEY,
    BOARD_STYLES,
    DEFAULT_BOARD_STYLE,
    isBoardStyle,
    readBoardStyle,
    saveBoardStyle,
} from '../boardStyle';

describe('boardStyle', () => {
    it('defaults to Board tabs', () => {
        expect(DEFAULT_BOARD_STYLE).toBe('tabs');
        expect(BOARD_STYLES[0].id).toBe('tabs');
    });

    it('recognises only the known styles', () => {
        expect(isBoardStyle('bookshelf')).toBe(true);
        expect(isBoardStyle('shelf')).toBe(false);
        expect(isBoardStyle(undefined)).toBe(false);
    });

    it('reads the saved style, falling back to the default when unset, unknown or unavailable', async () => {
        expect(await readBoardStyle()).toBe('tabs');
        await chrome.storage.local.set({ [BOARD_STYLE_KEY]: 'dock' });
        expect(await readBoardStyle()).toBe('dock');
        await chrome.storage.local.set({ [BOARD_STYLE_KEY]: 'spiral' });
        expect(await readBoardStyle()).toBe('tabs');
        vi.spyOn(chrome.storage.local, 'get').mockRejectedValueOnce(new Error('gone'));
        expect(await readBoardStyle()).toBe('tabs');
    });

    it('saves the style and logs a failed save instead of throwing', async () => {
        await saveBoardStyle('carousel');
        expect(await readBoardStyle()).toBe('carousel');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(chrome.storage.local, 'set').mockRejectedValueOnce(new Error('full'));
        await saveBoardStyle('overview');
        expect(error).toHaveBeenCalled();
    });

    it('lists the same styles, in the same order, as the onboarding picker', () => {
        const html = readFileSync(resolve(__dirname, '../../../../../onboarding.html'), 'utf8');
        const values = [...html.matchAll(/name="boardStyle" value="([a-z]+)"/g)].map(match => match[1]);
        expect(values).toEqual(BOARD_STYLES.map(option => option.id));
        expect(html).toMatch(new RegExp(`name="boardStyle" value="${DEFAULT_BOARD_STYLE}" checked`));
        const script = readFileSync(resolve(__dirname, '../../../../../onboarding.js'), 'utf8');
        expect(script).toContain(`const BOARD_STYLE_KEY = '${BOARD_STYLE_KEY}'`);
    });
});
