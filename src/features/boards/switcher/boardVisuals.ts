// Small visual helpers shared by the board styles
import type { CSSProperties } from 'react';
import { Board } from '../../../types';

export const FALLBACK_BOARD_COLOR = '#3b82f6';

export function boardColor(board: Pick<Board, 'color'>): string {
    return board.color || FALLBACK_BOARD_COLOR;
}

/**
 * White text when it reaches 3:1 contrast on the colour (the WCAG level for bold labels), else dark text.
 * Blue, violet, red and slate get white; amber, teal and green get dark.
 */
export function readableTextColor(hex: string): string {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return '#ffffff';
    const channel = (offset: number) => {
        const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
    return 1.05 / (luminance + 0.05) >= 3 ? '#ffffff' : '#111827';
}

/** Up to two initials, e.g. "Side project" → "SP" */
export function boardInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return (
        words
            .slice(0, 2)
            .map(word => [...word][0])
            .join('')
            .toUpperCase() || '?'
    );
}

/** A stable number in [0, range) from an id, for small visual variations like book heights */
export function stableVariation(id: string, range: number): number {
    let hash = 7;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 100003;
    return hash % range;
}

/** Inline CSS variables for a board's colour */
export function boardColorVars(board: Pick<Board, 'color'>, extra: Record<string, string> = {}): CSSProperties {
    const color = boardColor(board);
    return { '--board-color': color, '--board-text': readableTextColor(color), ...extra } as CSSProperties;
}

/** "1 folder", "3 tabs" */
export function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}
