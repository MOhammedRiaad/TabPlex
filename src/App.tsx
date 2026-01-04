// React is used for JSX compilation
import React, { useState, useRef, useEffect, useCallback } from 'react';
import TimerManager from './components/TimerManager';
import BoardView from './components/BoardView';
import HistoryView from './components/HistoryView';
import SessionsView from './components/SessionsView';
import TodayView from './components/TodayView';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import CanvasView from './components/CanvasView';
import ThemeToggle from './components/ThemeToggle';
import SearchBar from './components/SearchBar';
import CommandPalette from './components/CommandPalette';
import { useStorageSync } from './hooks/useStorageSync';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { downloadExportFile, importFromFile } from './utils/exportImport';
import { SearchResult } from './types';
import './App.css';
import './components/HistoryView.css';
import './components/SessionsView.css';

type ViewType = 'boards' | 'history' | 'sessions' | 'today' | 'analytics' | 'canvas';

function App() {
  useStorageSync(); // Initialize storage sync
  useTheme(); // Initialize theme

  // Persist active view in localStorage
  const [activeView, setActiveView] = useState<ViewType>(() => {
    const saved = localStorage.getItem('tabboard-active-view');
    return (saved as ViewType) || 'today';
  });

  // Save view to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('tabboard-active-view', activeView);
  }, [activeView]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use keyboard shortcuts
  useKeyboardShortcuts(activeView as 'boards' | 'history' | 'sessions' | 'today', setActiveView as (view: 'boards' | 'history' | 'sessions' | 'today') => void);

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

  const handleSearchResultClick = useCallback((result: SearchResult) => {
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
  }, []);

  // Listen for command palette shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        return <CanvasView />;
      case 'today':
      default:
        return <TodayView />;
    }
  };

  return (
    <div className="app">
      <TimerManager />
      <header className="app-header">
        <div className="header-left">
          <h1>TabBoard</h1>
        </div>

        <div className="header-center">
          <SearchBar onResultClick={handleSearchResultClick} />
        </div>

        <div className="header-right">
          <ThemeToggle />
          <button
            className="command-palette-trigger"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Command Palette (Ctrl+K)"
            aria-label="Open command palette"
          >
            ⌘K
          </button>
        </div>
      </header>

      <nav className="app-nav" role="navigation" aria-label="Main navigation">
        <div className="nav-links">
          <button
            className={activeView === 'today' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('today')}
            aria-current={activeView === 'today' ? 'page' : undefined}
          >
            📅 Today
          </button>
          <button
            className={activeView === 'boards' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('boards')}
            aria-current={activeView === 'boards' ? 'page' : undefined}
          >
            📋 Boards
          </button>
          <button
            className={activeView === 'history' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('history')}
            aria-current={activeView === 'history' ? 'page' : undefined}
          >
            📜 History
          </button>
          <button
            className={activeView === 'sessions' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('sessions')}
            aria-current={activeView === 'sessions' ? 'page' : undefined}
          >
            ⏱️ Sessions
          </button>
          <button
            className={activeView === 'analytics' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('analytics')}
            aria-current={activeView === 'analytics' ? 'page' : undefined}
          >
            📊 Analytics
          </button>
          <button
            className={activeView === 'canvas' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setActiveView('canvas')}
            aria-current={activeView === 'canvas' ? 'page' : undefined}
          >
            🎨 Canvas
          </button>
        </div>

        <div className="export-import">
          <button
            className="nav-btn export-btn"
            onClick={handleExport}
            title="Export Data (Ctrl+Shift+E)"
            aria-label="Export data"
          >
            📤 Export
          </button>
          <button
            className="nav-btn import-btn"
            onClick={handleImportClick}
            title="Import Data"
            aria-label="Import data"
          >
            📥 Import
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      </nav>

      <main className="app-main">
        {renderView()}
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => {
          setActiveView(view);
          setIsCommandPaletteOpen(false);
        }}
      />
    </div>
  );
}

export default App;