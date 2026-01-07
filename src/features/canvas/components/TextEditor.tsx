import React from 'react';
import { TextElement, NoteElement } from '../types/canvas';

interface TextEditorProps {
    element: TextElement | NoteElement;
    canvasRect: DOMRect | null;
    zoom: number;
    panX: number;
    panY: number;
    text: string;
    onChange: (text: string) => void;
    onFinish: (text: string) => void;
    onCancel: () => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({
    element,
    canvasRect,
    zoom,
    panX,
    panY,
    text,
    onChange,
    onFinish,
    onCancel,
}) => {
    if (!canvasRect) return null;

    const screenX = canvasRect.left + element.x * zoom + panX;
    const screenY = canvasRect.top + element.y * zoom + panY;
    const screenWidth = element.width * zoom;
    const screenHeight = element.height * zoom;

    return (
        <div
            style={{
                position: 'fixed',
                left: `${screenX}px`,
                top: `${screenY}px`,
                width: `${screenWidth}px`,
                height: `${screenHeight}px`,
                zIndex: 10001,
            }}
        >
            <textarea
                autoFocus
                value={text}
                onChange={e => onChange(e.target.value)}
                onBlur={() => onFinish(text)}
                onKeyDown={e => {
                    if (e.key === 'Escape') {
                        onCancel();
                    } else if (e.key === 'Enter' && e.ctrlKey) {
                        onFinish(text);
                    }
                }}
                style={{
                    width: '100%',
                    height: '100%',
                    padding: element.type === 'note' ? '10px' : '0',
                    fontSize: `${(element.fontSize || 14) * zoom}px`,
                    fontFamily: element.fontFamily || 'Arial',
                    background: element.type === 'note' ? element.style.fillColor : 'transparent',
                    border: '2px solid #3b82f6',
                    borderRadius: '4px',
                    resize: 'none',
                    outline: 'none',
                    color: element.type === 'note' ? '#000' : element.style.strokeColor,
                }}
            />
        </div>
    );
};
