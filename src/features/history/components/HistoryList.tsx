import React from 'react';
import '../HistoryView.css';
import HistoryItem from './HistoryItem';
import { Folder, HistoryItem as HistoryItemType } from '../../../types';

interface HistoryListProps {
    history: HistoryItemType[];
    folders: Folder[];
    selectedHistoryItem: string | null;
    selectedFolderId: string;
    addedToFolder: { [key: string]: boolean };
    onSelectFolder: (folderId: string) => void;
    onSelectHistoryItem: (itemId: string) => void;
    onAddToFolder: (item: HistoryItemType) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({
    history,
    folders,
    selectedHistoryItem,
    selectedFolderId,
    addedToFolder,
    onSelectFolder,
    onSelectHistoryItem,
    onAddToFolder,
}) => {
    if (history.length === 0) {
        return (
            <p className="no-history">
                No history items found. Click &quot;Load Recent History&quot; to fetch browser history.
            </p>
        );
    }

    return (
        <div className="history-list">
            <div className="history-grid">
                {history.map(item => (
                    <HistoryItem
                        key={item.id}
                        item={item}
                        folders={folders}
                        selectedFolderId={selectedFolderId}
                        isSelected={selectedHistoryItem === item.id}
                        isAdded={!!addedToFolder[item.id]}
                        onSelectFolder={onSelectFolder}
                        onSelectHistoryItem={onSelectHistoryItem}
                        onAddToFolder={onAddToFolder}
                    />
                ))}
            </div>
        </div>
    );
};

export default HistoryList;
