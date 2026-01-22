import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Folder, Tab } from '../../../types';
import BoardNode from './BoardNode';
import '../BoardView.css';

interface BoardListProps {
    folders: Folder[];
    tabs: Tab[];
    onUpdateFolder?: (id: string, changes: { name?: string; color?: string }) => void;
    onUpdateTab?: (id: string, changes: { title?: string; url?: string; folderId?: string }) => void;
    onDeleteFolder?: (id: string) => void;
    onDeleteTab?: (id: string) => void;
    onOpenTab?: (url: string) => void;
    onCreateTab?: (data: { title: string; url: string; folderId?: string }) => void;
    onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
    viewMode?: 'list' | 'grid';
}

const BoardList: React.FC<BoardListProps> = ({
    folders,
    tabs,
    onUpdateFolder,
    onUpdateTab,
    onDeleteFolder,
    onDeleteTab,
    onOpenTab,
    onCreateTab,
    onShowToast,
    viewMode = 'list',
}) => {
    // Get valid folder IDs
    const folderIds = new Set(folders.map(f => f.id));

    // Separate tabs that belong to folders vs tabs without folders (or orphaned tabs)
    const tabsWithoutFolders = tabs.filter(tab => {
        // No folder assigned
        if (!tab.folderId || tab.folderId === '') return true;
        // Has folder ID but folder no longer exists (orphaned)
        if (!folderIds.has(tab.folderId)) return true;
        return false;
    });

    // Get all tab IDs for sortable context
    const allTabIds = tabs.map(t => t.id);

    return (
        <div className={`board-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>
            <SortableContext items={allTabIds} strategy={verticalListSortingStrategy}>
                {/* Render folders with their tabs */}
                {folders.map(folder => (
                    <div key={folder.id} className="board-list-item">
                        <BoardNode
                            folder={folder}
                            tabs={tabs}
                            onUpdateFolder={onUpdateFolder}
                            onUpdateTab={onUpdateTab}
                            onDeleteFolder={onDeleteFolder}
                            onDeleteTab={onDeleteTab}
                            onOpenTab={onOpenTab}
                            onCreateTab={onCreateTab}
                            onShowToast={onShowToast}
                            folders={folders}
                        />
                    </div>
                ))}

                {/* Render tabs without folders */}
                {tabsWithoutFolders.length > 0 && (
                    <div className="board-list-section">
                        {tabsWithoutFolders.map(tab => (
                            <div key={tab.id} className="board-list-item">
                                <BoardNode
                                    tab={tab}
                                    tabs={tabs}
                                    onUpdateTab={onUpdateTab}
                                    onDeleteTab={onDeleteTab}
                                    onOpenTab={onOpenTab}
                                    onShowToast={onShowToast}
                                    folders={folders}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </SortableContext>

            {/* Empty state */}
            {folders.length === 0 && tabs.length === 0 && (
                <div className="board-empty" role="status" aria-live="polite">
                    <div className="board-empty-text">No folders or tabs yet</div>
                    <div className="board-empty-hint">
                        Create your first folder or tab to start organizing. Click the buttons above to get started.
                    </div>
                </div>
            )}
        </div>
    );
};

export default BoardList;
