import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tab } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import './TabCard.css';

interface TabCardProps {
    tab: Tab;
    isOverlay?: boolean;
}

const TabCard: React.FC<TabCardProps> = ({ tab, isOverlay }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(tab.title);
    const [editUrl, setEditUrl] = useState(tab.url);
    const [faviconError, setFaviconError] = useState(false);

    const updateTab = useBoardStore(state => state.updateTab);
    const deleteTab = useBoardStore(state => state.deleteTab);

    const handleTabClick = () => {
        // Open the tab in a new browser tab
        window.open(tab.url, '_blank');
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete "${tab.title}"?`)) {
            deleteTab(tab.id);
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSave = () => {
        updateTab(tab.id, { title: editTitle, url: editUrl });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditTitle(tab.title);
        setEditUrl(tab.url);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    // Only use sortable hook if not an overlay
    const sortable = useSortable({
        id: tab.id,
        disabled: isOverlay || isEditing,
        data: {
            type: 'Tab',
            tab,
        },
    });

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = isOverlay
        ? { attributes: {}, listeners: {}, setNodeRef: null, transform: null, transition: null, isDragging: false }
        : sortable;

    // Style for the draggable element (placeholder when dragging)
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.3 : 1, // Dim the original item when dragging
        cursor: isOverlay ? 'grabbing' : 'default',
    };

    if (isEditing) {
        return (
            <div className="tab-card editing">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="drag-handle">⋮⋮</div>
                    <div className="tab-icon">
                        {tab.favicon && !faviconError ? (
                            <img src={tab.favicon} alt="" onError={() => setFaviconError(true)} />
                        ) : (
                            <div className="default-icon">🌐</div>
                        )}
                    </div>
                </div>
                <div className="tab-edit">
                    <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="edit-title"
                        placeholder="Title"
                    />
                    <input
                        type="text"
                        value={editUrl}
                        onChange={e => setEditUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="edit-url"
                        placeholder="URL"
                    />
                    <div className="edit-actions">
                        <button onClick={handleSave}>Save</button>
                        <button onClick={handleCancel}>Cancel</button>
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                handleDelete();
                            }}
                            className="delete-btn"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`tab-card ${isOverlay ? 'dragging overlay' : ''} ${isDragging ? 'dragging-placeholder' : ''}`}
        >
            <div className="drag-handle" {...listeners} {...attributes}>
                ⋮⋮
            </div>

            <div className="tab-icon" onClick={handleTabClick}>
                {tab.favicon && !faviconError ? (
                    <img src={tab.favicon} alt="" onError={() => setFaviconError(true)} />
                ) : (
                    <div className="default-icon" onClick={handleTabClick}>
                        🌐
                    </div>
                )}
            </div>

            <div
                className="tab-content"
                onClick={e => {
                    e.stopPropagation();
                    handleTabClick();
                }}
            >
                <h4 className="tab-title">{tab.title}</h4>
                <p className="tab-url">{tab.url}</p>
            </div>

            <div className="tab-actions">
                <button
                    className="edit-btn"
                    onClick={e => {
                        e.stopPropagation();
                        handleEdit();
                    }}
                    title="Edit"
                >
                    ✏️
                </button>
                <button
                    className="delete-btn"
                    onClick={e => {
                        e.stopPropagation();
                        handleDelete();
                    }}
                    title="Delete"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
};

export default TabCard;
