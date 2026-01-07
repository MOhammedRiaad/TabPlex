// React is used for JSX compilation
import React, { useRef, useEffect, useCallback } from 'react';
import TimerManager from './features/sessions/components/TimerManager';
import BoardView from './features/boards/BoardView';
import HistoryView from './features/history/HistoryView';
import SessionsView from './features/sessions/SessionsView';
import TodayView from './features/today/TodayView';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import CanvasContainer from './features/canvas/components/CanvasContainer';
import CommandPalette from './features/ui/components/CommandPalette';
import AppHeader from './features/navigation/components/AppHeader';
import AppNav from './features/navigation/components/AppNav';
import { useStorageSync } from './hooks/useStorageSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { useUIStore, useUIActions } from './features/ui/store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { downloadExportFile, importFromFile } from './utils/exportImport';
import { SearchResult } from './types';
import './App.css';

function App() {
    useStorageSync(); // Initialize storage sync
    useTheme(); // Initialize theme

    // UI State from store
    const activeView = useUIStore(useShallow(state => state.activeView));
    const isCommandPaletteOpen = useUIStore(useShallow(state => state.isCommandPaletteOpen));
    const { setActiveView, setCommandPaletteOpen } = useUIActions();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Use keyboard shortcuts
    useKeyboardShortcuts(
        activeView as 'boards' | 'history' | 'sessions' | 'today',
        setActiveView as (view: 'boards' | 'history' | 'sessions' | 'today') => void
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
                    setActiveView('boards');
                    break;
                case 'task':
                case 'note':
                    setActiveView('today');
                    break;
                case 'session':
                    setActiveView('sessions');
                    break;
            }
        },
        [setActiveView]
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

    const renderView = () => {
        switch (activeView) {
            case 'boards':
                return <BoardView />;
            case 'history':
                return <HistoryView />;
            case 'sessions':
                return <SessionsView />;
            case 'analytics':
                return <AnalyticsDashboard />;
            case 'canvas':
                return <CanvasContainer />;
            case 'today':
            default:
                return <TodayView />;
        }
    };

    return (
        <div className="app">
            <TimerManager />

            <AppHeader onSearchResultClick={handleSearchResultClick} />

            <AppNav
                onExport={handleExport}
                onImportClick={handleImportClick}
                onImportFile={handleImport}
                ref={fileInputRef}
            />

            <main className={`app-main ${activeView === 'canvas' ? 'app-main-canvas' : ''}`}>{renderView()}</main>

            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                onNavigate={view => {
                    setActiveView(view);
                    setCommandPaletteOpen(false);
                }}
            />
        </div>
    );
}

export default App;
