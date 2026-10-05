import React from 'react';
import ModelStatus from './ModelStatus';
import { useAiSettings } from '../hooks/useAiSettings';
import { useModelAvailability } from '../hooks/useModelAvailability';
import { AiSettings } from '../types';

const FEATURES: { key: keyof AiSettings; title: string; description: string }[] = [
    {
        key: 'tabGrouping',
        title: 'Organize tabs with AI',
        description: "Suggest tab groups by what you're working on. Without AI, tabs are grouped by site.",
    },
    {
        key: 'taskDrafts',
        title: 'Draft tasks from tabs',
        description: 'Pre-fill the title, priority and steps of a new task from its tabs.',
    },
    {
        key: 'sessionNames',
        title: 'Name saved sessions',
        description: 'Give sessions saved from your tabs a short name. Without AI, they are named after their sites.',
    },
];

/**
 * Settings → On-device AI. The switches stay enabled when the model is unavailable: they mean "use AI when
 * you can", and every feature has a non-AI fallback.
 */
const AiFeaturesSetting: React.FC = () => {
    const { settings, updateSettings } = useAiSettings();
    const { availability } = useModelAvailability();

    return (
        <>
            <div className="setting-item">
                <div className="setting-info">
                    <ModelStatus availability={availability} className="setting-status" />
                </div>
            </div>
            {FEATURES.map(feature => (
                <div className="setting-item" key={feature.key}>
                    <div className="setting-info">
                        <h4>{feature.title}</h4>
                        <p>{feature.description}</p>
                    </div>
                    <div className="setting-control">
                        <input
                            type="checkbox"
                            className="setting-checkbox"
                            aria-label={feature.title}
                            checked={settings[feature.key]}
                            onChange={e => updateSettings({ [feature.key]: e.target.checked })}
                        />
                    </div>
                </div>
            ))}
            <p className="setting-status">
                Your tabs&apos; titles and addresses are processed on this computer by Chrome&apos;s built-in AI.
                Nothing is sent to TabPlex or anyone else.
            </p>
        </>
    );
};

export default AiFeaturesSetting;
