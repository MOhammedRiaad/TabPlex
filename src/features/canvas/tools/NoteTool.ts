import { BaseTool, ToolContext } from './Tool';
import { Point, NoteElement } from '../types/canvas';

export class NoteTool extends BaseTool {
    type = 'note';

    onMouseDown(point: Point, context: ToolContext): void {
        // Create a placeholder sticky note that can be edited with double-click
        const noteElement: NoteElement = {
            id: `element-${Date.now()}`,
            type: 'note',
            x: point.x,
            y: point.y,
            width: 200, // Default note width
            height: 200, // Default note height
            rotation: 0,
            text: 'Double-click to edit',
            fontSize: 14,
            fontFamily: 'Arial',
            style: {
                strokeColor: '#000000',
                fillColor: '#fef08a', // Yellow sticky note color
                strokeWidth: 1,
                strokeStyle: 'solid',
                opacity: 1,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        context.store.addElement(noteElement);

        // Reset tool to select after note creation
        context.store.setActiveTool('select');
    }

    onMouseMove(_point: Point, _context: ToolContext): void {
        // No preview for notes
    }

    onMouseUp(_point: Point, _context: ToolContext): void {
        // Nothing to do on mouse up
    }

    onCancel(_context: ToolContext): void {
        // Nothing to cancel
    }
}
