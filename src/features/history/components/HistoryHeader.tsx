import React from 'react';
import '../HistoryView.css';

interface HistoryHeaderProps {
    onLoadRecent: () => void;
}

const HistoryHeader: React.FC<HistoryHeaderProps> = ({ onLoadRecent }) => {
    return (
        <div className="history-header">
            <h2>Browser History</h2>
            <button onClick={onLoadRecent} className="load-history-btn">
                Load Recent History
            </button>
        </div>
    );
};

export default HistoryHeader;
