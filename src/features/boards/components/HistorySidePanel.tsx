import React, { useEffect } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import HistoryList from '../../history/components/HistoryList';
import { HistoryItem } from '../../../types';
import './HistorySidePanel.css';

interface HistorySidePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const HistorySidePanel: React.FC<HistorySidePanelProps> = ({ isOpen, onClose }) => {
    const { history, fetchHistory, fetchBrowserHistory, folders, addTab } = useBoardStore();
    const [selectedHistoryItem, setSelectedHistoryItem] = React.useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = React.useState<string>('');
    const [addedToFolder, setAddedToFolder] = React.useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, fetchHistory]);

    const addToFolder = (historyItem: HistoryItem) => {
        if (!selectedFolderId) {
            alert('Please select a folder first');
            return;
        }

        const tabToAdd = {
            id: `tab_${Date.now()}_${historyItem.id}`,
            title: historyItem.title,
            url: historyItem.url,
            favicon: historyItem.favicon,
            folderId: selectedFolderId,
            tabId: null,
            lastAccessed: new Date().toISOString(),
            status: 'closed' as const,
            createdAt: new Date().toISOString(),
        };

        addTab(tabToAdd);

        setAddedToFolder(prev => ({
            ...prev,
            [historyItem.id]: true,
        }));

        setSelectedHistoryItem(null);
        setSelectedFolderId('');
    };

    const loadBrowserHistory = async () => {
        try {
            await fetchBrowserHistory();
        } catch (error) {
            console.error('Failed to load browser history:', error);
        }
    };

    return (
        <div className={`history-side-panel ${isOpen ? 'open' : ''}`}>
            <div className="history-panel-header">
                <h3>History</h3>
                <button onClick={loadBrowserHistory} className="history-load-btn">
                    Load Recent
                </button>
                <button className="close-panel-btn" onClick={onClose}>
                    ✕
                </button>
            </div>
            <div className="history-panel-content">
                <HistoryList
                    history={history}
                    folders={folders}
                    selectedHistoryItem={selectedHistoryItem}
                    selectedFolderId={selectedFolderId}
                    addedToFolder={addedToFolder}
                    onSelectFolder={setSelectedFolderId}
                    onSelectHistoryItem={setSelectedHistoryItem}
                    onAddToFolder={addToFolder}
                />
            </div>
        </div>
    );
};

export default HistorySidePanel;
