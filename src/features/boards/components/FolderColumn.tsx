import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Folder, Tab } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import TabCard from './TabCard';
import AddTabForm from './AddTabForm';
import './FolderColumn.css';

interface FolderColumnProps {
    folder: Folder;
    tabs: Tab[];
}

const FolderColumn: React.FC<FolderColumnProps> = ({ folder, tabs }) => {
    const { setNodeRef, isOver } = useDroppable({ id: folder.id });
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);

    const updateFolder = useBoardStore(state => state.updateFolder);
    const deleteFolder = useBoardStore(state => state.deleteFolder);
    const folders = useBoardStore(state => state.folders);

    const handleEdit = () => {
        setIsEditing(true);
        setEditName(folder.name);
    };

    const handleSave = () => {
        updateFolder(folder.id, { name: editName });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(folder.name);
        setIsEditing(false);
    };

    const handleDeleteFolder = () => {
        // Find tabs in this folder
        const tabsInFolder = tabs.filter(tab => tab.folderId === folder.id);

        if (tabsInFolder.length > 0) {
            // Folder has tabs - ask user if they want to move or delete
            const userChoice = window.confirm(
                `This folder contains ${tabsInFolder.length} tab(s).\n\n` +
                    `Do you want to delete the folder and all its tabs?\n` +
                    `Click 'OK' to delete folder and tabs, 'Cancel' to move tabs to another folder.`
            );

            if (userChoice) {
                // User wants to delete folder and all tabs
                deleteFolder(folder.id, false, '');
            } else {
                // User wants to move tabs to another folder
                const otherFolders = folders.filter(f => f.id !== folder.id);
                if (otherFolders.length > 0) {
                    const targetFolderNames = otherFolders.map(f => f.name).join(', ');
                    const targetFolderId = prompt(
                        `Select a folder to move the ${tabsInFolder.length} tab(s) to:\n\n` +
                            `Available folders: ${targetFolderNames}\n\n` +
                            `Enter the folder name or ID to move tabs there:`
                    );

                    if (targetFolderId) {
                        const targetFolder = otherFolders.find(
                            f => f.name === targetFolderId || f.id === targetFolderId
                        );

                        if (targetFolder) {
                            deleteFolder(folder.id, true, targetFolder.id);
                        } else {
                            alert('Invalid folder selected. Folder deletion cancelled.');
                        }
                    }
                } else {
                    // No other folders exist, ask again
                    const finalChoice = window.confirm(
                        `No other folders exist. Do you want to delete the folder and all ${tabsInFolder.length} tab(s)?\n\n` +
                            `Click 'OK' to delete everything, 'Cancel' to keep the folder.`
                    );

                    if (finalChoice) {
                        deleteFolder(folder.id, false, '');
                    }
                }
            }
        } else {
            // Folder is empty, just confirm deletion
            const confirmEmpty = window.confirm(`Are you sure you want to delete the folder "${folder.name}"?`);
            if (confirmEmpty) {
                deleteFolder(folder.id);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div
            ref={setNodeRef}
            className={`folder-column ${isOver ? 'dropping' : ''}`}
            style={{ backgroundColor: folder.color + '20' }}
        >
            <div className="folder-header">
                {isEditing ? (
                    <div className="folder-edit">
                        <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="folder-name-input"
                        />
                        <div className="folder-edit-actions">
                            <button onClick={handleSave} className="save-btn">
                                ✓
                            </button>
                            <button onClick={handleCancel} className="cancel-btn">
                                ✕
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="folder-display">
                        <h3 onClick={handleEdit}>{folder.name}</h3>
                        <div className="folder-actions">
                            <button onClick={handleEdit} className="edit-folder-btn">
                                ✏️
                            </button>
                            <button
                                onClick={() => handleDeleteFolder()}
                                className="delete-folder-btn"
                                title="Delete folder"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="tabs-container">
                <SortableContext items={tabs.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tabs.map(tab => (
                        <TabCard key={tab.id} tab={tab} />
                    ))}
                </SortableContext>
                <AddTabForm folderId={folder.id} />
            </div>
        </div>
    );
};

export default FolderColumn;
