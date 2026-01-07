import React, { forwardRef } from 'react';
import { useUIStore, useUIActions } from '../../ui/store/uiStore';
import { useShallow } from 'zustand/react/shallow';

interface AppNavProps {
    onExport: () => void;
    onImportClick: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// Forward ref to allow parent to access the file input
const AppNav = forwardRef<HTMLInputElement, AppNavProps>(({ onExport, onImportClick, onImportFile }, ref) => {
    const activeView = useUIStore(useShallow(state => state.activeView));
    const { setActiveView } = useUIActions();

    return (
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
                    onClick={onExport}
                    title="Export Data (Ctrl+Shift+E)"
                    aria-label="Export data"
                >
                    📤 Export
                </button>
                <button
                    className="nav-btn import-btn"
                    onClick={onImportClick}
                    title="Import Data"
                    aria-label="Import data"
                >
                    📥 Import
                </button>
                <input
                    type="file"
                    ref={ref}
                    onChange={onImportFile}
                    accept=".json"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                />
            </div>
        </nav>
    );
});

AppNav.displayName = 'AppNav';

export default AppNav;
