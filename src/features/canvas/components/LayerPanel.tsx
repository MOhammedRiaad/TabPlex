import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCanvasStore } from '../store/canvasStore';
import { LayerList } from './LayerList';
import './LayerPanel.css';
import { useShallow } from 'zustand/react/shallow';

interface LayerPanelProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ isOpen = true, onClose }) => {
    const { activeCanvas, reorderElement, setSelectedIds, updateElement } = useCanvasStore(
        useShallow(state => ({
            activeCanvas: state.canvases.find(c => c.canvasId === state.activeCanvasId),
            reorderElement: state.reorderElement,
            setSelectedIds: state.setSelectedIds,
            updateElement: state.updateElement,
        }))
    );

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!activeCanvas) return null;

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const elements = activeCanvas.elements;

            // Note: Our UI list is REVERSED (Top of list = End of array).
            // But active.id and over.id are just IDs.
            // We need to find their original indices in the `elements` array.

            // const oldIndex = elements.findIndex((el) => el.id === active.id); // Unused
            const newIndex = elements.findIndex(el => el.id === over?.id);

            reorderElement(active.id as string, newIndex);
        }
    };

    const handleSelect = (id: string, multi: boolean) => {
        if (multi) {
            if (activeCanvas.selectedIds.includes(id)) {
                setSelectedIds(activeCanvas.selectedIds.filter(sid => sid !== id));
            } else {
                setSelectedIds([...activeCanvas.selectedIds, id]);
            }
        } else {
            setSelectedIds([id]);
        }
    };

    const handleToggleLock = (id: string) => {
        const element = activeCanvas.elements.find(el => el.id === id);
        if (element) {
            updateElement(id, { isLocked: !element.isLocked });
        }
    };

    const handleToggleVisibility = (id: string) => {
        const element = activeCanvas.elements.find(el => el.id === id);
        if (element) {
            updateElement(id, { isVisible: element.isVisible === false ? true : false });
        }
    };

    return (
        <div className={`layer-panel ${!isOpen ? 'closed' : ''}`}>
            <div className="layer-panel-header">
                <span>Layers</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{activeCanvas.elements.length} items</span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#6b7280',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                            title="Close Layer Panel"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <LayerList
                    elements={activeCanvas.elements}
                    selectedIds={activeCanvas.selectedIds}
                    onSelect={handleSelect}
                    onToggleLock={handleToggleLock}
                    onToggleVisibility={handleToggleVisibility}
                />
            </DndContext>
        </div>
    );
};
