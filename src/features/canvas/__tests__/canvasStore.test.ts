import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasStore } from '../store/canvasStore';
import { DEFAULT_SETTINGS } from '../store/slices/canvasSlice';
import { storageService } from '../../../services/storage';
import { makeElement } from './canvasFactories';
import { CanvasElement } from '../types/canvas';

const store = () => useCanvasStore.getState();
const canvas = () => store().getActiveCanvas()!;
const ids = () => canvas().elements.map(e => e.id);

function seed(...elements: CanvasElement[]) {
    store().createCanvas('board_1');
    for (const el of elements) store().addElement(el);
}

describe('canvas store', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            canvases: [],
            activeCanvasId: null,
            settings: DEFAULT_SETTINGS,
            history: {},
            previewElement: null,
            selectionBox: null,
            cursorMode: null,
        });
    });

    describe('canvases & settings', () => {
        it('creates, activates and deletes canvases', () => {
            vi.useFakeTimers();
            vi.setSystemTime(1000);
            store().createCanvas('b1');
            vi.setSystemTime(2000);
            store().createCanvas();
            vi.useRealTimers();
            const [first, second] = store().canvases;
            expect(store().activeCanvasId).toBe(second.canvasId);
            expect(first).toMatchObject({ boardId: 'b1', activeTool: 'select', gridEnabled: true, zoom: 1 });

            store().setActiveCanvas(first.canvasId);
            expect(canvas().canvasId).toBe(first.canvasId);
            store().deleteCanvas(second.canvasId);
            expect(store().activeCanvasId).toBe(first.canvasId);
            store().deleteCanvas(first.canvasId);
            expect(store().activeCanvasId).toBeNull();
            expect(store().getActiveCanvas()).toBeNull();
        });

        it('switches active canvas when deleting the active one', () => {
            vi.useFakeTimers();
            vi.setSystemTime(1);
            store().createCanvas();
            vi.setSystemTime(2);
            store().createCanvas();
            vi.useRealTimers();
            const [first, second] = store().canvases;
            store().deleteCanvas(second.canvasId);
            expect(store().activeCanvasId).toBe(first.canvasId);
        });

        it('sets tools and toggles grid / snap on the active canvas', () => {
            store().createCanvas();
            store().setActiveTool('pen');
            store().toggleGrid();
            store().toggleSnapToGrid();
            expect(canvas()).toMatchObject({ activeTool: 'pen', gridEnabled: false, snapToGrid: true });
            expect(store().settings).toMatchObject({ gridEnabled: false, snapToGrid: true });
            store().updateSettings({ gridSize: 25 });
            expect(store().settings.gridSize).toBe(25);
        });

        it('saves to and loads from chrome storage, migrating old canvases', async () => {
            store().createCanvas();
            await store().saveToStorage();
            const saved = (await chrome.storage.local.get('canvases')).canvases as unknown[];
            expect(saved).toHaveLength(1);

            await chrome.storage.local.set({
                canvases: [{ canvasId: 'old', elements: [] }],
                canvasSettings: { gridSize: 40 },
            });
            await store().loadFromStorage();
            expect(store().canvases[0].groups).toEqual([]);
            expect(store().settings).toEqual({ ...DEFAULT_SETTINGS, gridSize: 40 });
        });

        it('ignores missing data and logs storage errors', async () => {
            const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            await store().loadFromStorage();
            expect(store().canvases).toEqual([]);

            vi.spyOn(storageService, 'get').mockRejectedValueOnce(new Error('read'));
            await store().loadFromStorage();
            vi.spyOn(storageService, 'set').mockRejectedValueOnce(new Error('write'));
            await store().saveToStorage();
            expect(error).toHaveBeenCalledTimes(2);
        });
    });

    describe('elements', () => {
        it('does nothing without an active canvas', () => {
            const el = makeElement('rectangle');
            store().addElement(el);
            store().deleteElement(el.id);
            store().deleteElements([el.id]);
            store().bringToFront([el.id]);
            store().alignElements('left');
            store().distributeElements('horizontal');
            store().reorderElement(el.id, 0);
            expect(store().canvases).toEqual([]);
        });

        it('adds, updates and deletes elements with history', () => {
            const a = makeElement('rectangle');
            const b = makeElement('ellipse');
            seed(a, b);
            store().setSelectedIds([a.id, b.id]);
            store().updateElement(a.id, { x: 42 });
            expect(canvas().elements[0].x).toBe(42);

            store().deleteElement(a.id);
            expect(ids()).toEqual([b.id]);
            expect(canvas().selectedIds).toEqual([b.id]);
            store().deleteElements([b.id]);
            expect(ids()).toEqual([]);
            expect(store().canUndo()).toBe(true);
        });

        it('reorders layers', () => {
            const [a, b, c, d] = ['rectangle', 'ellipse', 'text', 'note'].map(t =>
                makeElement(t as CanvasElement['type'])
            );
            seed(a, b, c, d);
            store().bringToFront([a.id]);
            expect(ids()).toEqual([b.id, c.id, d.id, a.id]);
            store().sendToBack([a.id]);
            expect(ids()).toEqual([a.id, b.id, c.id, d.id]);

            store().bringForward([a.id, b.id]);
            expect(ids()).toEqual([c.id, a.id, b.id, d.id]);
            store().bringForward([d.id, 'missing']);
            expect(ids()).toEqual([c.id, a.id, b.id, d.id]);

            store().sendBackward([a.id, b.id]);
            expect(ids()).toEqual([a.id, b.id, c.id, d.id]);
            store().sendBackward([a.id]);
            expect(ids()).toEqual([a.id, b.id, c.id, d.id]);

            store().reorderElement(d.id, 0);
            expect(ids()).toEqual([d.id, a.id, b.id, c.id]);
            store().reorderElement('missing', 0);
            expect(ids()).toEqual([d.id, a.id, b.id, c.id]);
        });

        it('groups and ungroups', () => {
            const a = makeElement('rectangle');
            const b = makeElement('rectangle');
            seed(a, b);
            store().groupElements([a.id]);
            expect(canvas().groups).toEqual([]);
            store().groupElements([a.id, b.id]);
            const [group] = canvas().groups;
            expect(group.elementIds).toEqual([a.id, b.id]);
            store().ungroupElements(group.id);
            expect(canvas().groups).toEqual([]);
        });

        it.each([
            ['left', 'x', [0, 0, 0]],
            ['center', 'x', [45, 40, 35]],
            ['right', 'x', [90, 80, 70]],
            ['top', 'y', [0, 0, 0]],
            ['middle', 'y', [45, 40, 35]],
            ['bottom', 'y', [90, 80, 70]],
        ] as const)('aligns %s', (type, axis, expected) => {
            const els = [
                makeElement('rectangle', { x: 0, y: 0, width: 10, height: 10 }),
                makeElement('rectangle', { x: 50, y: 50, width: 20, height: 20 }),
                makeElement('rectangle', { x: 70, y: 70, width: 30, height: 30 }),
            ];
            seed(...els);
            store().alignElements(type);
            expect(canvas().elements.map(e => e.x)).toEqual([0, 50, 70]); // needs a selection
            store().setSelectedIds(els.map(e => e.id));
            store().alignElements(type);
            expect(canvas().elements.map(e => e[axis])).toEqual(expected);
        });

        it.each([
            ['horizontal', 'x'],
            ['vertical', 'y'],
        ] as const)('distributes %s', (type, axis) => {
            const els = [0, 10, 100].map(v => makeElement('rectangle', { x: v, y: v, width: 10, height: 10 }));
            seed(...els);
            store().setSelectedIds(els.slice(0, 2).map(e => e.id));
            store().distributeElements(type);
            expect(canvas().elements[1][axis]).toBe(10); // needs 3+
            store().setSelectedIds(els.map(e => e.id));
            store().distributeElements(type);
            expect(canvas().elements.map(e => e[axis])).toEqual([0, 50, 100]);
        });
    });

    describe('selection, history and view', () => {
        it('manages the selection', () => {
            seed(makeElement('rectangle', { id: 'a' }), makeElement('rectangle', { id: 'b' }));
            store().addToSelection('a');
            store().addToSelection('a');
            store().addToSelection('b');
            expect(canvas().selectedIds).toEqual(['a', 'b']);
            store().removeFromSelection('a');
            expect(canvas().selectedIds).toEqual(['b']);
            store().clearSelection();
            expect(canvas().selectedIds).toEqual([]);
        });

        it('undoes and redoes element changes', () => {
            expect(store().canUndo()).toBe(false);
            expect(store().canRedo()).toBe(false);
            store().undo();
            store().redo();
            seed(makeElement('rectangle', { id: 'a' }), makeElement('rectangle', { id: 'b' }));
            expect(store().canRedo()).toBe(false);
            store().undo();
            expect(ids()).toEqual(['a']);
            expect(store().canRedo()).toBe(true);
            store().redo();
            expect(ids()).toEqual(['a', 'b']);
            store().undo();
            store().undo();
            store().undo(); // nothing left
            expect(ids()).toEqual([]);
        });

        it('ignores history for a missing canvas and caps it at 50 states', () => {
            store().saveHistory('ghost', []);
            useCanvasStore.setState({ activeCanvasId: 'ghost' });
            store().undo();
            useCanvasStore.setState({ history: { ghost: { past: [], future: [[]] } } });
            store().redo();
            expect(store().canRedo()).toBe(true);
            for (let i = 0; i < 60; i++) store().saveHistory('ghost', []);
            expect(store().history.ghost.past).toHaveLength(50);
        });

        it('zooms within limits, pans and resets', () => {
            store().createCanvas();
            store().setZoom(10);
            expect(canvas().zoom).toBe(5);
            store().setZoom(0.01);
            expect(canvas().zoom).toBe(0.1);
            store().setPan(10, 20);
            expect(canvas()).toMatchObject({ panX: 10, panY: 20 });
            store().resetView();
            expect(canvas()).toMatchObject({ zoom: 1, panX: 0, panY: 0 });
            const el = makeElement('rectangle');
            store().setPreviewElement(el);
            store().setSelectionBox({ start: { x: 0, y: 0 }, end: { x: 1, y: 1 } });
            store().setCursorMode('grab');
            expect(store()).toMatchObject({ previewElement: el, cursorMode: 'grab' });
            expect(store().selectionBox?.end).toEqual({ x: 1, y: 1 });
        });
    });
});
