import React, { useEffect, useRef, useState } from 'react';
import { ContextTab } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { useUIActions, useUIStore } from '../../ui/store/uiStore';
import { isCapturableUrl, RESUME_NOTE_MAX_LENGTH } from '../../../utils/taskContext';
import { useTaskContextActions } from '../hooks/useTaskContextActions';
import { useParkResumeSettings } from '../hooks/useParkResumeSettings';
import './ParkDialog.css';

/** Read the tabs currently in the task's Chrome group, so the user can choose which to keep open */
async function readLiveTabs(groupId: number | null | undefined): Promise<ContextTab[]> {
    if (groupId === null || groupId === undefined || groupId < 0) return [];
    try {
        const tabs = await chrome.tabs.query({ groupId });
        const base = chrome.runtime.getURL('');
        const seen = new Set<string>();
        return tabs.flatMap(tab => {
            const url = tab.url || tab.pendingUrl;
            if (!isCapturableUrl(url, base) || seen.has(url)) return [];
            seen.add(url);
            return [{ url, title: tab.title || url, favicon: tab.favIconUrl || undefined }];
        });
    } catch {
        return [];
    }
}

/** "Where did you leave off?" — shown when parking an active task. Rendered once, in App. */
const ParkDialog: React.FC = () => {
    const taskId = useUIStore(state => state.parkDialogTaskId);
    const { closeParkDialog } = useUIActions();
    const task = useBoardStore(state => (taskId ? state.tasks.find(t => t.id === taskId) : undefined));
    const { park } = useTaskContextActions();
    const { settings, updateSettings } = useParkResumeSettings();

    const [note, setNote] = useState('');
    const [liveTabs, setLiveTabs] = useState<ContextTab[]>([]);
    const [keepOpen, setKeepOpen] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const groupId = task?.context?.chromeGroupId;

    // Reset every time the dialog opens for a task
    useEffect(() => {
        if (!taskId) return;
        setNote('');
        setKeepOpen(new Set());
        setSubmitting(false);
        readLiveTabs(groupId).then(setLiveTabs);
        // Focus after the dialog renders
        const timer = setTimeout(() => inputRef.current?.focus(), 0);
        return () => clearTimeout(timer);
    }, [taskId, groupId]);

    useEffect(() => {
        if (!taskId) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeParkDialog();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [taskId, closeParkDialog]);

    if (!taskId || !task) return null;

    const tabs = liveTabs.length ? liveTabs : (task.context?.tabs ?? []);

    const submit = async (withNote: boolean) => {
        if (submitting) return;
        setSubmitting(true);
        await park(task, {
            note: withNote ? note : '',
            closeTabs: settings.closeTabsOnPark,
            keepOpenUrls: [...keepOpen],
        });
        closeParkDialog();
    };

    const toggleKeep = (url: string) =>
        setKeepOpen(prev => {
            const next = new Set(prev);
            if (next.has(url)) next.delete(url);
            else next.add(url);
            return next;
        });

    return (
        <div className="park-dialog-overlay" onClick={closeParkDialog}>
            <div
                className="park-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="park-dialog-title"
                onClick={e => e.stopPropagation()}
            >
                <h2 id="park-dialog-title" className="park-dialog-title">
                    Park “{task.title}”
                </h2>

                <label className="park-dialog-label" htmlFor="park-dialog-note">
                    Where did you leave off?
                </label>
                <textarea
                    id="park-dialog-note"
                    ref={inputRef}
                    className="park-dialog-note"
                    value={note}
                    maxLength={RESUME_NOTE_MAX_LENGTH}
                    rows={3}
                    placeholder="e.g. Comparing Stripe vs Paddle fees — stopped at the VAT section"
                    onChange={e => setNote(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            submit(true);
                        }
                    }}
                />
                <div className="park-dialog-count">
                    {note.length}/{RESUME_NOTE_MAX_LENGTH}
                </div>

                {tabs.length > 0 && (
                    <fieldset className="park-dialog-tabs">
                        <legend>Tabs to save ({tabs.length - keepOpen.size})</legend>
                        <ul>
                            {tabs.map(tab => (
                                <li key={tab.url}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={!keepOpen.has(tab.url)}
                                            onChange={() => toggleKeep(tab.url)}
                                        />
                                        <span title={tab.url}>{tab.title}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                        {keepOpen.size > 0 && (
                            <p className="park-dialog-hint">Unchecked tabs stay open and leave this task.</p>
                        )}
                    </fieldset>
                )}

                <label className="park-dialog-toggle">
                    <input
                        type="checkbox"
                        checked={settings.closeTabsOnPark}
                        onChange={e => updateSettings({ closeTabsOnPark: e.target.checked })}
                    />
                    Close tabs after parking
                </label>

                <div className="park-dialog-actions">
                    <button
                        type="button"
                        className="park-dialog-link"
                        onClick={() => submit(false)}
                        disabled={submitting}
                    >
                        Park without note
                    </button>
                    <button
                        type="button"
                        className="park-dialog-cancel"
                        onClick={closeParkDialog}
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="park-dialog-submit"
                        onClick={() => submit(true)}
                        disabled={submitting}
                    >
                        {submitting ? 'Parking…' : 'Park'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ParkDialog;
