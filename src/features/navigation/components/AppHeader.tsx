import React from 'react';
import SearchBar from '../../ui/components/SearchBar';
import ThemeToggle from '../../ui/components/ThemeToggle';
import { SearchResult } from '../../../types';
import { useUIActions } from '../../ui/store/uiStore';

interface AppHeaderProps {
    onSearchResultClick: (result: SearchResult) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onSearchResultClick }) => {
    const { toggleCommandPalette } = useUIActions();

    return (
        <header className="app-header">
            <div className="header-left">
                <h1>TabBoard</h1>
            </div>

            <div className="header-center">
                <SearchBar onResultClick={onSearchResultClick} />
            </div>

            <div className="header-right">
                <ThemeToggle />
                <button
                    className="command-palette-trigger"
                    onClick={() => toggleCommandPalette()}
                    title="Command Palette (Ctrl+K)"
                    aria-label="Open command palette"
                >
                    ⌘K
                </button>
            </div>
        </header>
    );
};

export default AppHeader;
