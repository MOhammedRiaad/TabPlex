import React from 'react';
import { useTheme } from '../../../hooks/useTheme';
import './ThemeToggle.css';

const ThemeToggle: React.FC = () => {
    const { theme, resolvedTheme, setTheme } = useTheme();

    return (
        <div className="theme-toggle" role="group" aria-label="Theme selection">
            <button
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                aria-label="Light mode"
                aria-pressed={theme === 'light'}
                title="Light mode"
            >
                ☀️
            </button>
            <button
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                aria-label="Dark mode"
                aria-pressed={theme === 'dark'}
                title="Dark mode"
            >
                🌙
            </button>
            <button
                className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                onClick={() => setTheme('system')}
                aria-label="System theme"
                aria-pressed={theme === 'system'}
                title={`System (${resolvedTheme})`}
            >
                💻
            </button>
        </div>
    );
};

export default ThemeToggle;
