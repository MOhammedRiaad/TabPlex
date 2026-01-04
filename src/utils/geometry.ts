import { Point, CanvasElement } from '../types/canvas';

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Rotate a point around a center point
 */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}

/**
 * Check if a point is inside a rectangle
 */
export function isPointInRect(
    point: Point,
    x: number,
    y: number,
    width: number,
    height: number
): boolean {
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}

/**
 * Check if a point is inside an ellipse
 */
export function isPointInEllipse(
    point: Point,
    cx: number,
    cy: number,
    rx: number,
    ry: number
): boolean {
    const dx = point.x - cx;
    const dy = point.y - cy;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

/**
 * Calculate bounding box for an element
 */
export function getBoundingBox(element: CanvasElement): {
    x: number;
    y: number;
    width: number;
    height: number;
} {
    if (element.type === 'line' || element.type === 'path') {
        const points = element.points;
        if (points.length === 0) {
            return { x: element.x, y: element.y, width: 0, height: 0 };
        }

        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    return {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
    };
}

/**
 * Check if a point is near a line segment
 */
export function isPointNearLine(
    point: Point,
    start: Point,
    end: Point,
    threshold: number = 5
): boolean {
    const lineLength = distance(start, end);
    if (lineLength === 0) return distance(point, start) <= threshold;

    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
            (lineLength * lineLength)
        )
    );

    const projection = {
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y),
    };

    return distance(point, projection) <= threshold;
}

/**
 * Snap value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap point to grid
 */
export function snapPointToGrid(point: Point, gridSize: number): Point {
    return {
        x: snapToGrid(point.x, gridSize),
        y: snapToGrid(point.y, gridSize),
    };
}

/**
 * Calculate center point of an element
 */
export function getElementCenter(element: CanvasElement): Point {
    return {
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
    };
}

/**
 * Check if two rectangles intersect
 */
export function rectsIntersect(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
): boolean {
    return !(
        r1.x + r1.width < r2.x ||
        r2.x + r2.width < r1.x ||
        r1.y + r1.height < r2.y ||
        r2.y + r2.height < r1.y
    );
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

/**
 * Simplify path using Ramer-Douglas-Peucker algorithm
 */
export function simplifyPath(points: Point[], tolerance: number = 2): Point[] {
    if (points.length <= 2) return points;

    // Find the point with maximum distance
    let maxDistance = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const dist = perpendicularDistance(points[i], points[0], points[end]);
        if (dist > maxDistance) {
            maxDistance = dist;
            index = i;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
        const left = simplifyPath(points.slice(0, index + 1), tolerance);
        const right = simplifyPath(points.slice(index), tolerance);

        return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[end]];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    if (dx === 0 && dy === 0) {
        return distance(point, lineStart);
    }

    const t =
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

    if (t < 0) {
        return distance(point, lineStart);
    } else if (t > 1) {
        return distance(point, lineEnd);
    }

    const projection = {
        x: lineStart.x + t * dx,
        y: lineStart.y + t * dy,
    };

    return distance(point, projection);
}
