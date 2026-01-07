import { CanvasElement } from '../types/canvas';

const drawArrowHead = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    strokeWidth: number
) => {
    const headLength = 10 + strokeWidth * 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
};

const drawLine = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    if (!('points' in element) || !element.points || element.points.length < 2) return;

    const points = element.points;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();

    if ('startArrow' in element && element.startArrow) {
        drawArrowHead(ctx, points[1], points[0], element.style.strokeWidth);
    }
    if ('endArrow' in element && element.endArrow) {
        drawArrowHead(ctx, points[points.length - 2], points[points.length - 1], element.style.strokeWidth);
    }
};

const drawRectangle = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    if ('cornerRadius' in element && element.cornerRadius) {
        const radius = element.cornerRadius;
        ctx.beginPath();
        ctx.moveTo(element.x + radius, element.y);
        ctx.lineTo(element.x + element.width - radius, element.y);
        ctx.quadraticCurveTo(element.x + element.width, element.y, element.x + element.width, element.y + radius);
        ctx.lineTo(element.x + element.width, element.y + element.height - radius);
        ctx.quadraticCurveTo(
            element.x + element.width,
            element.y + element.height,
            element.x + element.width - radius,
            element.y + element.height
        );
        ctx.lineTo(element.x + radius, element.y + element.height);
        ctx.quadraticCurveTo(element.x, element.y + element.height, element.x, element.y + element.height - radius);
        ctx.lineTo(element.x, element.y + radius);
        ctx.quadraticCurveTo(element.x, element.y, element.x + radius, element.y);
        ctx.closePath();
    } else {
        ctx.beginPath();
        ctx.rect(element.x, element.y, element.width, element.height);
    }

    if (element.style.fillColor !== 'transparent') {
        ctx.fill();
    }
    ctx.stroke();
};

const drawEllipse = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const radiusX = element.width / 2;
    const radiusY = element.height / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

    if (element.style.fillColor !== 'transparent') {
        ctx.fill();
    }
    ctx.stroke();
};

const drawPath = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    if (!('points' in element) || !element.points || element.points.length < 2) return;

    const points = element.points;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
};

const drawText = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    if (!('text' in element)) return;

    const fontSize = element.fontSize || 16;
    const fontFamily = element.fontFamily || 'Arial';

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = element.style.strokeColor;
    ctx.textAlign = ('textAlign' in element ? element.textAlign : 'left') as CanvasTextAlign;
    ctx.textBaseline = 'top';

    const lines = element.text.split('\n');
    const lineHeight = fontSize * 1.2;

    lines.forEach((line, index) => {
        ctx.fillText(line, element.x, element.y + index * lineHeight);
    });
};

const drawNote = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    if (!('text' in element)) return;

    // Background
    ctx.fillStyle = element.style.fillColor;
    ctx.fillRect(element.x, element.y, element.width, element.height);

    // Border
    ctx.strokeStyle = element.style.strokeColor;
    ctx.lineWidth = element.style.strokeWidth;
    ctx.strokeRect(element.x, element.y, element.width, element.height);

    // Fold effect
    const foldSize = 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.moveTo(element.x + element.width - foldSize, element.y);
    ctx.lineTo(element.x + element.width, element.y);
    ctx.lineTo(element.x + element.width, element.y + foldSize);
    ctx.closePath();
    ctx.fill();

    // Text
    const fontSize = element.fontSize || 14;
    const fontFamily = element.fontFamily || 'Arial';
    const padding = 10;

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = element.text.split('\n');
    const lineHeight = fontSize * 1.4;
    const maxWidth = element.width - padding * 2;

    // Word wrap logic
    let yOffset = element.y + padding;
    lines.forEach(line => {
        const words = line.split(' ');
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine !== '') {
                ctx.fillText(currentLine, element.x + padding, yOffset);
                currentLine = word + ' ';
                yOffset += lineHeight;
            } else {
                currentLine = testLine;
            }
        });
        ctx.fillText(currentLine, element.x + padding, yOffset);
        yOffset += lineHeight;
    });
};

/**
 * Renders a single element to the canvas context.
 * Does not handle selection handles or bounding boxes.
 */
export const renderElement = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    if (element.isVisible === false) return;

    ctx.save();

    if (element.rotation && element.rotation !== 0) {
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate((element.rotation * Math.PI) / 180); // rotation is stored in degrees
        ctx.translate(-centerX, -centerY);
    }

    ctx.strokeStyle = element.style.strokeColor;
    ctx.fillStyle = element.style.fillColor;
    ctx.lineWidth = element.style.strokeWidth;
    ctx.globalAlpha = element.style.opacity;

    if (element.style.strokeStyle === 'dashed') {
        ctx.setLineDash([5, 5]);
    } else if (element.style.strokeStyle === 'dotted') {
        ctx.setLineDash([2, 2]);
    }

    switch (element.type) {
        case 'rectangle':
            drawRectangle(ctx, element);
            break;
        case 'ellipse':
            drawEllipse(ctx, element);
            break;
        case 'line':
            drawLine(ctx, element);
            break;
        case 'path':
            drawPath(ctx, element);
            break;
        case 'text':
            drawText(ctx, element);
            break;
        case 'note':
            drawNote(ctx, element);
            break;
    }

    ctx.restore();
};
