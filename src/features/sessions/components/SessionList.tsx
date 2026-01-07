import React from 'react';
import { Session } from '../../../types';
import SessionCard from '../../ui/components/SessionCard';
import '../../ui/components/SessionCard.css';

interface SessionListProps {
    sessions: Session[];
    onRestore: (session: Session) => void;
    onEnd: (id: string) => void;
    onDelete: (id: string) => void;
}

const SessionList: React.FC<SessionListProps> = ({ sessions, onRestore, onEnd, onDelete }) => {
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
                    />
                ))}
            </div>
        </div>
    );
};

export default SessionList;
