import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CanvasElement } from '../types/canvas';

interface LayerItemProps {
    element: CanvasElement;
    isSelected: boolean;
    onSelect: (id: string, multi: boolean) => void;
    onToggleLock: (id: string) => void;
    onToggleVisibility: (id: string) => void;
}

const getElementIcon = (type: string) => {
    switch (type) {
        case 'rectangle':
            return '▭';
        case 'ellipse':
            return '◯';
        case 'line':
            return '╱';
        case 'text':
            return 'T';
        case 'note':
            return '📝';
        case 'path':
            return '✎'; // Pen/Path
        default:
            return '□';
    }
};

const getElementName = (element: CanvasElement) => {
    if ('text' in element && element.text) {
        return element.text.split('\n')[0] || element.type;
    }
    return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};

export const LayerItem: React.FC<LayerItemProps> = ({
    element,
    isSelected,
    onSelect,
    onToggleLock,
    onToggleVisibility,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent drag start if clicking not on drag handle?
            // Actually dnd-kit handles this nicely.
            onSelect(element.id, e.ctrlKey || e.metaKey || e.shiftKey);
        },
        [element.id, onSelect]
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`layer-item ${isSelected ? 'selected' : ''} ${element.isLocked ? 'locked' : ''} ${element.isVisible === false ? 'hidden' : ''}`}
            onClick={handleClick}
        >
            <div className="layer-icon">{getElementIcon(element.type)}</div>

            <div className="layer-name">{getElementName(element)}</div>

            <div className="layer-actions" onPointerDown={e => e.stopPropagation()}>
                <button
                    className={`layer-action-btn ${element.isLocked ? 'active' : ''}`}
                    onClick={e => {
                        e.stopPropagation();
                        onToggleLock(element.id);
                    }}
                    title={element.isLocked ? 'Unlock' : 'Lock'}
                >
                    {element.isLocked ? '🔒' : '🔓'}
                </button>
                <button
                    className={`layer-action-btn ${element.isVisible === false ? 'active' : ''}`}
                    onClick={e => {
                        e.stopPropagation();
                        onToggleVisibility(element.id);
                    }}
                    title={element.isVisible === false ? 'Show' : 'Hide'}
                >
                    {element.isVisible === false ? '🚫' : '👁️'}
                </button>
            </div>
        </div>
    );
};
