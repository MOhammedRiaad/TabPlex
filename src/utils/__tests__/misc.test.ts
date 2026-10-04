import { describe, expect, it, vi } from 'vitest';
import { COLOR_PALETTES, getContrastColor, hexToRgba, isValidHexColor } from '../color';
import {
    generateBoardId,
    generateFolderId,
    generateId,
    generateNoteId,
    generateSessionId,
    generateTabId,
    generateTaskId,
} from '../idGenerator';
import { createTabFromHistoryItem, generateTabId as legacyTabId } from '../tabUtils';

describe('color', () => {
    it('converts hex to rgba', () => {
        expect(hexToRgba('#ff8000')).toBe('rgba(255, 128, 0, 1)');
        expect(hexToRgba('00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
        expect(hexToRgba('bad', 0.2)).toBe('rgba(0, 0, 0, 0.2)');
    });

    it('picks a readable text colour', () => {
        expect(getContrastColor('#ffffff')).toBe('#000000');
        expect(getContrastColor('#000000')).toBe('#ffffff');
        expect(getContrastColor('nope')).toBe('#000000');
    });

    it('validates hex colours', () => {
        expect(isValidHexColor('#abc')).toBe(true);
        expect(isValidHexColor('#A1B2C3')).toBe(true);
        expect(isValidHexColor('abc')).toBe(false);
        expect(isValidHexColor('#abcd')).toBe(false);
        expect(COLOR_PALETTES.stroke.every(isValidHexColor)).toBe(true);
    });
});

describe('idGenerator', () => {
    it('generates unique, prefixed ids', () => {
        const ids = new Set(Array.from({ length: 50 }, () => generateId()));
        expect(ids.size).toBe(50);
        expect(generateId('x')).toMatch(/^x_/);
        expect(generateTabId()).toMatch(/^tab_/);
        expect(generateFolderId()).toMatch(/^folder_/);
        expect(generateBoardId()).toMatch(/^board_/);
        expect(generateTaskId()).toMatch(/^task_/);
        expect(generateNoteId()).toMatch(/^note_/);
        expect(generateSessionId()).toMatch(/^session_/);
    });

    it('falls back when crypto.randomUUID is unavailable', () => {
        vi.stubGlobal('crypto', {});
        try {
            expect(generateId('p')).toMatch(/^p_\d+-[a-z0-9]+$/);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('tabUtils', () => {
    it('creates a closed tab from a history item', () => {
        const tab = createTabFromHistoryItem(
            { id: 'h1', url: 'https://a.dev', title: 'A', favicon: 'f.png', createdAt: '' },
            'folder_1'
        );
        expect(tab).toMatchObject({
            title: 'A',
            url: 'https://a.dev',
            favicon: 'f.png',
            folderId: 'folder_1',
            tabId: null,
            status: 'closed',
        });
        expect(tab.id).toMatch(/^tab_\d+_h1$/);
        expect(legacyTabId()).toMatch(/^tab_\d+_[a-z0-9]+$/);
    });
});
