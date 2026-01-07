import React, { useEffect, useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { HistoryItem } from '../../types';
import './HistoryView.css';
import HistoryHeader from './components/HistoryHeader';
import HistoryList from './components/HistoryList';

const HistoryView: React.FC = () => {
    const { history, fetchHistory, fetchBrowserHistory, folders, addTab } = useBoardStore();
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [addedToFolder, setAddedToFolder] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        // Load history items when the component mounts
        fetchHistory();
    }, [fetchHistory]);

    const loadBrowserHistory = async () => {
        try {
            await fetchBrowserHistory();
        } catch (error) {
            console.error('Failed to load browser history:', error);
        }
    };

    const addToFolder = (historyItem: HistoryItem) => {
        if (!selectedFolderId) {
            alert('Please select a folder first');
            return;
        }

        // Create a tab object from the history item
        const tabToAdd = {
            id: `tab_${Date.now()}_${historyItem.id}`,
            title: historyItem.title,
            url: historyItem.url,
            favicon: historyItem.favicon,
            folderId: selectedFolderId,
            tabId: null,
            lastAccessed: new Date().toISOString(),
            status: 'closed' as const, // Since it's from history
            createdAt: new Date().toISOString(),
        };

        addTab(tabToAdd);

        // Mark this history item as added to a folder
        setAddedToFolder(prev => ({
            ...prev,
            [historyItem.id]: true,
        }));

        // Reset the selection
        setSelectedHistoryItem(null);
        setSelectedFolderId('');

        alert(`Added "${historyItem.title}" to folder`);
    };

    return (
        <div className="history-view">
            <HistoryHeader onLoadRecent={loadBrowserHistory} />

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
    );
};

export default HistoryView;
