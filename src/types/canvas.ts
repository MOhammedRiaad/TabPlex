// Canvas Types

export type ToolType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pen' | 'text';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface Point {
    x: number;
    y: number;
}

export interface ElementStyle {
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    strokeStyle: StrokeStyle;
    opacity: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
}

export interface BaseElement {
    id: string;
    type: 'rectangle' | 'ellipse' | 'line' | 'path' | 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    style: ElementStyle;
    createdAt: number;
    updatedAt: number;
}

export interface RectangleElement extends BaseElement {
    type: 'rectangle';
    cornerRadius?: number;
}

export interface EllipseElement extends BaseElement {
    type: 'ellipse';
}

export interface LineElement extends BaseElement {
    type: 'line';
    startArrow: boolean;
    endArrow: boolean;
    points: Point[];
}

export interface PathElement extends BaseElement {
    type: 'path';
    points: Point[];
}

export interface TextElement extends BaseElement {
    type: 'text';
    text: string;
    fontSize?: number;
    fontFamily?: string;
    textAlign: 'left' | 'center' | 'right';
}

export type CanvasElement = RectangleElement | EllipseElement | LineElement | PathElement | TextElement;

export interface CanvasState {
    elements: CanvasElement[];
    selectedIds: string[];
    activeTool: ToolType;
    gridEnabled: boolean;
    snapToGrid: boolean;
    gridSize: number;
    zoom: number;
    panX: number;
    panY: number;
    canvasId: string;
    boardId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface CanvasSettings {
    gridEnabled: boolean;
    snapToGrid: boolean;
    gridSize: number;
    defaultStrokeColor: string;
    defaultFillColor: string;
    defaultStrokeWidth: number;
}

export interface HistoryState {
    past: CanvasElement[][];
    present: CanvasElement[];
    future: CanvasElement[][];
}
