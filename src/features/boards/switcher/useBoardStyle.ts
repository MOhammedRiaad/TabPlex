import { useCallback, useEffect, useRef, useState } from 'react';
import {
    BOARD_STYLE_KEY,
    BoardStyle,
    DEFAULT_BOARD_STYLE,
    isBoardStyle,
    readBoardStyle,
    saveBoardStyle,
} from './boardStyle';

/** The board style, kept in step with Settings, onboarding and other TabPlex tabs */
export function useBoardStyle() {
    const [style, setStyle] = useState<BoardStyle>(DEFAULT_BOARD_STYLE);
    // Set once the style changes here or elsewhere, so a slow first read can't overwrite the newer value
    const changed = useRef(false);

    useEffect(() => {
        let cancelled = false;
        readBoardStyle().then(loaded => {
            if (!cancelled && !changed.current) setStyle(loaded);
        });

        const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area !== 'local' || !(BOARD_STYLE_KEY in changes)) return;
            const value = changes[BOARD_STYLE_KEY].newValue;
            changed.current = true;
            setStyle(isBoardStyle(value) ? value : DEFAULT_BOARD_STYLE);
        };
        chrome.storage.onChanged.addListener(onChanged);

        return () => {
            cancelled = true;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    const updateStyle = useCallback((next: BoardStyle) => {
        changed.current = true;
        setStyle(next);
        saveBoardStyle(next);
    }, []);

    return { style, updateStyle };
}
