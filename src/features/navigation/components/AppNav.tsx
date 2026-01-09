import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ViewType } from '../../ui/store/uiStore';
import { pathToView, viewToPath } from '../../../routes';

interface NavButton {
    view: ViewType;
    label: string;
    icon: string;
}

const NAV_BUTTONS: NavButton[] = [
    { view: 'today', label: 'Today', icon: '📅' },
    { view: 'boards', label: 'Boards', icon: '📋' },
    { view: 'sessions', label: 'Sessions', icon: '⏱️' },
    { view: 'analytics', label: 'Analytics', icon: '📊' },
    { view: 'canvas', label: 'Canvas', icon: '🎨' },
    { view: 'bookmarks', label: 'Bookmarks', icon: '🔖' },
];

const AppNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active view from URL (single source of truth)
    const currentView = pathToView(location.pathname);

    const isActive = (view: ViewType): boolean => {
        return currentView === view;
    };

    const handleNavigate = (view: ViewType) => {
        // Use the viewToPath helper for type-safe navigation
        navigate(viewToPath(view), { replace: true });
    };

    return (
        <nav className="app-nav" role="navigation" aria-label="Main navigation">
            <div className="nav-links">
                {NAV_BUTTONS.map(({ view, label, icon }) => (
                    <button
                        key={view}
                        className={isActive(view) ? 'nav-btn active' : 'nav-btn'}
                        onClick={() => handleNavigate(view)}
                        aria-current={isActive(view) ? 'page' : undefined}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>
        </nav>
    );
};

export default AppNav;
