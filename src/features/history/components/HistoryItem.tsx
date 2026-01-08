import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import '../HistoryView.css';
import { Folder, HistoryItem as HistoryItemType } from '../../../types';

interface HistoryItemProps {
    item: HistoryItemType;
    folders: Folder[];
    selectedFolderId: string;
    isSelected: boolean;
    isAdded: boolean;
    onSelectFolder: (folderId: string) => void;
    onSelectHistoryItem: (itemId: string) => void;
    onAddToFolder: (item: HistoryItemType) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
    item,
    folders,
    selectedFolderId,
    isSelected,
    isAdded,
    onSelectFolder,
    onSelectHistoryItem,
    onAddToFolder,
}) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `history_${item.id}`,
        data: {
            type: 'HistoryItem',
            item,
        },
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="history-item">
            <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="history-link"
                onClick={e => isDragging && e.preventDefault()}
            >
                <div className="history-content">
                    {item.favicon && (
                        <img
                            src={item.favicon}
                            alt="Favicon"
                            className="history-favicon"
                            onError={e => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                            }}
                        />
                    )}
                    <div className="history-text">
                        <h3 className="history-title">{item.title}</h3>
                        <p className="history-url">{item.url}</p>
                        {item.lastVisitTime && (
                            <p className="history-time">Visited: {new Date(item.lastVisitTime).toLocaleString()}</p>
                        )}
                        {item.visitCount !== undefined && <p className="history-count">Visits: {item.visitCount}</p>}
                    </div>
                </div>
            </a>
            <div className="history-actions" onPointerDown={e => e.stopPropagation()}>
                {isAdded ? (
                    <div className="added-indicator">
                        <span className="added-text">✓ Added to folder</span>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                alert(`Item "${item.title}" has been added to a folder`);
                            }}
                            className="modify-btn"
                        >
                            Modify
                        </button>
                    </div>
                ) : (
                    <>
                        <select
                            value={isSelected ? selectedFolderId || '' : ''}
                            onChange={e => {
                                onSelectHistoryItem(item.id);
                                onSelectFolder(e.target.value);
                            }}
                            className="folder-select"
                            onClick={e => e.stopPropagation()}
                            onPointerDown={e => e.stopPropagation()}
                        >
                            <option value="">Select folder...</option>
                            {folders.map(folder => (
                                <option key={folder.id} value={folder.id}>
                                    {folder.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                onAddToFolder(item);
                            }}
                            className="add-to-folder-btn"
                            disabled={!selectedFolderId || !isSelected}
                            onPointerDown={e => e.stopPropagation()}
                        >
                            Add to Folder
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default HistoryItem;
