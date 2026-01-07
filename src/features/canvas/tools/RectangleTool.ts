import { BaseTool, ToolContext } from './Tool';
import { Point, RectangleElement } from '../types/canvas';

export class RectangleTool extends BaseTool {
    type = 'rectangle';
    private startPoint: Point | null = null;
    private previewId = 'preview-rectangle';

    onMouseDown(point: Point, context: ToolContext): void {
        this.startPoint = point;
        // Create initial preview element
        const preview: RectangleElement = {
            id: this.previewId,
            type: 'rectangle',
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

        // We need a way to set the preview element in the View.
        // For now, let's assume we can add a temp element to the store or handle it via a callback?
        // Actually, the Store doesn't have a 'previewElement' state. CanvasContainer had it in local state.
        // We might need to add 'previewElement' to the CanvasStore or UIStore to share it.
        // OR, we can just add it as a real element but mark it as 'preview' (maybe with a flag or ID).
        // Let's rely on adding it to the store for now, but we might want a 'preview' slice.

        // BETTER APPROACH: The ToolContext should provide a way to set preview.
        // But since we want to decouple, maybe we should add 'previewElement' to the CanvasStore?
        // That allows the Renderer to see it.

        // Let's stick to the plan: Modify CanvasStore to support a preview element or just add it to elements list?
        // Adding to elements list triggers history. We don't want history for preview steps.

        // Let's add `previewElement` to the Store (ViewSlice).
        context.store.setPreviewElement(preview);
    }

    onMouseMove(point: Point, context: ToolContext): void {
        if (!this.startPoint) return;

        const width = point.x - this.startPoint.x;
        const height = point.y - this.startPoint.y;

        const preview: RectangleElement = {
            id: this.previewId,
            type: 'rectangle',
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

        // Create actual element
        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
            const element: RectangleElement = {
                id: `element-${Date.now()}`,
                type: 'rectangle',
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
