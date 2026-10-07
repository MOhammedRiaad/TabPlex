// How the Boards view lets you move between boards (docs/specs/BOARD_VIEWS.md).
// Stored in chrome.storage.local so onboarding.html (plain JS) can set it too.

export type BoardStyle = 'tabs' | 'accordion' | 'bookshelf' | 'carousel' | 'dock' | 'overview' | 'dropdown';

export const BOARD_STYLE_KEY = 'tabplex_board_style';
/** Used until the user picks one (onboarding skipped, or storage unavailable) */
export const DEFAULT_BOARD_STYLE: BoardStyle = 'tabs';

export interface BoardStyleOption {
    id: BoardStyle;
    label: string;
    description: string;
}

/** Every style, in the order the pickers show them. onboarding.html lists the same ids (kept in step by a test). */
export const BOARD_STYLES: BoardStyleOption[] = [
    { id: 'tabs', label: 'Board tabs', description: 'Browser-style tabs above the board' },
    { id: 'accordion', label: 'Accordion', description: 'Coloured strips; the open board fills the space' },
    { id: 'bookshelf', label: 'Bookshelf', description: 'Boards as book spines on a shelf' },
    { id: 'carousel', label: 'Carousel', description: 'Swipe between boards side by side' },
    { id: 'dock', label: 'Side dock', description: 'A slim rail of board avatars' },
    { id: 'overview', label: 'Overview', description: 'Zoom out to see every board' },
    { id: 'dropdown', label: 'Dropdown', description: 'A compact board list in the header' },
];

export function isBoardStyle(value: unknown): value is BoardStyle {
    return BOARD_STYLES.some(option => option.id === value);
}

/** The saved style, or the default */
export async function readBoardStyle(): Promise<BoardStyle> {
    try {
        const result = await chrome.storage.local.get([BOARD_STYLE_KEY]);
        const value = result[BOARD_STYLE_KEY];
        return isBoardStyle(value) ? value : DEFAULT_BOARD_STYLE;
    } catch {
        return DEFAULT_BOARD_STYLE;
    }
}

export function saveBoardStyle(style: BoardStyle): Promise<void> {
    return chrome.storage.local.set({ [BOARD_STYLE_KEY]: style }).catch(console.error);
}
