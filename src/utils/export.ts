import { CanvasElement, CanvasState } from '../types/canvas';

/**
 * Export canvas to PNG image
 */
export function exportToPNG(canvas: HTMLCanvasElement, filename: string = 'canvas.png'): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

/**
 * Export canvas to SVG
 */
export function exportToSVG(elements: CanvasElement[], width: number, height: number, filename: string = 'canvas.svg'): void {
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    elements.forEach(element => {
        const { style } = element;
        const commonAttrs = `stroke="${style.strokeColor}" fill="${style.fillColor}" stroke-width="${style.strokeWidth}" opacity="${style.opacity}"`;

        switch (element.type) {
            case 'rectangle':
                svgContent += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" ${commonAttrs} />`;
                break;
            case 'ellipse':
                const cx = element.x + element.width / 2;
                const cy = element.y + element.height / 2;
                const rx = element.width / 2;
                const ry = element.height / 2;
                svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${commonAttrs} />`;
                break;
            case 'line':
                if ('points' in element && element.points.length >= 2) {
                    const start = element.points[0];
                    const end = element.points[element.points.length - 1];
                    svgContent += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ${commonAttrs} />`;
                }
                break;
            case 'path':
                if ('points' in element && element.points.length > 0) {
                    const pathData = element.points.map((p, i) =>
                        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
                    ).join(' ');
                    svgContent += `<path d="${pathData}" ${commonAttrs} fill="none" />`;
                }
                break;
            case 'text':
                if ('text' in element) {
                    svgContent += `<text x="${element.x}" y="${element.y + 16}" font-size="${element.fontSize || 16}" font-family="${element.fontFamily || 'Arial'}" fill="${style.fillColor}">${element.text}</text>`;
                }
                break;
        }
    });

    svgContent += '</svg>';

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Export canvas state to JSON
 */
export function exportToJSON(canvasState: CanvasState, filename: string = 'canvas.json'): void {
    const json = JSON.stringify(canvasState, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}
