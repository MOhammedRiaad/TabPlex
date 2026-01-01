import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface UseThemeReturn {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'tabboard_theme';

/**
 * Custom hook for managing theme with system detection and persistence
 */
export const useTheme = (): UseThemeReturn => {
    const [theme, setThemeState] = useState<Theme>(() => {
        // Get stored theme or default to system
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(THEME_STORAGE_KEY);
            if (stored === 'light' || stored === 'dark' || stored === 'system') {
                return stored;
            }
        }
        return 'system';
    });

    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Apply theme to document
    useEffect(() => {
        const resolvedTheme = theme === 'system' ? systemTheme : theme;
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }, [theme, systemTheme]);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        const resolvedTheme = theme === 'system' ? systemTheme : theme;
        const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    }, [theme, systemTheme, setTheme]);

    const resolvedTheme = theme === 'system' ? systemTheme : theme;

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
    };
};

export default useTheme;
