import { Point, CanvasElement } from '../types/canvas';
import { isPointInRect, isPointInEllipse, isPointNearLine, getBoundingBox, rotatePoint } from './geometry';

/**
 * Transform a point from global space to element's local (unrotated) space
 */
function transformPointToLocal(point: Point, element: CanvasElement): Point {
    if (!element.rotation || element.rotation === 0) {
        return point;
    }

    // Get the actual bounds (important for line/path elements)
    const bbox = getBoundingBox(element);

    // Calculate center of element
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;

    // Rotate point BACKWARDS around center to get local coordinates
    const angleRad = -(element.rotation * Math.PI) / 180;
    return rotatePoint(point, { x: centerX, y: centerY }, angleRad);
}

/**
 * Check if a point is hitting a rotation handle of an element
 * Returns cursor style or null
 */
export function getRotationHandle(element: CanvasElement, point: Point, handleSize: number = 8): string | null {
    // Transform point to local space
    const localPoint = transformPointToLocal(point, element);

    // Get the actual bounds (important for line/path elements)
    const bbox = getBoundingBox(element);

    // Position: Top center, slightly offset upwards
    const handleX = bbox.x + bbox.width / 2;
    const handleY = bbox.y - 20; // 20px above
    const half = handleSize / 2;

    // Check collision in local space
    if (
        localPoint.x >= handleX - half &&
        localPoint.x <= handleX + half &&
        localPoint.y >= handleY - half &&
        localPoint.y <= handleY + half
    ) {
        return 'grab';
    }

    return null;
}

/**
 * Check if a point is hitting a resize handle of an element
 */
export function getResizeHandle(element: CanvasElement, point: Point, handleSize: number = 8): string | null {
    // Transform point to local space
    const localPoint = transformPointToLocal(point, element);

    // Get the actual bounds (important for line/path elements)
    const bbox = getBoundingBox(element);
    const { x, y, width, height } = bbox;
    const half = handleSize / 2;

    const handles = [
        { cursor: 'nw', x: x - half, y: y - half },
        { cursor: 'n', x: x + width / 2 - half, y: y - half },
        { cursor: 'ne', x: x + width - half, y: y - half },
        { cursor: 'e', x: x + width - half, y: y + height / 2 - half },
        { cursor: 'se', x: x + width - half, y: y + height - half },
        { cursor: 's', x: x + width / 2 - half, y: y + height - half },
        { cursor: 'sw', x: x - half, y: y + height - half },
        { cursor: 'w', x: x - half, y: y + height / 2 - half },
    ];

    for (const handle of handles) {
        if (
            localPoint.x >= handle.x &&
            localPoint.x <= handle.x + handleSize &&
            localPoint.y >= handle.y &&
            localPoint.y <= handle.y + handleSize
        ) {
            return handle.cursor;
        }
    }

    return null;
}

/**
 * Check if a point hits an element
 */
export function hitTestElement(element: CanvasElement, point: Point, threshold: number = 5): boolean {
    const bbox = getBoundingBox(element);

    switch (element.type) {
        case 'rectangle':
            return isPointInRect(point, bbox.x, bbox.y, bbox.width, bbox.height);

        case 'ellipse':
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            const rx = bbox.width / 2;
            const ry = bbox.height / 2;
            return isPointInEllipse(point, cx, cy, rx, ry);

        case 'line':
            if ('points' in element && element.points.length >= 2) {
                for (let i = 0; i < element.points.length - 1; i++) {
                    if (isPointNearLine(point, element.points[i], element.points[i + 1], threshold)) {
                        return true;
                    }
                }
            }
            return false;

        case 'path':
            if ('points' in element && element.points.length >= 2) {
                for (let i = 0; i < element.points.length - 1; i++) {
                    if (isPointNearLine(point, element.points[i], element.points[i + 1], threshold)) {
                        return true;
                    }
                }
            }
            return false;

        case 'text':
            return isPointInRect(point, bbox.x, bbox.y, bbox.width, bbox.height);

        case 'note':
            return isPointInRect(point, bbox.x, bbox.y, bbox.width, bbox.height);

        default:
            return false;
    }
}

/**
 * Find the topmost element at a given point
 */
export function findElementAtPoint(elements: CanvasElement[], point: Point): CanvasElement | null {
    // Iterate in reverse order to get the topmost element
    for (let i = elements.length - 1; i >= 0; i--) {
        if (elements[i].isVisible === false) continue;
        if (hitTestElement(elements[i], point)) {
            return elements[i];
        }
    }
    return null;
}
