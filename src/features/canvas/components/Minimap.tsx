import React, { useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useShallow } from 'zustand/react/shallow';
import { CanvasElement } from '../types/canvas';
import './Minimap.css';

const MINIMAP_SIZE = 150;
const PADDING = 20;

export const Minimap: React.FC = () => {
    const { elements, panX, panY, zoom, setPan } = useCanvasStore(
        useShallow(state => {
            const activeCanvas = state.canvases.find(c => c.canvasId === state.activeCanvasId);
            return {
                elements: activeCanvas?.elements || [],
                panX: activeCanvas?.panX || 0,
                panY: activeCanvas?.panY || 0,
                zoom: activeCanvas?.zoom || 1,
                setPan: state.setPan,
            };
        })
    );

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate bounding box of all elements
    const getBounds = () => {
        if (elements.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };

        const xs = elements.map((el: CanvasElement) => el.x);
        const ys = elements.map((el: CanvasElement) => el.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...elements.map((el: CanvasElement) => el.x + el.width));
        const maxY = Math.max(...elements.map((el: CanvasElement) => el.y + el.height));

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };

    const bounds = getBounds();
    // Add some padding to bounds
    const totalBounds = {
        x: bounds.minX - PADDING,
        y: bounds.minY - PADDING,
        width: bounds.width + PADDING * 2,
        height: bounds.height + PADDING * 2,
    };

    // Calculate scale scale to fit in minimap
    const scale = Math.min(
        MINIMAP_SIZE / Math.max(totalBounds.width, 1),
        MINIMAP_SIZE / Math.max(totalBounds.height, 1)
    );

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        ctx.save();
        // Center the content in the minimap
        const mapOffsetX = (MINIMAP_SIZE - totalBounds.width * scale) / 2;
        const mapOffsetY = (MINIMAP_SIZE - totalBounds.height * scale) / 2;

        ctx.translate(mapOffsetX, mapOffsetY);
        ctx.scale(scale, scale);
        ctx.translate(-totalBounds.x, -totalBounds.y);

        // Draw elements
        elements.forEach((el: CanvasElement) => {
            ctx.fillStyle = el.style.fillColor === 'transparent' ? '#ccc' : el.style.fillColor;
            ctx.strokeStyle = el.style.strokeColor;
            ctx.lineWidth = el.style.strokeWidth / scale; // Keep lines visible? No, proportional.

            if (el.type === 'rectangle' || el.type === 'text' || el.type === 'note') {
                ctx.fillRect(el.x, el.y, el.width, el.height);
                if (el.style.strokeWidth > 0) {
                    ctx.strokeRect(el.x, el.y, el.width, el.height);
                }
            } else if (el.type === 'ellipse') {
                ctx.beginPath();
                ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            } else if (el.type === 'path') {
                ctx.beginPath();
                el.points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
            }
        });

        ctx.restore();
    }, [elements, totalBounds, scale]);

    // Viewport calculation
    const mapOffsetX = (MINIMAP_SIZE - totalBounds.width * scale) / 2;
    const mapOffsetY = (MINIMAP_SIZE - totalBounds.height * scale) / 2;

    const vpW = window.innerWidth / zoom;
    const vpH = window.innerHeight / zoom;
    const vpX = -panX / zoom;
    const vpY = -panY / zoom;

    const miniX = mapOffsetX + (vpX - totalBounds.x) * scale;
    const miniY = mapOffsetY + (vpY - totalBounds.y) * scale;
    const miniW = vpW * scale;
    const miniH = vpH * scale;

    const handleMapClick = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const worldX = (clickX - mapOffsetX) / scale + totalBounds.x;
        const worldY = (clickY - mapOffsetY) / scale + totalBounds.y;

        const newPanX = -(worldX * zoom - window.innerWidth / 2);
        const newPanY = -(worldY * zoom - window.innerHeight / 2);

        setPan(newPanX, newPanY);
    };

    return (
        <div className="minimap-container" ref={containerRef} onClick={handleMapClick}>
            <canvas ref={canvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
            <div
                className="minimap-viewport"
                style={{
                    left: miniX,
                    top: miniY,
                    width: miniW,
                    height: miniH,
                }}
            />
        </div>
    );
};
