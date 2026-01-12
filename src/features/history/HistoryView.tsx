import React, { useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { HistoryItem } from '../../types';
import { createTabFromHistoryItem } from '../../utils/tabUtils';
import './HistoryView.css';
import HistoryHeader from './components/HistoryHeader';
import HistoryList from './components/HistoryList';
import Toast from '../bookmarks/components/Toast';

const HistoryView: React.FC = () => {
    const { history, fetchHistory, fetchBrowserHistory, folders, addTab } = useBoardStore();
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [addedToFolder, setAddedToFolder] = useState<{ [key: string]: boolean }>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
    }, []);

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
            showToast('Please select a folder first', 'error');
            return;
        }

        // Use shared utility to create tab from history item
        const tabToAdd = createTabFromHistoryItem(historyItem, selectedFolderId);
        addTab(tabToAdd);

        // Mark this history item as added to a folder
        setAddedToFolder(prev => ({
            ...prev,
            [historyItem.id]: true,
        }));

        setSelectedHistoryItem(null);
        setSelectedFolderId('');

        showToast(`Added "${historyItem.title}" to folder`, 'success');
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default HistoryView;
