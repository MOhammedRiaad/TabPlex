import React from 'react';
import '../SessionsView.css';

interface SessionHeaderProps {
    onStartFromCurrent: () => void;
    onInfer: () => void;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({ onStartFromCurrent, onInfer }) => {
    return (
        <div className="sessions-header">
            <h2>Browser Sessions</h2>
            <div className="session-actions">
                <button onClick={onStartFromCurrent} className="btn-primary">
                    Start Session from Current Tabs
                </button>
                <button onClick={onInfer} className="btn-secondary">
                    Infer Sessions from History
                </button>
            </div>
        </div>
    );
};

export default SessionHeader;
