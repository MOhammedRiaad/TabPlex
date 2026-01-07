import React from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useShallow } from 'zustand/react/shallow';
import './AlignmentToolbar.css';

// Simple SVG Icons
const Icons = {
    AlignLeft: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="15" y1="12" x2="3" y2="12"></line>
            <line x1="17" y1="18" x2="3" y2="18"></line>
        </svg>
    ),
    AlignCenter: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="18" y1="6" x2="6" y2="6"></line>
            <line x1="21" y1="12" x2="3" y2="12"></line>
            <line x1="18" y1="18" x2="6" y2="18"></line>
        </svg>
    ),
    AlignRight: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="12" x2="9" y2="12"></line>
            <line x1="21" y1="18" x2="7" y2="18"></line>
        </svg>
    ),
    AlignTop: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="6" y1="3" x2="6" y2="21"></line>
            <line x1="12" y1="3" x2="12" y2="15"></line>
            <line x1="18" y1="3" x2="18" y2="17"></line>
            <line x1="3" y1="3" x2="21" y2="3"></line> {/* Top line */}
        </svg>
    ),
    AlignMiddle: () => (
        // Vertical Center
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="6" y1="18" x2="6" y2="6"></line>
            <line x1="12" y1="21" x2="12" y2="3"></line>
            <line x1="18" y1="18" x2="18" y2="6"></line>
        </svg>
    ),
    AlignBottom: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="6" y1="21" x2="6" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="9"></line>
            <line x1="18" y1="21" x2="18" y2="7"></line>
            <line x1="3" y1="21" x2="21" y2="21"></line> {/* Bottom line */}
        </svg>
    ),
    DistributeHoriz: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="6" width="4" height="12"></rect>
            <rect x="17" y="6" width="4" height="12"></rect>
            <path d="M7 12h10"></path>
        </svg>
    ),
    DistributeVert: () => (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="6" y="3" width="12" height="4"></rect>
            <rect x="6" y="17" width="12" height="4"></rect>
            <path d="M12 7v10"></path>
        </svg>
    ),
};

const AlignmentToolbar: React.FC = () => {
    const activeCanvas = useCanvasStore(state => state.canvases.find(c => c.canvasId === state.activeCanvasId));

    const { alignElements, distributeElements } = useCanvasStore(
        useShallow(state => ({
            alignElements: state.alignElements,
            distributeElements: state.distributeElements,
        }))
    );

    if (!activeCanvas || activeCanvas.selectedIds.length < 2) {
        return null;
    }

    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        alignElements(type);
    };

    const handleDistribute = (type: 'horizontal' | 'vertical') => {
        if (activeCanvas.selectedIds.length < 3) return;
        distributeElements(type);
    };

    const hasThreeOrMore = activeCanvas.selectedIds.length >= 3;

    return (
        <div className="alignment-toolbar">
            <div className="alignment-group">
                <button title="Align Left" onClick={() => handleAlign('left')}>
                    <Icons.AlignLeft />
                </button>
                <button title="Global Horizontal Center" onClick={() => handleAlign('center')}>
                    <Icons.AlignCenter />
                </button>
                <button title="Align Right" onClick={() => handleAlign('right')}>
                    <Icons.AlignRight />
                </button>
            </div>
            <div className="alignment-divider"></div>
            <div className="alignment-group">
                <button title="Align Top" onClick={() => handleAlign('top')}>
                    <Icons.AlignTop />
                </button>
                <button title="Global Vertical Center" onClick={() => handleAlign('middle')}>
                    <Icons.AlignMiddle />
                </button>
                <button title="Align Bottom" onClick={() => handleAlign('bottom')}>
                    <Icons.AlignBottom />
                </button>
            </div>

            {hasThreeOrMore && (
                <>
                    <div className="alignment-divider"></div>
                    <div className="alignment-group">
                        <button title="Distribute Horizontally" onClick={() => handleDistribute('horizontal')}>
                            <Icons.DistributeHoriz />
                        </button>
                        <button title="Distribute Vertically" onClick={() => handleDistribute('vertical')}>
                            <Icons.DistributeVert />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default AlignmentToolbar;
