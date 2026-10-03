import { describe, expect, it } from 'vitest';
import {
    clamp,
    distance,
    getBoundingBox,
    getElementCenter,
    isPointInEllipse,
    isPointInRect,
    isPointNearLine,
    lerp,
    rectsIntersect,
    rotatePoint,
    simplifyPath,
    snapPointToGrid,
    snapToGrid,
} from '../utils/geometry';
import { findElementAtPoint, getResizeHandle, getRotationHandle, hitTestElement } from '../utils/hitTest';
import { makeElement } from './canvasFactories';

describe('geometry', () => {
    it('measures and rotates points', () => {
        expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
        const r = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
        expect(r.x).toBeCloseTo(0);
        expect(r.y).toBeCloseTo(1);
    });

    it('tests points in shapes and near lines', () => {
        expect(isPointInRect({ x: 5, y: 5 }, 0, 0, 10, 10)).toBe(true);
        expect(isPointInRect({ x: 11, y: 5 }, 0, 0, 10, 10)).toBe(false);
        expect(isPointInEllipse({ x: 5, y: 5 }, 5, 5, 2, 1)).toBe(true);
        expect(isPointInEllipse({ x: 8, y: 5 }, 5, 5, 2, 1)).toBe(false);
        expect(isPointNearLine({ x: 5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
        expect(isPointNearLine({ x: 5, y: 9 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
        expect(isPointNearLine({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
        expect(isPointNearLine({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
        expect(isPointNearLine({ x: 9, y: 9 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 2)).toBe(false);
    });

    it('computes bounding boxes and centres', () => {
        expect(getBoundingBox(makeElement('rectangle', { x: 1, y: 2, width: 3, height: 4 }))).toEqual({
            x: 1,
            y: 2,
            width: 3,
            height: 4,
        });
        const line = makeElement('line', {
            points: [
                { x: 5, y: 1 },
                { x: 1, y: 9 },
                { x: 3, y: 4 },
            ],
        });
        expect(getBoundingBox(line)).toEqual({ x: 1, y: 1, width: 4, height: 8 });
        expect(getBoundingBox(makeElement('path', { x: 7, y: 8, points: [] }))).toEqual({
            x: 7,
            y: 8,
            width: 0,
            height: 0,
        });
        expect(getElementCenter(makeElement('rectangle', { x: 0, y: 0, width: 10, height: 20 }))).toEqual({
            x: 5,
            y: 10,
        });
    });

    it('snaps, intersects, clamps and interpolates', () => {
        expect(snapToGrid(14, 10)).toBe(10);
        expect(snapToGrid(15, 10)).toBe(20);
        expect(snapPointToGrid({ x: 4, y: 6 }, 5)).toEqual({ x: 5, y: 5 });
        expect(rectsIntersect({ x: 0, y: 0, width: 5, height: 5 }, { x: 4, y: 4, width: 5, height: 5 })).toBe(true);
        expect(rectsIntersect({ x: 0, y: 0, width: 5, height: 5 }, { x: 6, y: 0, width: 5, height: 5 })).toBe(false);
        expect(clamp(15, 0, 10)).toBe(10);
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(lerp(0, 10, 0.25)).toBe(2.5);
    });

    it('simplifies paths (Ramer–Douglas–Peucker)', () => {
        const two = [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
        ];
        expect(simplifyPath(two)).toBe(two);
        const straight = [
            { x: 0, y: 0 },
            { x: 1, y: 0.1 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
        ];
        expect(simplifyPath(straight)).toEqual([
            { x: 0, y: 0 },
            { x: 3, y: 0 },
        ]);
        const corner = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ];
        expect(simplifyPath(corner, 1)).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
        ]);
        // degenerate segment and points beyond the ends
        expect(
            simplifyPath(
                [
                    { x: 0, y: 0 },
                    { x: 50, y: 50 },
                    { x: 0, y: 0 },
                ],
                1
            )
        ).toHaveLength(3);
        expect(
            simplifyPath(
                [
                    { x: 0, y: 0 },
                    { x: -20, y: 0 },
                    { x: 10, y: 0 },
                ],
                1
            )
        ).toHaveLength(3);
        expect(
            simplifyPath(
                [
                    { x: 0, y: 0 },
                    { x: 30, y: 0 },
                    { x: 10, y: 0 },
                ],
                1
            )
        ).toHaveLength(3);
    });
});

describe('hitTest', () => {
    const rect = makeElement('rectangle', { x: 0, y: 0, width: 100, height: 50 });

    it('hits each element type', () => {
        expect(hitTestElement(rect, { x: 50, y: 25 })).toBe(true);
        expect(hitTestElement(makeElement('ellipse', { x: 0, y: 0, width: 100, height: 50 }), { x: 50, y: 25 })).toBe(
            true
        );
        expect(hitTestElement(makeElement('ellipse', { x: 0, y: 0, width: 100, height: 50 }), { x: 1, y: 1 })).toBe(
            false
        );
        const line = makeElement('line', {
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
            ],
        });
        expect(hitTestElement(line, { x: 10, y: 5 })).toBe(true);
        expect(hitTestElement(line, { x: 50, y: 50 })).toBe(false);
        expect(hitTestElement(makeElement('line', { points: [{ x: 0, y: 0 }] }), { x: 0, y: 0 })).toBe(false);
        const path = makeElement('path', {
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
        });
        expect(hitTestElement(path, { x: 5, y: 5 })).toBe(true);
        expect(hitTestElement(path, { x: 0, y: 10 }, 1)).toBe(false);
        expect(hitTestElement(makeElement('path', { points: [] }), { x: 0, y: 0 })).toBe(false);
        expect(hitTestElement(makeElement('text', { x: 0, y: 0, width: 10, height: 10 }), { x: 5, y: 5 })).toBe(true);
        expect(hitTestElement(makeElement('note', { x: 0, y: 0, width: 10, height: 10 }), { x: 50, y: 5 })).toBe(false);
        expect(hitTestElement({ ...rect, type: 'unknown' } as never, { x: 1, y: 1 })).toBe(false);
    });

    it('finds the top-most visible element', () => {
        const below = makeElement('rectangle', { id: 'below', x: 0, y: 0, width: 100, height: 100 });
        const hidden = makeElement('rectangle', {
            id: 'hidden',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            isVisible: false,
        });
        expect(findElementAtPoint([below, hidden], { x: 5, y: 5 })?.id).toBe('below');
        expect(findElementAtPoint([below], { x: 500, y: 5 })).toBeNull();
    });

    it('finds resize and rotation handles, honouring rotation', () => {
        expect(getResizeHandle(rect, { x: 0, y: 0 })).toBe('nw');
        expect(getResizeHandle(rect, { x: 100, y: 50 })).toBe('se');
        expect(getResizeHandle(rect, { x: 50, y: 0 })).toBe('n');
        expect(getResizeHandle(rect, { x: 0, y: 25 })).toBe('w');
        expect(getResizeHandle(rect, { x: 50, y: 25 })).toBeNull();
        expect(getRotationHandle(rect, { x: 50, y: -20 })).toBe('grab');
        expect(getRotationHandle(rect, { x: 0, y: -20 })).toBeNull();

        const rotated = makeElement('rectangle', { x: 0, y: 0, width: 100, height: 100, rotation: 90 });
        // The top-centre rotation handle of a 90° rotated square sits to the right of it
        expect(getRotationHandle(rotated, { x: 120, y: 50 })).toBe('grab');
        expect(getResizeHandle(rotated, { x: 100, y: 0 })).toBe('nw');
    });
});
