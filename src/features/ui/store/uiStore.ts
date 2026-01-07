import { create } from 'zustand';

export type ViewType = 'boards' | 'history' | 'sessions' | 'today' | 'analytics' | 'canvas';

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
    activeView: (localStorage.getItem('tabboard-active-view') as ViewType) || 'today',
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
