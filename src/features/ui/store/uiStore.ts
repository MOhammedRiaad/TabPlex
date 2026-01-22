import { create } from 'zustand';

export type ViewType =
    | 'boards'
    | 'history'
    | 'sessions'
    | 'today'
    | 'analytics'
    | 'canvas'
    | 'bookmarks'
    | 'notes'
    | 'tasks'
    | 'pomodoro'
    | 'settings';

// Helper to get initial view from URL hash or localStorage
const getInitialView = (): ViewType => {
    // Check URL hash first (for browser back/forward support)
    if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash) {
            const path = hash.replace('#', '');
            switch (path) {
                case '/today':
                    return 'today';
                case '/boards':
                    return 'boards';
                case '/history':
                    return 'history';
                case '/sessions':
                    return 'sessions';
                case '/analytics':
                    return 'analytics';
                case '/canvas':
                    return 'canvas';
                case '/bookmarks':
                    return 'bookmarks';
                case '/notes':
                    return 'notes';
                case '/tasks':
                    return 'tasks';
                case '/pomodoro':
                    return 'pomodoro';
                case '/settings':
                    return 'settings';
            }
        }
    }
    // Fallback to localStorage
    return (localStorage.getItem('tabboard-active-view') as ViewType) || 'today';
};

interface UIState {
    activeView: ViewType;
    isCommandPaletteOpen: boolean;
    actions: {
        setActiveView: (view: ViewType) => void;
        setCommandPaletteOpen: (isOpen: boolean) => void;
        toggleCommandPalette: () => void;
    };
}

export const useUIStore = create<UIState>(set => ({
    activeView: getInitialView(),
    isCommandPaletteOpen: false,
    actions: {
        setActiveView: view => {
            localStorage.setItem('tabboard-active-view', view);
            set({ activeView: view });
        },
        setCommandPaletteOpen: isOpen => set({ isCommandPaletteOpen: isOpen }),
        toggleCommandPalette: () => set(state => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
    },
}));

export const useUIActions = () => useUIStore(state => state.actions);
