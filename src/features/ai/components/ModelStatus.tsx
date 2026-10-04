import React from 'react';
import { ModelAvailability } from '../types';
import './ModelStatus.css';

const STATUS_TEXT: Record<ModelAvailability, string> = {
    available: 'On-device AI ready.',
    downloadable: 'On-device AI needs a one-time download by Chrome (a few GB). It starts the first time you use it.',
    downloading: 'Chrome is downloading the on-device AI model…',
    unavailable: "This device can't run Chrome's built-in AI. TabPlex will use simpler rules instead.",
    unsupported: "This browser doesn't have Chrome's built-in AI. TabPlex will use simpler rules instead.",
};

interface ModelStatusProps {
    availability: ModelAvailability;
    /** 0..1 while Chrome downloads the model, otherwise null */
    progress?: number | null;
    className?: string;
}

/** One line saying whether the on-device model can be used (Settings and the AI dialogs) */
const ModelStatus: React.FC<ModelStatusProps> = ({ availability, progress = null, className }) => (
    <p className={`ai-model-status${className ? ` ${className}` : ''}`} role="status">
        {progress !== null
            ? `Downloading on-device AI model… ${Math.round(progress * 100)}%`
            : STATUS_TEXT[availability]}
    </p>
);

export default ModelStatus;
