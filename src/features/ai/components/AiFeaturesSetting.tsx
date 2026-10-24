import React, { useCallback, useEffect, useState } from 'react';
import ModelStatus from './ModelStatus';
import { useAiSettings } from '../hooks/useAiSettings';
import { useModelAvailability } from '../hooks/useModelAvailability';
import { AiSettings } from '../types';
import { grantedOrigins, revokeAllPageAccess } from '../../tabNotes/utils/pageAccess';

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
    {
        key: 'noteHelpers',
        title: 'Note helpers',
        description:
            'A ✨ AI menu in the note editor: summarize a note, turn its to-dos into tasks, proofread or rewrite it. Hidden when AI is not available.',
    },
    {
        key: 'tabSummaries',
        title: 'Summarize open tabs with AI',
        description:
            "Summarize the tabs you pick into a note with your browser's built-in AI. Without AI, TabPlex makes a quick view from the page text.",
    },
];

/**
 * Page access for "Summarize open tabs": the sites TabPlex was allowed to read, with one button to remove them all.
 * Access is optional and per site, so removing all of it is safe.
 */
const PageAccessRow: React.FC = () => {
    const [origins, setOrigins] = useState<string[] | null>(null);

    const refresh = useCallback(() => {
        grantedOrigins()
            .then(setOrigins)
            .catch(() => setOrigins([]));
    }, []);

    useEffect(() => {
        refresh();
        chrome.permissions.onAdded.addListener(refresh);
        chrome.permissions.onRemoved.addListener(refresh);
        return () => {
            chrome.permissions.onAdded.removeListener(refresh);
            chrome.permissions.onRemoved.removeListener(refresh);
        };
    }, [refresh]);

    const count = origins?.length ?? 0;
    const onRemove = () => {
        revokeAllPageAccess().catch(console.error).finally(refresh);
    };

    return (
        <div className="setting-item">
            <div className="setting-info">
                <h4>Page access</h4>
                <p>
                    {origins === null
                        ? ''
                        : count === 0
                          ? 'No sites allowed yet.'
                          : `TabPlex can read ${count} ${count === 1 ? 'site' : 'sites'} you allowed.`}
                </p>
                <p>
                    Pages are only read when you click Summarize. You can also remove access in your browser&apos;s
                    extension settings.
                </p>
            </div>
            <div className="setting-control">
                <button type="button" className="setting-action-btn danger" onClick={onRemove} disabled={count === 0}>
                    Remove access
                </button>
            </div>
        </div>
    );
};

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
            <PageAccessRow />
            <p className="setting-status">
                Your tabs&apos; titles and addresses, the text of pages you pick for a summary, and the notes you use a
                helper on, are processed on this computer by your browser&apos;s built-in AI. Nothing is sent to TabPlex
                or anyone else.
            </p>
        </>
    );
};

export default AiFeaturesSetting;
