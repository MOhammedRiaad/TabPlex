import { CanvasElement } from '../types/canvas';

let counter = 0;

export function makeElement(type: CanvasElement['type'], overrides: Record<string, unknown> = {}): CanvasElement {
    counter++;
    return {
        id: `el-${counter}`,
        type,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 0,
        style: { strokeColor: '#000', fillColor: 'transparent', strokeWidth: 1, strokeStyle: 'solid', opacity: 1 },
        createdAt: 0,
        updatedAt: 0,
        ...(type === 'line' ? { startArrow: false, endArrow: false, points: [] } : {}),
        ...(type === 'path' ? { points: [] } : {}),
        ...(type === 'text' ? { text: '', textAlign: 'left' } : {}),
        ...(type === 'note' ? { text: '' } : {}),
        ...overrides,
    } as CanvasElement;
}
