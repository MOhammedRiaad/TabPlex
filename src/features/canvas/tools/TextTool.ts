import { BaseTool, ToolContext } from './Tool';
import { Point, TextElement } from '../types/canvas';

export class TextTool extends BaseTool {
    type = 'text';

    onMouseDown(point: Point, context: ToolContext): void {
        // Create a placeholder text element that can be edited with double-click
        const textElement: TextElement = {
            id: `element-${Date.now()}`,
            type: 'text',
            x: point.x,
            y: point.y,
            width: 200, // Default width
            height: context.store.settings.defaultFontSize * 1.5,
            rotation: 0,
            text: 'Double-click to edit',
            fontSize: context.store.settings.defaultFontSize,
            fontFamily: 'Arial',
            textAlign: 'left',
            style: {
                strokeColor: context.store.settings.defaultTextColor,
                fillColor: 'transparent',
                strokeWidth: 1,
                strokeStyle: 'solid',
                opacity: 1,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        context.store.addElement(textElement);

        // Reset tool to select after text creation
        context.store.setActiveTool('select');
    }

    onMouseMove(_point: Point, _context: ToolContext): void {
        // Text tool doesn't do anything on mouse move
    }

    onMouseUp(_point: Point, _context: ToolContext): void {
        // Text creation happens on mouse down
    }
}
