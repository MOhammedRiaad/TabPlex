import { Point } from '../types/canvas';
import { CanvasStoreState } from '../store/types';

export interface ToolContext {
    canvasId: string;
    store: CanvasStoreState;
    modifiers: {
        shiftKey: boolean;
        ctrlKey: boolean;
        altKey: boolean;
        metaKey: boolean;
    };
}

export interface CanvasTool {
    type: string;
    onMouseDown(point: Point, context: ToolContext): void;
    onMouseMove(point: Point, context: ToolContext): void;
    onMouseUp(point: Point, context: ToolContext): void;
    activate?(): void;
    deactivate?(): void;
}

export abstract class BaseTool implements CanvasTool {
    abstract type: string;

    abstract onMouseDown(point: Point, context: ToolContext): void;
    abstract onMouseMove(point: Point, context: ToolContext): void;
    abstract onMouseUp(point: Point, context: ToolContext): void;

    activate(): void {}
    deactivate(): void {}
}
