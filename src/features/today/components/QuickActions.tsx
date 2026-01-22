import React from 'react';
import { useNavigate } from 'react-router-dom';
import './QuickActions.css';

const QuickActions: React.FC = () => {
    const navigate = useNavigate();

    const handleCreateCanvasBoard = () => {
        navigate('/canvas');
    };

    const handleNewNote = () => {
        navigate('/notes');
    };

    const handleNewTask = () => {
        navigate('/tasks');
    };

    const handleStartFocus = () => {
        navigate('/pomodoro');
    };

    return (
        <div className="quick-actions-grid">
            <button className="quick-action-card task-action" onClick={handleNewTask}>
                <div className="action-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </div>
                <div className="action-info">
                    <span className="action-title">New Task</span>
                    <span className="action-desc">Add generic task</span>
                </div>
            </button>

            <button className="quick-action-card note-action" onClick={handleNewNote}>
                <div className="action-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="18" />
                    </svg>
                </div>
                <div className="action-info">
                    <span className="action-title">New Note</span>
                    <span className="action-desc">Capture idea</span>
                </div>
            </button>

            <button className="quick-action-card focus-action" onClick={handleStartFocus}>
                <div className="action-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>
                <div className="action-info">
                    <span className="action-title">Start Focus</span>
                    <span className="action-desc">Open Timer</span>
                </div>
            </button>

            <button className="quick-action-card canvas-action" onClick={handleCreateCanvasBoard}>
                <div className="action-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
                <div className="action-info">
                    <span className="action-title">Open Canvas</span>
                    <span className="action-desc">Whiteboard</span>
                </div>
            </button>
        </div>
    );
};

export default QuickActions;
