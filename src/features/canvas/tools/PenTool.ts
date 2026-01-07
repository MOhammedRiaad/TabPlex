import { BaseTool, ToolContext } from './Tool';
import { Point, PathElement } from '../types/canvas';

export class PenTool extends BaseTool {
    type = 'pen';
    private points: Point[] = [];
    private previewId = 'preview-path';

    onMouseDown(point: Point, context: ToolContext): void {
        this.points = [point];
        const preview: PathElement = {
            id: this.previewId,
            type: 'path',
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            rotation: 0,
            points: [point],
            style: {
                strokeColor: context.store.settings.defaultStrokeColor,
                fillColor: 'transparent',
                strokeWidth: context.store.settings.defaultStrokeWidth,
                strokeStyle: 'solid',
                opacity: 1,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        context.store.setPreviewElement(preview);
    }

    onMouseMove(point: Point, context: ToolContext): void {
        if (this.points.length === 0) return;

        this.points.push(point);

        const xs = this.points.map(p => p.x);
        const ys = this.points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const preview: PathElement = {
            id: this.previewId,
            type: 'path',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            rotation: 0,
            points: [...this.points],
            style: {
                strokeColor: context.store.settings.defaultStrokeColor,
                fillColor: 'transparent',
                strokeWidth: context.store.settings.defaultStrokeWidth,
                strokeStyle: 'solid',
                opacity: 1,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        context.store.setPreviewElement(preview);
    }

    onMouseUp(_point: Point, context: ToolContext): void {
        if (this.points.length < 2) {
            this.points = [];
            context.store.setPreviewElement(null);
            return;
        }

        const xs = this.points.map(p => p.x);
        const ys = this.points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const element: PathElement = {
            id: `element-${Date.now()}`,
            type: 'path',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            rotation: 0,
            points: [...this.points],
            style: {
                strokeColor: context.store.settings.defaultStrokeColor,
                fillColor: 'transparent',
                strokeWidth: context.store.settings.defaultStrokeWidth,
                strokeStyle: 'solid',
                opacity: 1,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        // Simplify points (simple distance-based or every Nth point)
        // Basic optimization: Filter points that are too close
        if (element.points.length > 2) {
            const simplified = [element.points[0]];
            for (let i = 1; i < element.points.length - 1; i++) {
                const prev = simplified[simplified.length - 1];
                const curr = element.points[i];
                const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
                if (dist > 2) {
                    // Minimum distance threshold
                    simplified.push(curr);
                }
            }
            simplified.push(element.points[element.points.length - 1]);
            element.points = simplified;
        }

        context.store.addElement(element);

        this.points = [];
        context.store.setPreviewElement(null);
    }
}
