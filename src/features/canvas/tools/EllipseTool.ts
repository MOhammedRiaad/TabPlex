import { BaseTool, ToolContext } from './Tool';
import { Point, EllipseElement } from '../types/canvas';

export class EllipseTool extends BaseTool {
    type = 'ellipse';
    private startPoint: Point | null = null;
    private previewId = 'preview-ellipse';

    onMouseDown(point: Point, context: ToolContext): void {
        this.startPoint = point;
        const preview: EllipseElement = {
            id: this.previewId,
            type: 'ellipse',
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            rotation: 0,
            style: {
                strokeColor: context.store.settings.defaultStrokeColor,
                fillColor: context.store.settings.defaultFillColor,
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

        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;

        const preview: EllipseElement = {
            id: this.previewId,
            type: 'ellipse',
            x: width < 0 ? point.x : this.startPoint.x,
            y: height < 0 ? point.y : this.startPoint.y,
            width: Math.abs(width),
            height: Math.abs(height),
            rotation: 0,
            style: {
                strokeColor: context.store.settings.defaultStrokeColor,
                fillColor: context.store.settings.defaultFillColor,
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

        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;

        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
            const element: EllipseElement = {
                id: `element-${Date.now()}`,
                type: 'ellipse',
                x: width < 0 ? point.x : this.startPoint.x,
                y: height < 0 ? point.y : this.startPoint.y,
                width: Math.abs(width),
                height: Math.abs(height),
                rotation: 0,
                style: {
                    strokeColor: context.store.settings.defaultStrokeColor,
                    fillColor: context.store.settings.defaultFillColor,
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
