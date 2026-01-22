import React from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../../ui/components/SearchBar';
import ThemeToggle from '../../ui/components/ThemeToggle';
import { SearchResult } from '../../../types';
import { useUIActions } from '../../ui/store/uiStore';
import { ROUTES } from '../../../routes';

interface AppHeaderProps {
    onSearchResultClick: (result: SearchResult) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onSearchResultClick }) => {
    const navigate = useNavigate();
    const { toggleCommandPalette } = useUIActions();

    return (
        <header className="app-header">
            <div className="header-left">
                <h1>TabPlex</h1>
            </div>

            <div className="header-center">
                <SearchBar onResultClick={onSearchResultClick} />
            </div>

            <div className="header-right">
                <ThemeToggle />
                <button
                    className="settings-trigger"
                    onClick={() => navigate(ROUTES.SETTINGS)}
                    title="Settings"
                    aria-label="Open settings"
                >
                    ⚙️
                </button>
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
