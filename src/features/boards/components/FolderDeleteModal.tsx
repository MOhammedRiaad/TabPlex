import React, { useState } from 'react';
import { Folder } from '../../../types';
import '../BoardView.css';

interface FolderDeleteModalProps {
    isOpen: boolean;
    folder: Folder;
    folderTabCount: number;
    availableFolders: Folder[];
    onClose: () => void;
    onMoveAndDelete: (targetFolderId: string) => void;
    onForceDelete: () => void;
}

const FolderDeleteModal: React.FC<FolderDeleteModalProps> = ({
    isOpen,
    folder,
    folderTabCount,
    availableFolders,
    onClose,
    onMoveAndDelete,
    onForceDelete,
}) => {
    const [selectedFolderId, setSelectedFolderId] = useState<string>('');
    const [deleteMode, setDeleteMode] = useState<'move' | 'force'>('move');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (deleteMode === 'move' && selectedFolderId) {
            onMoveAndDelete(selectedFolderId);
        } else if (deleteMode === 'force') {
            onForceDelete();
        }

        onClose();
    };

    return (
        <div className="board-modal-overlay" onClick={onClose}>
            <div className="board-modal-content" onClick={e => e.stopPropagation()}>
                <div className="board-modal-header">
                    <h3 className="board-modal-title">Delete Folder</h3>
                    <button onClick={onClose} className="board-modal-close" aria-label="Close modal" type="button">
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <path d="M15 5L5 15M5 5l10 10" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="board-modal-form">
                    <div className="board-modal-body">
                        <div className="folder-delete-warning">
                            <div className="warning-icon">⚠️</div>
                            <div className="warning-content">
                                <p className="warning-message">
                                    This folder contains <strong>{folderTabCount}</strong>{' '}
                                    {folderTabCount === 1 ? 'tab' : 'tabs'}. Choose what to do with the tabs before
                                    deleting &ldquo;{folder.name}&rdquo;.
                                </p>
                            </div>
                        </div>

                        <div className="delete-options-horizontal">
                            {/* Move tabs option */}
                            <div
                                className={`delete-option-card ${deleteMode === 'move' ? 'selected' : ''}`}
                                onClick={() => setDeleteMode('move')}
                            >
                                <input
                                    type="radio"
                                    name="deleteMode"
                                    value="move"
                                    checked={deleteMode === 'move'}
                                    onChange={() => setDeleteMode('move')}
                                    className="delete-option-radio"
                                />
                                <div className="delete-option-card-content">
                                    <div className="delete-option-icon-large">📁</div>
                                    <div className="delete-option-title">Move tabs to another folder</div>
                                    {deleteMode === 'move' && availableFolders.length > 0 && (
                                        <div className="folder-select-wrapper">
                                            <select
                                                value={selectedFolderId}
                                                onChange={e => setSelectedFolderId(e.target.value)}
                                                className="folder-select"
                                                required={deleteMode === 'move'}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <option value="">Select folder...</option>
                                                {availableFolders.map(f => (
                                                    <option key={f.id} value={f.id}>
                                                        {f.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {deleteMode === 'move' && availableFolders.length === 0 && (
                                        <p className="no-folders-message">No other folders available</p>
                                    )}
                                </div>
                            </div>

                            {/* Force delete option */}
                            <div
                                className={`delete-option-card delete-option-card-danger ${deleteMode === 'force' ? 'selected' : ''}`}
                                onClick={() => setDeleteMode('force')}
                            >
                                <input
                                    type="radio"
                                    name="deleteMode"
                                    value="force"
                                    checked={deleteMode === 'force'}
                                    onChange={() => setDeleteMode('force')}
                                    className="delete-option-radio"
                                />
                                <div className="delete-option-card-content">
                                    <div className="delete-option-icon-large">🗑️</div>
                                    <div className="delete-option-title">Delete folder and all tabs</div>
                                    {deleteMode === 'force' && (
                                        <p className="delete-option-warning">
                                            This will permanently delete all {folderTabCount} tabs
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="board-modal-footer">
                        <button type="button" onClick={onClose} className="board-action-btn">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`board-action-btn ${deleteMode === 'force' ? 'board-action-btn-danger' : 'board-action-btn-primary'}`}
                            disabled={deleteMode === 'move' && (!selectedFolderId || availableFolders.length === 0)}
                        >
                            {deleteMode === 'move' ? 'Move & Delete Folder' : 'Delete Everything'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FolderDeleteModal;
