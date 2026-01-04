import { Point, CanvasElement } from '../types/canvas';
import { isPointInRect, isPointInEllipse, isPointNearLine, getBoundingBox } from './geometry';

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
        if (hitTestElement(elements[i], point)) {
            return elements[i];
        }
    }
    return null;
}
