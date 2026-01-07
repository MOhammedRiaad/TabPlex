import { BaseTool, ToolContext } from './Tool';
import { Point, LineElement } from '../types/canvas';

export class LineTool extends BaseTool {
    type = 'line';
    private startPoint: Point | null = null;
    private previewId = 'preview-line';

    onMouseDown(point: Point, context: ToolContext): void {
        this.startPoint = point;
        const preview: LineElement = {
            id: this.previewId,
            type: 'line',
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            rotation: 0,
            points: [point, point],
            startArrow: false,
            endArrow: true,
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
        if (!this.startPoint) return;

        const preview: LineElement = {
            id: this.previewId,
            type: 'line',
            x: Math.min(this.startPoint.x, point.x),
            y: Math.min(this.startPoint.y, point.y),
            width: Math.abs(point.x - this.startPoint.x),
            height: Math.abs(point.y - this.startPoint.y),
            rotation: 0,
            points: [this.startPoint, point],
            startArrow: false,
            endArrow: true,
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

    onMouseUp(point: Point, context: ToolContext): void {
        if (!this.startPoint) return;

        const length = Math.sqrt(Math.pow(point.x - this.startPoint.x, 2) + Math.pow(point.y - this.startPoint.y, 2));

        if (length > 2) {
            const element: LineElement = {
                id: `element-${Date.now()}`,
                type: 'line',
                x: Math.min(this.startPoint.x, point.x),
                y: Math.min(this.startPoint.y, point.y),
                width: Math.abs(point.x - this.startPoint.x),
                height: Math.abs(point.y - this.startPoint.y),
                rotation: 0,
                points: [this.startPoint, point],
                startArrow: false,
                endArrow: true,
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
            context.store.addElement(element);
        }

        this.startPoint = null;
        context.store.setPreviewElement(null);
    }
}
