import React, { useMemo, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BoardView from './features/boards/BoardView';
import HistoryView from './features/history/HistoryView';
import SessionsView from './features/sessions/SessionsView';
import TodayView from './features/today/TodayView';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import CanvasContainer from './features/canvas/components/CanvasContainer';
import TldrawContainer from './features/canvas/components/TldrawContainer';
import SettingsView from './features/settings/SettingsView';
import BookmarkView from './features/bookmarks/BookmarkView';
import NotesView from './features/notes/NotesView';
import TasksView from './features/tasks/TasksView';
import PomodoroView from './features/pomodoro/PomodoroView';
import { ViewType } from './features/ui/store/uiStore';

export const ROUTES = {
    TODAY: '/today',
    BOARDS: '/boards',
    HISTORY: '/history',
    SESSIONS: '/sessions',
    ANALYTICS: '/analytics',
    CANVAS: '/canvas',
    BOOKMARKS: '/bookmarks',
    NOTES: '/notes',
    TASKS: '/tasks',
    POMODORO: '/pomodoro',
    SETTINGS: '/settings',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

// Route metadata for better organization
export const ROUTE_METADATA: Record<RoutePath, { title: string; description?: string }> = {
    [ROUTES.TODAY]: { title: 'Today', description: 'Your daily tasks and notes' },
    [ROUTES.BOARDS]: { title: 'Boards', description: 'Organize your tabs and folders' },
    [ROUTES.HISTORY]: { title: 'History', description: 'Browse your browsing history' },
    [ROUTES.SESSIONS]: { title: 'Sessions', description: 'Manage your work sessions' },
    [ROUTES.ANALYTICS]: { title: 'Analytics', description: 'View your productivity insights' },
    [ROUTES.CANVAS]: { title: 'Canvas', description: 'Draw and organize visually' },
    [ROUTES.BOOKMARKS]: { title: 'Bookmarks', description: 'Manage your bookmarks' },
    [ROUTES.NOTES]: { title: 'Notes', description: 'All your notes' },
    [ROUTES.TASKS]: { title: 'Tasks', description: 'All your tasks' },
    [ROUTES.POMODORO]: { title: 'Pomodoro', description: 'Focus timer' },
    [ROUTES.SETTINGS]: { title: 'Settings', description: 'Configure TabBoard' },
};

// Type-safe helper to convert view type to route path
export const viewToPath = (view: ViewType): RoutePath => {
    switch (view) {
        case 'today':
            return ROUTES.TODAY;
        case 'boards':
            return ROUTES.BOARDS;
        case 'history':
            return ROUTES.HISTORY;
        case 'sessions':
            return ROUTES.SESSIONS;
        case 'analytics':
            return ROUTES.ANALYTICS;
        case 'canvas':
            return ROUTES.CANVAS;
        case 'bookmarks':
            return ROUTES.BOOKMARKS;
        case 'notes':
            return ROUTES.NOTES;
        case 'tasks':
            return ROUTES.TASKS;
        case 'pomodoro':
            return ROUTES.POMODORO;
        case 'settings':
            return ROUTES.SETTINGS;
    }
    // TypeScript ensures all ViewType cases are handled above
    // This is unreachable but provides a fallback for type safety
    return ROUTES.TODAY;
};

// Type-safe helper to convert route path to view type
export const pathToView = (path: string): ViewType => {
    switch (path) {
        case ROUTES.TODAY:
            return 'today';
        case ROUTES.BOARDS:
            return 'boards';
        case ROUTES.HISTORY:
            return 'history';
        case ROUTES.SESSIONS:
            return 'sessions';
        case ROUTES.ANALYTICS:
            return 'analytics';
        case ROUTES.CANVAS:
            return 'canvas';
        case ROUTES.BOOKMARKS:
            return 'bookmarks';
        case ROUTES.NOTES:
            return 'notes';
        case ROUTES.TASKS:
            return 'tasks';
        case ROUTES.POMODORO:
            return 'pomodoro';
        case ROUTES.SETTINGS:
            return 'settings';
        case '/':
        case '':
            return 'today';
        default:
            return 'today';
    }
};

// Validate if a path is a valid route
export const isValidRoute = (path: string): boolean => {
    return Object.values(ROUTES).includes(path as RoutePath);
};

interface AppRoutesProps {
    onExport: () => void;
    onImportClick: () => void;
    onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({ onExport, onImportClick, onImportFile, fileInputRef }) => {
    // Memoize canvas component to prevent unnecessary re-renders
    const canvasComponent = useMemo(() => {
        const canvasMode = localStorage.getItem('tabboard_canvas_mode') || 'custom';
        return canvasMode === 'tldraw' ? <TldrawContainer /> : <CanvasContainer />;
    }, []); // Only recalculate if localStorage changes (which is rare)

    // Memoize settings component to prevent unnecessary re-renders
    const settingsComponent = useMemo(
        () => (
            <SettingsView
                onExport={onExport}
                onImportClick={onImportClick}
                onImportFile={onImportFile}
                fileInputRef={fileInputRef}
            />
        ),
        [onExport, onImportClick, onImportFile, fileInputRef]
    );

    // Loading fallback component
    const LoadingFallback = () => (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                fontFamily: 'system-ui',
                color: '#6b7280',
            }}
        >
            Loading...
        </div>
    );

    return (
        <Suspense fallback={<LoadingFallback />}>
            <Routes>
                {/* Specific routes - order matters for matching */}
                <Route path={ROUTES.TODAY} element={<TodayView />} />
                <Route path={ROUTES.BOARDS} element={<BoardView />} />
                <Route path={ROUTES.HISTORY} element={<HistoryView />} />
                <Route path={ROUTES.SESSIONS} element={<SessionsView />} />
                <Route path={ROUTES.ANALYTICS} element={<AnalyticsDashboard />} />
                <Route path={ROUTES.CANVAS} element={canvasComponent} />
                <Route path={ROUTES.BOOKMARKS} element={<BookmarkView />} />
                <Route path={ROUTES.NOTES} element={<NotesView />} />
                <Route path={ROUTES.TASKS} element={<TasksView />} />
                <Route path={ROUTES.POMODORO} element={<PomodoroView />} />
                <Route path={ROUTES.SETTINGS} element={settingsComponent} />
                {/* Root redirect */}
                <Route path="/" element={<Navigate to={ROUTES.TODAY} replace />} />
                {/* Catch-all for invalid routes - must be last */}
                <Route path="*" element={<Navigate to={ROUTES.TODAY} replace />} />
            </Routes>
        </Suspense>
    );
};
