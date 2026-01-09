// React is used for JSX compilation
import React, { useRef, useEffect, useCallback } from 'react';
import { HashRouter, useNavigate, useLocation } from 'react-router-dom';
import TimerManager from './features/sessions/components/TimerManager';
import CommandPalette from './features/ui/components/CommandPalette';
import AppHeader from './features/navigation/components/AppHeader';
import AppNav from './features/navigation/components/AppNav';
import { AppRoutes, viewToPath, pathToView, isValidRoute } from './routes';
import { useStorageSync } from './hooks/useStorageSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useUIStore, useUIActions, ViewType } from './features/ui/store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { downloadExportFile, importFromFile } from './utils/exportImport';
import { SearchResult } from './types';
import './App.css';

// Inner App component that uses router hooks
function AppContent() {
    useStorageSync(); // Initialize storage sync
    useTheme(); // Initialize theme

    const navigate = useNavigate();
    const location = useLocation();

    // UI State from store
    const activeView = useUIStore(useShallow(state => state.activeView));
    const isCommandPaletteOpen = useUIStore(useShallow(state => state.isCommandPaletteOpen));
    const { setActiveView, setCommandPaletteOpen } = useUIActions();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Use refs to track navigation source and prevent infinite loops
    const isNavigatingFromState = useRef(false);
    const isNavigatingFromUrl = useRef(false);
    const isInitialMount = useRef(true);

    // Initialize route on mount - sync URL with initial state
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            const currentPath = location.pathname;
            const expectedPath = viewToPath(activeView);

            // Only update URL on mount if it's root or empty, or if it doesn't match expected
            if (currentPath === '/' || currentPath === '' || !isValidRoute(currentPath)) {
                isNavigatingFromState.current = true;
                navigate(expectedPath, { replace: true });
            } else {
                // If URL is valid, sync state to URL
                const viewFromPath = pathToView(currentPath);
                if (viewFromPath !== activeView) {
                    isNavigatingFromUrl.current = true;
                    setActiveView(viewFromPath);
                }
            }
        }
    }, []); // Only run on mount

    // Sync activeView with URL when location changes (browser back/forward or direct navigation)
    useEffect(() => {
        if (isNavigatingFromState.current) {
            isNavigatingFromState.current = false;
            return; // Skip if we just updated URL from state
        }

        const viewFromPath = pathToView(location.pathname);
        if (viewFromPath !== activeView) {
            isNavigatingFromUrl.current = true;
            setActiveView(viewFromPath);
        }
    }, [location.pathname, activeView, setActiveView]);

    // Sync URL with activeView when activeView changes (but not from URL navigation)
    useEffect(() => {
        if (isNavigatingFromUrl.current) {
            isNavigatingFromUrl.current = false;
            return; // Skip if we just updated state from URL
        }

        const currentPath = location.pathname;
        const expectedPath = viewToPath(activeView);

        // Only update URL if it doesn't match the expected path
        if (currentPath !== expectedPath) {
            isNavigatingFromState.current = true;
            navigate(expectedPath, { replace: true });
        }
    }, [activeView, navigate, location.pathname]);

    // Enhanced setActiveView that also updates URL
    const navigateToView = useCallback(
        (view: ViewType) => {
            isNavigatingFromState.current = true;
            setActiveView(view);
            navigate(viewToPath(view), { replace: true });
        },
        [setActiveView, navigate]
    );

    // Use keyboard shortcuts
    useKeyboardShortcuts(
        activeView as 'boards' | 'history' | 'sessions' | 'today' | 'bookmarks',
        navigateToView as (view: 'boards' | 'history' | 'sessions' | 'today' | 'bookmarks') => void
    );

    const handleExport = async () => {
        try {
            await downloadExportFile();
            alert('Data exported successfully!');
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                await importFromFile(file);
                alert('Data imported successfully! The extension will reload to reflect changes.');
                window.location.reload(); // Reload to refresh all data
            } catch (error) {
                console.error('Import failed:', error);
                alert('Import failed. Please check the file format and try again.');
            }
        }
        // Reset the input so the same file can be imported again if needed
        e.target.value = '';
    };

    const handleSearchResultClick = useCallback(
        (result: SearchResult) => {
            // Navigate to appropriate view based on result type
            switch (result.type) {
                case 'tab':
                case 'folder':
                    navigateToView('boards');
                    break;
                case 'task':
                case 'note':
                    navigateToView('today');
                    break;
                case 'session':
                    navigateToView('sessions');
                    break;
                case 'bookmark':
                    navigateToView('bookmarks');
                    break;
            }
        },
        [navigateToView]
    );

    // Listen for command palette shortcut (Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(!isCommandPaletteOpen);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCommandPaletteOpen, setCommandPaletteOpen]);

    // Listen for export event from keyboard shortcuts
    useEffect(() => {
        const handleExportEvent = () => {
            handleExport();
        };

        const handleImportEvent = () => {
            handleImportClick();
        };

        window.addEventListener('exportData', handleExportEvent);
        window.addEventListener('importData', handleImportEvent);

        return () => {
            window.removeEventListener('exportData', handleExportEvent);
            window.removeEventListener('importData', handleImportEvent);
        };
    }, []);

    return (
        <div className="app">
            <TimerManager />

            <AppHeader onSearchResultClick={handleSearchResultClick} />

            <AppNav />

            <main className={`app-main ${activeView === 'canvas' ? 'app-main-canvas' : ''}`}>
                <AppRoutes
                    onExport={handleExport}
                    onImportClick={handleImportClick}
                    onImportFile={handleImport}
                    fileInputRef={fileInputRef}
                />
            </main>

            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onNavigate={view => {
                    navigateToView(view);
                    setCommandPaletteOpen(false);
                }}
            />
        </div>
    );
}

// Outer App component that provides HashRouter
function App() {
    return (
        <HashRouter>
            <AppContent />
        </HashRouter>
    );
}

export default App;
