import React from 'react';
import { Session } from '../../../types';
import SessionCard from '../../ui/components/SessionCard';
import '../../ui/components/SessionCard.css';

interface SessionListProps {
    sessions: Session[];
    onRestore: (session: Session) => void;
    onEnd: (id: string) => void;
    onDelete: (id: string) => void;
    onRename?: (id: string, name: string) => void;
    /** Present only when on-device AI can be used */
    onSuggestName?: (session: Session) => Promise<string> | undefined;
}

const SessionList: React.FC<SessionListProps> = ({ sessions, onRestore, onEnd, onDelete, onRename, onSuggestName }) => {
    if (sessions.length === 0) {
        return <p className="no-sessions">No sessions found. Create a new session or infer from history.</p>;
    }

    return (
        <div className="sessions-list">
            <div className="sessions-grid">
                {sessions.map(session => (
                    <SessionCard
                        key={session.id}
                        session={session}
                        onRestore={onRestore}
                        onEnd={onEnd}
                        onDelete={onDelete}
                        onRename={onRename}
                        onSuggestName={onSuggestName}
                    />
                ))}
            </div>
        </div>
    );
};

export default SessionList;
