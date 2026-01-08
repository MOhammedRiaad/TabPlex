import React from 'react';
import { useUIStore, useUIActions } from '../../ui/store/uiStore';
import { useShallow } from 'zustand/react/shallow';

const AppNav: React.FC = () => {
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
        </nav>
    );
};

export default AppNav;
