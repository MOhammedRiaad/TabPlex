import React, { useState, useEffect, useRef } from 'react';
import { Session } from '../../../types';
import './SessionCard.css';

interface SessionCardProps {
    session: Session;
    onRestore: (session: Session) => void;
    onEnd: (sessionId: string) => void;
    onDelete: (sessionId: string) => void;
    onRename?: (sessionId: string, name: string) => void;
    /** On-device AI name for the session; only passed when AI can be used */
    onSuggestName?: (session: Session) => Promise<string> | undefined;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onRestore, onEnd, onDelete, onRename, onSuggestName }) => {
    const [showActions, setShowActions] = useState(false);
    /** The name being edited, or null when not editing */
    const [draftName, setDraftName] = useState<string | null>(null);
    const [naming, setNaming] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (draftName !== null && !naming) nameInputRef.current?.focus();
    }, [draftName, naming]);

    const saveName = () => {
        if (draftName !== null && draftName.trim() && draftName.trim() !== session.name) {
            onRename?.(session.id, draftName);
        }
        setDraftName(null);
    };

    /** Called in the click: the AI session must start there */
    const suggest = () => {
        const pending = onSuggestName?.(session);
        if (!pending) return;
        setDraftName(session.name);
        setNaming(true);
        pending
            .then(name => setDraftName(current => (current === null ? null : name)))
            .catch(() => undefined) // keep the current name; the user can type one
            .finally(() => setNaming(false));
    };
    const actionsRef = useRef<HTMLDivElement>(null);
    const isEnded = !!session.endTime;
    const tabCount = session.tabIds ? session.tabIds.length : 0;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const calculateDuration = () => {
        if (!session.endTime) return null;
        const start = new Date(session.startTime);
        const end = new Date(session.endTime);
        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));

        if (diffMins < 60) {
            return `${diffMins}m`;
        }
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
                setShowActions(false);
            }
        };

        if (showActions) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showActions]);

    return (
        <article className="session-card" aria-labelledby={`session-title-${session.id}`}>
            <header className="session-card-header">
                <div className="session-title-wrapper">
                    {draftName === null ? (
                        <h3 id={`session-title-${session.id}`} className="session-name" title={session.name}>
                            {session.name}
                        </h3>
                    ) : (
                        <input
                            ref={nameInputRef}
                            id={`session-title-${session.id}`}
                            className="session-name-input"
                            aria-label="Session name"
                            value={naming ? 'Naming…' : draftName}
                            disabled={naming}
                            maxLength={60}
                            onChange={e => setDraftName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') saveName();
                                if (e.key === 'Escape') setDraftName(null);
                            }}
                            onBlur={saveName}
                        />
                    )}
                    {!isEnded && (
                        <mark className="session-status-badge active" aria-label="Active session">
                            Active
                        </mark>
                    )}
                    {isEnded && (
                        <mark className="session-status-badge ended" aria-label="Ended session">
                            Ended
                        </mark>
                    )}
                </div>
                <nav className="session-actions-wrapper" ref={actionsRef} aria-label="Session actions">
                    <button
                        className="session-actions-toggle"
                        onClick={() => setShowActions(!showActions)}
                        aria-label="Toggle actions menu"
                        aria-expanded={showActions}
                        aria-haspopup="true"
                        aria-controls={`session-menu-${session.id}`}
                    >
                        <span aria-hidden="true">⋯</span>
                    </button>
                    {showActions && (
                        <ul
                            id={`session-menu-${session.id}`}
                            className="session-actions-menu"
                            role="menu"
                            aria-label="Session actions"
                        >
                            <li role="none">
                                <button
                                    onClick={() => {
                                        onRestore(session);
                                        setShowActions(false);
                                    }}
                                    className="session-action-btn restore"
                                    role="menuitem"
                                    aria-label="Restore session tabs"
                                >
                                    <span className="action-icon" aria-hidden="true">
                                        ↻
                                    </span>
                                    <span>Restore</span>
                                </button>
                            </li>
                            {!isEnded && (
                                <li role="none">
                                    <button
                                        onClick={() => {
                                            onEnd(session.id);
                                            setShowActions(false);
                                        }}
                                        className="session-action-btn end"
                                        role="menuitem"
                                        aria-label="End session"
                                    >
                                        <span className="action-icon" aria-hidden="true">
                                            ⏹
                                        </span>
                                        <span>End</span>
                                    </button>
                                </li>
                            )}
                            {onRename && (
                                <li role="none">
                                    <button
                                        onClick={() => {
                                            setDraftName(session.name);
                                            setShowActions(false);
                                        }}
                                        className="session-action-btn"
                                        role="menuitem"
                                    >
                                        <span className="action-icon" aria-hidden="true">
                                            ✎
                                        </span>
                                        <span>Rename</span>
                                    </button>
                                </li>
                            )}
                            {onRename && onSuggestName && (
                                <li role="none">
                                    <button
                                        onClick={() => {
                                            suggest();
                                            setShowActions(false);
                                        }}
                                        className="session-action-btn"
                                        role="menuitem"
                                    >
                                        <span className="action-icon" aria-hidden="true">
                                            ✨
                                        </span>
                                        <span>Suggest a name</span>
                                    </button>
                                </li>
                            )}
                            <li role="none">
                                <button
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this session?')) {
                                            onDelete(session.id);
                                        }
                                        setShowActions(false);
                                    }}
                                    className="session-action-btn delete"
                                    role="menuitem"
                                    aria-label="Delete session"
                                >
                                    <span className="action-icon" aria-hidden="true">
                                        🗑
                                    </span>
                                    <span>Delete</span>
                                </button>
                            </li>
                        </ul>
                    )}
                </nav>
            </header>

            <section className="session-card-body">
                <dl className="session-meta-grid">
                    <div className="session-meta-item">
                        <dt className="meta-label">
                            <span className="sr-only">Session started</span>
                            Started
                        </dt>
                        <dd className="meta-value">
                            <time dateTime={session.startTime} title={new Date(session.startTime).toLocaleString()}>
                                {formatDate(session.startTime)}
                            </time>
                        </dd>
                    </div>
                    {isEnded && session.endTime && (
                        <div className="session-meta-item">
                            <dt className="meta-label">
                                <span className="sr-only">Session ended</span>
                                Ended
                            </dt>
                            <dd className="meta-value">
                                <time dateTime={session.endTime} title={new Date(session.endTime).toLocaleString()}>
                                    {formatDate(session.endTime)}
                                </time>
                            </dd>
                        </div>
                    )}
                    <div className="session-meta-item">
                        <dt className="meta-label">
                            <span className="sr-only">Number of tabs</span>
                            Tabs
                        </dt>
                        <dd className="meta-value tab-count" aria-label={`${tabCount} tab${tabCount !== 1 ? 's' : ''}`}>
                            {tabCount}
                        </dd>
                    </div>
                    {isEnded && calculateDuration() && (
                        <div className="session-meta-item">
                            <dt className="meta-label">
                                <span className="sr-only">Session duration</span>
                                Duration
                            </dt>
                            <dd className="meta-value" aria-label={`Session duration: ${calculateDuration()}`}>
                                {calculateDuration()}
                            </dd>
                        </div>
                    )}
                </dl>

                {session.summary && (
                    <aside className="session-summary" aria-label="Session summary">
                        <p>{session.summary}</p>
                    </aside>
                )}

                <nav className="session-actions-inline" aria-label="Quick actions">
                    <button
                        onClick={() => onRestore(session)}
                        className="session-btn-primary"
                        aria-label="Restore session tabs"
                    >
                        <span aria-hidden="true">↻</span>
                        <span>Restore</span>
                    </button>
                    {!isEnded && (
                        <button
                            onClick={() => onEnd(session.id)}
                            className="session-btn-secondary"
                            aria-label="End session"
                        >
                            <span aria-hidden="true">⏹</span>
                            <span>End</span>
                        </button>
                    )}
                    {isEnded && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this session?')) {
                                    onDelete(session.id);
                                }
                                setShowActions(false);
                            }}
                            className="session-btn-secondary"
                            aria-label="Delete session"
                        >
                            <span aria-hidden="true">🗑</span>
                            <span>Delete</span>
                        </button>
                    )}
                </nav>
            </section>
        </article>
    );
};

export default SessionCard;
