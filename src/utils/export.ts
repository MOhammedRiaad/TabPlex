import { CanvasElement, CanvasState } from '../features/canvas/types/canvas';
import { renderElement } from '../features/canvas/utils/render';

/**
 * Export canvas or selected elements to PNG image
 */
export function exportToPNG(
    sourceCanvas: HTMLCanvasElement,
    filename: string = 'canvas.png',
    elementsToExport?: CanvasElement[]
): void {
    let canvasToExport = sourceCanvas;

    // If exporting specific elements (selection), we need a temporary canvas
    if (elementsToExport && elementsToExport.length > 0) {
        // Calculate bounding box
        const minX = Math.min(...elementsToExport.map(el => el.x));
        const minY = Math.min(...elementsToExport.map(el => el.y));
        const maxX = Math.max(...elementsToExport.map(el => el.x + el.width));
        const maxY = Math.max(...elementsToExport.map(el => el.y + el.height));

        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 20;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width + padding * 2;
        tempCanvas.height = height + padding * 2;
        const ctx = tempCanvas.getContext('2d');

        if (ctx) {
            // Fill white background (optional, or transparent)
            // ctx.fillStyle = '#ffffff';
            // ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            // Translate to center elements
            ctx.translate(-minX + padding, -minY + padding);

            elementsToExport.forEach(el => {
                renderElement(ctx, el);
            });

            canvasToExport = tempCanvas;
        }
    }

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvasToExport.toDataURL('image/png');
    link.click();
}

/**
 * Copy selected elements (or whole canvas) to clipboard as PNG
 */
export async function copyToClipboard(
    sourceCanvas: HTMLCanvasElement,
    elementsToExport?: CanvasElement[]
): Promise<void> {
    let canvasToCopy = sourceCanvas;

    if (elementsToExport && elementsToExport.length > 0) {
        const minX = Math.min(...elementsToExport.map(el => el.x));
        const minY = Math.min(...elementsToExport.map(el => el.y));
        const maxX = Math.max(...elementsToExport.map(el => el.x + el.width));
        const maxY = Math.max(...elementsToExport.map(el => el.y + el.height));

        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 20;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width + padding * 2;
        tempCanvas.height = height + padding * 2;
        const ctx = tempCanvas.getContext('2d');

        if (ctx) {
            ctx.translate(-minX + padding, -minY + padding);
            elementsToExport.forEach(el => {
                renderElement(ctx, el);
            });
            canvasToCopy = tempCanvas;
        }
    }

    try {
        const blob = await new Promise<Blob | null>(resolve => canvasToCopy.toBlob(resolve, 'image/png'));
        if (blob) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        }
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        throw err;
    }
}

/**
 * Export canvas to SVG
 */
export function exportToSVG(
    elements: CanvasElement[],
    width: number,
    height: number,
    filename: string = 'canvas.svg'
): void {
    // Note: Reusing render logic for SVG requires mapping Canvas calls to SVG strings.
    // The previous implementation constructed SVG strings manually.
    // Implementing a full Canvas-to-SVG context mock is complex.
    // For now, we'll keep the manual SVG generation but update it if needed.
    // Or we could use a library, but sticking to existing pattern is safer for this task.
    // Let's restore the previous implementation for now as it worked for basics.

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

    elements.forEach(element => {
        const { style } = element;
        const commonAttrs = `stroke="${style.strokeColor}" fill="${style.fillColor}" stroke-width="${style.strokeWidth}" opacity="${style.opacity}"`;

        // Transform for rotation
        let transform = '';
        if (element.rotation) {
            const cx = element.x + element.width / 2;
            const cy = element.y + element.height / 2;
            transform = `transform="rotate(${element.rotation}, ${cx}, ${cy})"`;
        }

        switch (element.type) {
            case 'rectangle':
                if (element.cornerRadius) {
                    svgContent += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.cornerRadius}" ry="${element.cornerRadius}" ${commonAttrs} ${transform} />`;
                } else {
                    svgContent += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" ${commonAttrs} ${transform} />`;
                }
                break;
            case 'ellipse':
                const cx = element.x + element.width / 2;
                const cy = element.y + element.height / 2;
                const rx = element.width / 2;
                const ry = element.height / 2;
                svgContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${commonAttrs} ${transform} />`;
                break;
            case 'line':
                if ('points' in element && element.points && element.points.length >= 2) {
                    const start = element.points[0];
                    const end = element.points[element.points.length - 1];
                    svgContent += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ${commonAttrs} ${transform} />`;
                }
                break;
            // ... Add other types as needed
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
