// Canvas Types

export type ToolType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pen' | 'text' | 'note';

// Color system (RGB)
export interface Color {
    r: number;
    g: number;
    b: number;
}

// Camera for pan/zoom
export interface Camera {
    x: number;
    y: number;
}

// Canvas interaction modes
export enum CanvasMode {
    None,
    Pressing,
    SelectionNet,
    Translating,
    Inserting,
    Resizing,
    Pencil,
}

// Side for resizing
export enum Side {
    Top = 1,
    Bottom = 2,
    Left = 4,
    Right = 8,
}

// Bounding box
export interface XYWH {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Canvas state type
export type CanvasStateType =
    | {
          mode: CanvasMode.None;
      }
    | {
          mode: CanvasMode.Pressing;
          origin: Point;
      }
    | {
          mode: CanvasMode.SelectionNet;
          origin: Point;
          current?: Point;
      }
    | {
          mode: CanvasMode.Translating;
          current: Point;
      }
    | {
          mode: CanvasMode.Inserting;
          layerType: 'rectangle' | 'ellipse' | 'text' | 'note';
      }
    | {
          mode: CanvasMode.Resizing;
          initialBounds: XYWH;
          corner: Side;
      }
    | {
          mode: CanvasMode.Pencil;
      };

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
    type: 'rectangle' | 'ellipse' | 'line' | 'path' | 'text' | 'note';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    style: ElementStyle;
    createdAt: number;
    updatedAt: number;
    isLocked?: boolean;
    isVisible?: boolean;
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

export interface NoteElement extends BaseElement {
    type: 'note';
    text: string;
    fontSize?: number;
    fontFamily?: string;
}

export type CanvasElement = RectangleElement | EllipseElement | LineElement | PathElement | TextElement | NoteElement;

export interface ElementGroup {
    id: string;
    elementIds: string[];
    createdAt: number;
}

export interface CanvasState {
    elements: CanvasElement[];
    selectedIds: string[];
    groups: ElementGroup[];
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
    defaultTextColor: string;
    defaultFontSize: number;
}

export interface HistoryState {
    past: CanvasElement[][];
    present: CanvasElement[];
    future: CanvasElement[][];
}
