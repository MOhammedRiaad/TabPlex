import { BaseTool, ToolContext } from './Tool';
import { Point, CanvasElement, LineElement } from '../types/canvas';
import { findElementAtPoint, getResizeHandle, getRotationHandle } from '../utils/hitTest';

export class SelectTool extends BaseTool {
    type = 'select';
    private isDragging = false;
    private dragStart: Point | null = null;
    private isSelecting = false;
    private selectionStart: Point | null = null;

    // Resize state
    private isResizing = false;
    private resizeHandle: string | null = null;
    private resizeElement: CanvasElement | null = null;
    private originalBounds: { x: number; y: number; width: number; height: number } | null = null;

    // Rotation state
    private isRotating = false;
    private rotateElement: CanvasElement | null = null;
    private initialAngle = 0;
    private initialMouseAngle = 0;
    private center: Point | null = null;

    onMouseDown(point: Point, context: ToolContext): void {
        const activeCanvas = context.store.getActiveCanvas();
        if (!activeCanvas) return;

        // 1. Check for Rotation Handle
        if (activeCanvas.selectedIds.length === 1) {
            const id = activeCanvas.selectedIds[0];
            const element = activeCanvas.elements.find(el => el.id === id);

            // Cannot rotate locked elements
            if (element && !element.isLocked && element.isVisible !== false) {
                const handle = getRotationHandle(element, point);
                if (handle) {
                    this.isRotating = true;
                    this.rotateElement = element;
                    this.center = {
                        x: element.x + element.width / 2,
                        y: element.y + element.height / 2,
                    };
                    this.initialAngle = element.rotation || 0;
                    this.initialMouseAngle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
                    context.store.setCursorMode('rotating');
                    return;
                }
            }
        }

        // 2. Check for Resize Handles on selected elements
        // Iterate selected elements (reverse to prioritize topmost if overlapping? actually handles are on top)
        for (const id of activeCanvas.selectedIds) {
            const element = activeCanvas.elements.find(el => el.id === id);
            if (!element) continue;

            // Cannot resize locked elements
            if (element.isLocked || element.isVisible === false) continue;

            const handle = getResizeHandle(element, point);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.resizeElement = element;
                this.dragStart = point;
                this.originalBounds = { x: element.x, y: element.y, width: element.width, height: element.height };
                context.store.setCursorMode(`resizing-${handle}`);
                return;
            }
        }

        // 2. Element Hit Test
        const clickedElement = findElementAtPoint(activeCanvas.elements, point);

        if (clickedElement) {
            // Element Clicked

            // If locked and not already selected, do not select via canvas click?
            // Standard behavior: Locked items allow selection but not movement.
            // But if we want to prevent accidental movement, selecting IS usually allowed.
            // Let's allow selection but prevent DRAG in `onMouseMove`.

            // However, if we want "Lock" to mean "Ignore clicks", we should check here.
            // Let's implement "Lock" = "Not selectable via canvas" (common in some tools)
            // Or "Selectable but fixed".
            // User requirement: "Add visibility toggle (eye icon), Add lock toggle (lock icon)".
            // Let's go with "Selectable via Layer Panel, but NOT text/drag/resize via Canvas".
            // So if I click a locked element, do I select it?
            // If checking `isLocked` here prevents selection, then I can't select it on canvas.

            if (clickedElement.isLocked) {
                // Prevent selection via click?
                // If I click it, maybe I want to select it to UNLOCK it via properties panel?
                // Let's allow selection. Drag prevention is handled in onMouseMove.
                // But wait, handles are suppressed in my previous edit.
                // So if I select it, no resize handles appear.
                // So I can select it.
            }

            const isSelected = activeCanvas.selectedIds.includes(clickedElement.id);
            const isModifier = context.modifiers.ctrlKey || context.modifiers.metaKey;

            if (isModifier) {
                if (isSelected) {
                    // Deselect
                    const newIds = activeCanvas.selectedIds.filter(id => id !== clickedElement.id);
                    context.store.setSelectedIds(newIds);
                    // No drag start
                } else {
                    // Add to selection
                    context.store.setSelectedIds([...activeCanvas.selectedIds, clickedElement.id]);
                    // Only drag if NOT locked
                    if (!clickedElement.isLocked) {
                        this.isDragging = true;
                        this.dragStart = point;
                    }
                }
            } else {
                if (isSelected) {
                    // Already selected -> Prepare drag
                    // Check if ANY selected item is locked? Or just the one I clicked?
                    // If moving multiple, usually if one is locked, the whole group movement is restricted or just that one stays?
                    // Simpler: If the clicked one is locked, don't drag anything?
                    // Or drag allowed if clicked one is NOT locked.
                    if (!clickedElement.isLocked) {
                        this.isDragging = true;
                        this.dragStart = point;
                    }
                } else {
                    // Not selected -> Select it (replace)
                    context.store.setSelectedIds([clickedElement.id]);
                    if (!clickedElement.isLocked) {
                        this.isDragging = true;
                        this.dragStart = point;
                    }
                }
            }
        } else {
            // Empty space clicked -> Start marquee
            context.store.clearSelection();
            this.isSelecting = true;
            this.selectionStart = point;
            context.store.setSelectionBox({ start: point, end: point });
        }
    }

    onMouseMove(point: Point, context: ToolContext): void {
        const activeCanvas = context.store.getActiveCanvas();
        if (!activeCanvas) return;

        if (this.isRotating && this.rotateElement && this.center) {
            const currentAngle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
            const angleDiff = currentAngle - this.initialMouseAngle;
            let newAngle = this.initialAngle + (angleDiff * 180) / Math.PI;

            // Normalize angle
            // newAngle = newAngle % 360;

            // Snap to 15 degrees if Shift is held
            if (context.modifiers.shiftKey) {
                newAngle = Math.round(newAngle / 15) * 15;
            }

            context.store.updateElement(this.rotateElement.id, {
                rotation: newAngle,
            });
            return;
        }

        if (this.isResizing && this.resizeElement && this.originalBounds && this.dragStart && this.resizeHandle) {
            const currentPoint = point;
            const startPoint = this.dragStart;

            // Get rotation in radians
            const rotation = (this.resizeElement.rotation || 0) * (Math.PI / 180);
            const cos = Math.cos(-rotation); // Rotate backwards to align with axis
            const sin = Math.sin(-rotation);

            // Calculate Mouse Delta in Global Space
            const globalDx = currentPoint.x - startPoint.x;
            const globalDy = currentPoint.y - startPoint.y;

            // Rotate Delta to Local Space
            const dx = globalDx * cos - globalDy * sin;
            const dy = globalDx * sin + globalDy * cos;

            let newW = this.originalBounds.width;
            let newH = this.originalBounds.height;
            let newX = this.originalBounds.x;
            let newY = this.originalBounds.y;

            // Apply Local Delta to Width/Height
            if (this.resizeHandle.includes('e')) newW = Math.max(10, this.originalBounds.width + dx);
            if (this.resizeHandle.includes('w')) {
                newW = Math.max(10, this.originalBounds.width - dx);
                // In local space, x shifted by -dx? No, width means size.
                // We handle position correction via center point calculation below.
            }
            if (this.resizeHandle.includes('s')) newH = Math.max(10, this.originalBounds.height + dy);
            if (this.resizeHandle.includes('n')) newH = Math.max(10, this.originalBounds.height - dy);

            // Aspect Ratio Lock
            if (context.modifiers.shiftKey) {
                const ratio = this.originalBounds.width / this.originalBounds.height;
                if (this.resizeHandle.length === 2) {
                    // Corners
                    if (newW / ratio > newH) {
                        newH = newW / ratio;
                    } else {
                        newW = newH * ratio;
                    }
                }
            }

            // Recalculate Center Position
            // 1. Calculate how much the center moved in LOCAL space relative to the unrotated box
            // If we changed width by +10 (East), center moved +5.
            // If we changed width by +10 (West), center moved -5.
            let localCenterXOffset = 0;
            let localCenterYOffset = 0;

            if (this.resizeHandle.includes('e')) localCenterXOffset = (newW - this.originalBounds.width) / 2;
            if (this.resizeHandle.includes('w')) localCenterXOffset = -(newW - this.originalBounds.width) / 2;
            if (this.resizeHandle.includes('s')) localCenterYOffset = (newH - this.originalBounds.height) / 2;
            if (this.resizeHandle.includes('n')) localCenterYOffset = -(newH - this.originalBounds.height) / 2;

            // 2. Rotate this offset back to GLOBAL space
            const finalCos = Math.cos(rotation);
            const finalSin = Math.sin(rotation);

            const globalCenterXOffset = localCenterXOffset * finalCos - localCenterYOffset * finalSin;
            const globalCenterYOffset = localCenterXOffset * finalSin + localCenterYOffset * finalCos;

            // 3. New Center = Old Center + Global Offset
            const oldCenterX = this.originalBounds.x + this.originalBounds.width / 2;
            const oldCenterY = this.originalBounds.y + this.originalBounds.height / 2;

            const newCenterX = oldCenterX + globalCenterXOffset;
            const newCenterY = oldCenterY + globalCenterYOffset;

            // 4. New TopLeft = New Center - New Size / 2
            // Note: Canvas elements calculate position as Top-Left of the UNROTATED box.
            newX = newCenterX - newW / 2;
            newY = newCenterY - newH / 2;

            context.store.updateElement(this.resizeElement.id, {
                x: newX,
                y: newY,
                width: newW,
                height: newH,
            });
            return;
        }

        if (this.isDragging && this.dragStart && activeCanvas.selectedIds.length > 0) {
            const dx = point.x - this.dragStart.x;
            const dy = point.y - this.dragStart.y;

            // Find all elements that should move together (selected + grouped)
            const elementsToMove = new Set<string>(activeCanvas.selectedIds);

            // For each selected element, find its group and add all group members
            activeCanvas.selectedIds.forEach(selectedId => {
                const group = activeCanvas.groups.find(g => g.elementIds.includes(selectedId));
                if (group) {
                    // Add all elements in this group
                    group.elementIds.forEach(id => elementsToMove.add(id));
                }
            });

            // Move all elements (selected + grouped)
            elementsToMove.forEach(id => {
                const element = activeCanvas.elements.find(el => el.id === id);
                if (element) {
                    // For line and path elements, also update the points array
                    if ((element.type === 'line' || element.type === 'path') && 'points' in element) {
                        const updatedPoints = element.points.map(p => ({
                            x: p.x + dx,
                            y: p.y + dy,
                        }));
                        context.store.updateElement(id, {
                            x: element.x + dx,
                            y: element.y + dy,
                            points: updatedPoints,
                        } as Partial<LineElement>);
                    } else {
                        context.store.updateElement(id, {
                            x: element.x + dx,
                            y: element.y + dy,
                        });
                    }
                }
            });

            this.dragStart = point;
        } else if (this.isSelecting && this.selectionStart) {
            context.store.setSelectionBox({ start: this.selectionStart, end: point });
        }
    }

    onMouseUp(point: Point, context: ToolContext): void {
        const activeCanvas = context.store.getActiveCanvas();

        if (this.isRotating) {
            this.isRotating = false;
            this.rotateElement = null;
            this.center = null;
            context.store.setCursorMode(null);
            return;
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.resizeElement = null;
            this.originalBounds = null;
            this.dragStart = null;
            context.store.setCursorMode(null);
            return;
        }

        if (this.isDragging && this.dragStart) {
            this.isDragging = false;
            this.dragStart = null;
        }

        if (this.isSelecting && this.selectionStart && activeCanvas) {
            // Finalize marquee selection
            // We need logic to find elements inside the box.
            // This logic is likely in hitTest.ts as well? Or we implement it here.
            // Let's check hitTest.ts for 'getElementsInBox' or similar.

            // For now, assume simple box intersection (AABB)
            const minX = Math.min(this.selectionStart.x, point.x);
            const maxX = Math.max(this.selectionStart.x, point.x);
            const minY = Math.min(this.selectionStart.y, point.y);
            const maxY = Math.max(this.selectionStart.y, point.y);

            const selectedIds = activeCanvas.elements
                .filter(el => {
                    // Simple AABB check.
                    const elRight = el.x + el.width;
                    const elBottom = el.y + el.height;

                    // Intersection check:
                    return el.x < maxX && elRight > minX && el.y < maxY && elBottom > minY;
                })
                .map(el => el.id);

            context.store.setSelectedIds(selectedIds);
            context.store.setSelectionBox(null);
        }

        this.isDragging = false;
        this.dragStart = null;
        this.isSelecting = false;
        this.selectionStart = null;
    }
}
