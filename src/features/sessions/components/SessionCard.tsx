import React from 'react';
import { Session } from '../../../types';
import '../SessionsView.css';

interface SessionCardProps {
    session: Session;
    onRestore: (session: Session) => void;
    onEnd: (id: string) => void;
    onDelete: (id: string) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onRestore, onEnd, onDelete }) => {
    return (
        <div className="session-card">
            <div className="session-header">
                <h3 className="session-name">{session.name}</h3>
                <div className="session-actions">
                    <button onClick={() => onRestore(session)} className="btn-restore-session">
                        Restore
                    </button>
                    {session.endTime ? (
                        <span className="session-status ended">Ended</span>
                    ) : (
                        <button onClick={() => onEnd(session.id)} className="btn-end-session">
                            End Session
                        </button>
                    )}
                    <button onClick={() => onDelete(session.id)} className="btn-delete-session">
                        Delete
                    </button>
                </div>
            </div>

            <div className="session-details">
                <p className="session-start">
                    <strong>Started:</strong> {new Date(session.startTime).toLocaleString()}
                </p>
                {session.endTime && (
                    <p className="session-end">
                        <strong>Ended:</strong> {new Date(session.endTime).toLocaleString()}
                    </p>
                )}
                <p className="session-tab-count">
                    <strong>Tabs:</strong> {session.tabIds ? session.tabIds.length : 0}
                </p>
                {session.summary && (
                    <p className="session-summary">
                        <strong>Summary:</strong> {session.summary}
                    </p>
                )}
            </div>
        </div>
    );
};

export default SessionCard;
