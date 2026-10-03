import React, { useEffect, useState } from 'react';
import { createSummarizer, getSummaryAvailability, SummaryAvailability } from '../../tasks/utils/aiSummary';

interface AiSummarySettingProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

const STATUS_TEXT: Record<SummaryAvailability, string> = {
    available: 'Ready on this device.',
    downloadable: 'Needs a one-time model download by Chrome (a few GB). It starts when you turn this on.',
    downloading: 'Chrome is downloading the model…',
    unavailable: "This device doesn't meet Chrome's requirements for built-in AI.",
    unsupported: "This browser doesn't support Chrome's built-in AI (Chrome 138+ on desktop).",
};

/** Park & Resume: on-device AI summaries (Chrome built-in Summarizer API) */
const AiSummarySetting: React.FC<AiSummarySettingProps> = ({ enabled, onChange }) => {
    const [availability, setAvailability] = useState<SummaryAvailability>('unsupported');
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getSummaryAvailability().then(setAvailability);
    }, []);

    const canUse = availability === 'available' || availability === 'downloadable' || availability === 'downloading';

    const handleToggle = (next: boolean) => {
        setError(null);
        onChange(next);
        if (next && availability !== 'available') {
            // Runs inside the click handler, so Chrome lets the download start
            setProgress(0);
            createSummarizer(fraction => setProgress(fraction))
                .then(summarizer => {
                    summarizer.destroy?.();
                    setProgress(null);
                    setAvailability('available');
                })
                .catch((e: unknown) => {
                    setProgress(null);
                    setError(e instanceof Error ? e.message : String(e));
                    getSummaryAvailability().then(setAvailability);
                });
        }
    };

    return (
        <div className="setting-item">
            <div className="setting-info">
                <h4>On-device AI summaries</h4>
                <p>
                    When you park a task, Chrome&apos;s built-in AI writes a one-line summary of what you were doing. It
                    runs on your computer: tab titles and addresses never leave it.
                </p>
                <p className="setting-status">
                    {progress !== null
                        ? `Downloading model… ${Math.round(progress * 100)}%`
                        : STATUS_TEXT[availability]}
                    {error && <> — {error}</>}
                </p>
            </div>
            <div className="setting-control">
                <input
                    type="checkbox"
                    className="setting-checkbox"
                    aria-label="On-device AI summaries"
                    checked={enabled && canUse}
                    disabled={!canUse}
                    onChange={e => handleToggle(e.target.checked)}
                />
            </div>
        </div>
    );
};

export default AiSummarySetting;
