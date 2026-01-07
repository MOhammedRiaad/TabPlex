import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { LayerItem } from './LayerItem';
import { CanvasElement } from '../types/canvas';

interface LayerListProps {
    elements: CanvasElement[];
    selectedIds: string[];
    onSelect: (id: string, multi: boolean) => void;
    onToggleLock: (id: string) => void;
    onToggleVisibility: (id: string) => void;
}

export const LayerList: React.FC<LayerListProps> = ({
    elements,
    selectedIds,
    onSelect,
    onToggleLock,
    onToggleVisibility,
}) => {
    // We want the list to show top layers at the TOP of the list visually.
    // In canvas, usually last element = top.
    // So we should reverse the display order for the UI list?
    // Typical layer panels: Top of list = Front of canvas (Z-index high).
    // Our elements array: Index 0 = Back, Index N = Front.
    // So yes, we should reverse the list for display.
    // BUT, dnd-kit sortable expects the id list to match.
    // If we map reversed, we need to handle index updates correctly.
    // Let's create a derived reversed list.

    // Actually, let's keep it simple first.
    // If we render in array order (0 to N), 0 is at top of panel.
    // This means Back layer is at Top of panel.
    // That's usually opposite of expectations (Top layer at Top of panel).
    // Let's fix this in the parent container or here.

    // For now, let's render them in reversed order for the UI logic,
    // but we need to match ids for SortableContext.

    const reversedElements = [...elements].reverse();
    const itemIds = reversedElements.map(el => el.id);

    return (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <div className="layer-list">
                {reversedElements.map(element => (
                    <LayerItem
                        key={element.id}
                        element={element}
                        isSelected={selectedIds.includes(element.id)}
                        onSelect={onSelect}
                        onToggleLock={onToggleLock}
                        onToggleVisibility={onToggleVisibility}
                    />
                ))}
            </div>
        </SortableContext>
    );
};
