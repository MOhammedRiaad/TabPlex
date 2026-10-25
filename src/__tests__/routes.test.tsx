import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes, ROUTES, isValidRoute, pathToView, viewToPath } from '../routes';
import type { ViewType } from '../features/ui/store/uiStore';

vi.mock('../features/canvas/components/CanvasContainer', () => ({
    default: () => <div data-testid="custom-canvas" />,
}));
vi.mock('../features/canvas/components/TldrawContainer', () => ({
    default: () => <div data-testid="tldraw-canvas" />,
}));

const VIEWS: ViewType[] = [
    'today',
    'boards',
    'history',
    'sessions',
    'analytics',
    'canvas',
    'bookmarks',
    'notes',
    'tasks',
    'pomodoro',
    'settings',
];

describe('route helpers', () => {
    it.each(VIEWS)('maps the %s view to its path and back', view => {
        expect(pathToView(viewToPath(view))).toBe(view);
        expect(isValidRoute(viewToPath(view))).toBe(true);
    });

    it('maps the pomodoro view to /pomodoro', () => {
        expect(viewToPath('pomodoro')).toBe(ROUTES.POMODORO);
        expect(pathToView('/pomodoro')).toBe('pomodoro');
    });

    it('treats the root, an empty path and unknown paths as the Today view', () => {
        expect(pathToView('/')).toBe('today');
        expect(pathToView('')).toBe('today');
        expect(pathToView('/nowhere')).toBe('today');
    });

    it('only accepts the known paths', () => {
        expect(isValidRoute('/canvas')).toBe(true);
        expect(isValidRoute('/')).toBe(false);
        expect(isValidRoute('/nowhere')).toBe(false);
    });
});

describe('AppRoutes canvas', () => {
    const renderCanvas = () =>
        render(
            <MemoryRouter initialEntries={['/canvas']}>
                <AppRoutes
                    onExport={vi.fn()}
                    onImportClick={vi.fn()}
                    onImportFile={vi.fn()}
                    fileInputRef={createRef<HTMLInputElement>()}
                />
            </MemoryRouter>
        );

    it('shows the custom canvas by default', async () => {
        renderCanvas();

        expect(await screen.findByTestId('custom-canvas')).toBeInTheDocument();
        expect(screen.queryByTestId('tldraw-canvas')).toBeNull();
    });

    it('shows the tldraw canvas when that mode was chosen', async () => {
        localStorage.setItem('tabboard_canvas_mode', 'tldraw');

        renderCanvas();

        expect(await screen.findByTestId('tldraw-canvas')).toBeInTheDocument();
        expect(screen.queryByTestId('custom-canvas')).toBeNull();
    });
});
