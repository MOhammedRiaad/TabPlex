import React, { useEffect, useRef, useState } from 'react';
import { Task } from '../../../types';
import { useBoardStore } from '../../../store/boardStore';
import { getFaviconUrl } from '../../../utils/favicon';
import { useAiSettings } from '../../ai/hooks/useAiSettings';
import { useModelAvailability } from '../../ai/hooks/useModelAvailability';
import ModelStatus from '../../ai/components/ModelStatus';
import { OrganizableTab } from '../../ai/types';
import { aiErrorMessage } from '../../ai/utils/promptApi';
import { shortUrlForAi } from '../../ai/utils/tabText';
import { getActiveContextTask } from '../../tasks/utils/contextUtils';
import { canDraftWithAi, tabsChangedSinceDraft, useTaskDraftStore } from '../store/taskDraftStore';
import { useCreateTaskFromTabs } from '../hooks/useCreateTaskFromTabs';
import { HINT_MAX, MAX_STEPS, STEP_MAX, TASK_DESCRIPTION_MAX, TASK_TITLE_MAX } from '../types';
import './TaskFromTabsDialog.css';

type CreateAction = 'create' | 'start' | 'park';

/** Tab lists longer than this start collapsed */
const EXPANDED_TAB_LIMIT = 8;

const PRIORITIES: { value: Task['priority']; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

const Favicon: React.FC<{ tab: OrganizableTab }> = ({ tab }) => {
    const [failed, setFailed] = useState(false);
    const src = tab.favicon || getFaviconUrl(tab.url, 16);
    if (!src || failed)
        return (
            <span className="task-from-tabs-favicon" aria-hidden="true">
                🌐
            </span>
        );
    return <img className="task-from-tabs-favicon" src={src} alt="" onError={() => setFailed(true)} />;
};

/** "New task from tabs": draft a task from the picked tabs, edit it, then create (and start) it. Rendered once, in App. */
const TaskFromTabsDialog: React.FC = () => {
    const { settings } = useAiSettings();
    const { availability } = useModelAvailability();
    const state = useTaskDraftStore();
    const { actions, phase, tabs, checkedIds } = state;
    const tasks = useBoardStore(s => s.tasks);
    const { create, createAndStart, createAndPark } = useCreateTaskFromTabs();
    const [clicked, setClicked] = useState<CreateAction | null>(null);
    const [tabsOpen, setTabsOpen] = useState(true);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const focusedTitle = useRef(false);
    /** The element that had focus when the dialog opened (e.g. the button), focused again on close */
    const opener = useRef<HTMLElement | null>(null);

    // Keep the store's environment current: the click handler reads it synchronously
    useEffect(() => {
        actions.setEnvironment({ aiEnabled: settings.taskDrafts, availability });
    }, [actions, settings.taskDrafts, availability]);

    // Long tab lists start collapsed, once per opening
    const tabCount = tabs.length;
    useEffect(() => {
        if (tabCount > 0) setTabsOpen(tabCount <= EXPANDED_TAB_LIMIT);
    }, [tabCount]);

    // Focus the heading while drafting, then the title input once (when a draft is shown). On close, give
    // focus back to whatever opened the dialog, if it's still on the page.
    useEffect(() => {
        if (phase !== 'closed' && opener.current === null) {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
        }
        if (phase === 'closed') {
            focusedTitle.current = false;
            setClicked(null);
            if (opener.current?.isConnected) opener.current.focus();
            opener.current = null;
        } else if (phase === 'drafting') {
            headingRef.current?.focus();
        } else if ((phase === 'ready' || phase === 'error') && !focusedTitle.current) {
            focusedTitle.current = true;
            titleRef.current?.focus();
        }
    }, [phase]);

    useEffect(() => {
        if (phase === 'closed') return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && phase !== 'creating') actions.cancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [phase, actions]);

    if (phase === 'closed') return null;

    const drafting = phase === 'drafting';
    const creating = phase === 'creating';
    const aiUsable = canDraftWithAi(settings.taskDrafts, availability);
    const canCreate = state.title.trim().length > 0 && !drafting && !creating;
    const activeTask = getActiveContextTask(tasks);
    const changed = tabsChangedSinceDraft(state);

    const run = (which: CreateAction) => {
        setClicked(which);
        const action = { create, start: createAndStart, park: createAndPark }[which];
        action().finally(() => setClicked(null));
    };

    return (
        <div className="task-from-tabs-overlay">
            <div
                className="task-from-tabs-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-from-tabs-title"
            >
                <div className="task-from-tabs-header">
                    <h2 id="task-from-tabs-title" ref={headingRef} tabIndex={-1}>
                        New task from tabs
                    </h2>
                    {drafting && <span className="task-from-tabs-badge">Drafting…</span>}
                    {!drafting && state.source === 'ai' && (
                        <span className="task-from-tabs-badge">✨ Drafted on your device</span>
                    )}
                </div>

                <div className="task-from-tabs-body">
                    {drafting && (
                        <>
                            <p className="task-from-tabs-note" role="status">
                                Drafting from {checkedIds.length} {checkedIds.length === 1 ? 'tab' : 'tabs'}…
                            </p>
                            {/* Chrome reports 100% even when the model was already installed: show real downloads only */}
                            {state.downloadProgress !== null && state.downloadProgress < 1 && (
                                <ModelStatus availability={availability} progress={state.downloadProgress} />
                            )}
                        </>
                    )}
                    {!drafting && state.trimmedTo !== null && (
                        <p className="task-from-tabs-note">ⓘ The draft is based on the first {state.trimmedTo} tabs.</p>
                    )}
                    {phase === 'error' && (
                        <p className="task-from-tabs-error" role="alert">
                            {aiErrorMessage(state.error).replace(/\.$/, '')}. You can edit the task yourself.
                        </p>
                    )}

                    <section className="task-from-tabs-tabs" aria-label="Tabs">
                        <div className="task-from-tabs-tabs-header">
                            <span>
                                Tabs ({checkedIds.length} of {tabs.length})
                            </span>
                            <button
                                type="button"
                                className="task-from-tabs-link"
                                aria-expanded={tabsOpen}
                                onClick={() => setTabsOpen(open => !open)}
                            >
                                {tabsOpen ? '▾ hide' : '▸ show'}
                            </button>
                        </div>
                        {tabsOpen && (
                            <ul>
                                {tabs.map(tab => (
                                    <li key={tab.id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={checkedIds.includes(tab.id)}
                                                onChange={() => actions.toggleTab(tab.id)}
                                                disabled={creating}
                                                aria-label={`Include ${tab.title}`}
                                            />
                                            <Favicon tab={tab} />
                                            <span className="task-from-tabs-tab-title">{tab.title}</span>
                                            <span className="task-from-tabs-tab-url">{shortUrlForAi(tab.url)}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <fieldset
                        className={`task-from-tabs-fields${drafting ? ' is-drafting' : ''}`}
                        disabled={drafting || creating}
                    >
                        <label className="task-from-tabs-field">
                            <span>Title</span>
                            <input
                                ref={titleRef}
                                type="text"
                                value={state.title}
                                maxLength={TASK_TITLE_MAX}
                                onChange={e => actions.setTitle(e.target.value)}
                                aria-label="Task title"
                                required
                            />
                        </label>
                        <label className="task-from-tabs-field">
                            <span>Notes</span>
                            <textarea
                                value={state.description}
                                maxLength={TASK_DESCRIPTION_MAX}
                                rows={3}
                                onChange={e => actions.setDescription(e.target.value)}
                            />
                        </label>
                        <div className="task-from-tabs-field" role="radiogroup" aria-label="Priority">
                            <span>Priority</span>
                            <div className="task-from-tabs-priorities">
                                {PRIORITIES.map(({ value, label }) => (
                                    <label key={value}>
                                        <input
                                            type="radio"
                                            name="task-from-tabs-priority"
                                            value={value}
                                            checked={state.priority === value}
                                            onChange={() => actions.setPriority(value)}
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="task-from-tabs-field">
                            <span>Steps</span>
                            <ul className="task-from-tabs-steps">
                                {state.steps.map((step, i) => (
                                    <li key={step.key}>
                                        <input
                                            type="checkbox"
                                            checked={step.included}
                                            onChange={() => actions.toggleStep(step.key)}
                                            aria-label={`Include step ${i + 1}`}
                                        />
                                        <input
                                            type="text"
                                            value={step.text}
                                            maxLength={STEP_MAX}
                                            onChange={e => actions.setStep(step.key, e.target.value)}
                                            aria-label={`Step ${i + 1}`}
                                        />
                                        <button
                                            type="button"
                                            className="task-from-tabs-remove"
                                            onClick={() => actions.removeStep(step.key)}
                                            aria-label={`Remove step ${i + 1}`}
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {state.steps.length < MAX_STEPS && (
                                <button type="button" className="task-from-tabs-link" onClick={actions.addStep}>
                                    + Add step
                                </button>
                            )}
                        </div>
                    </fieldset>

                    {aiUsable && (
                        <div className="task-from-tabs-hint">
                            <label>
                                <span>Hint for AI</span>
                                <input
                                    type="text"
                                    value={state.hint}
                                    maxLength={HINT_MAX}
                                    placeholder='e.g. "for the Q4 launch"'
                                    onChange={e => actions.setHint(e.target.value)}
                                    disabled={drafting || creating}
                                />
                            </label>
                            <button
                                type="button"
                                className={`task-from-tabs-btn${changed ? ' has-dot' : ''}`}
                                onClick={actions.draftAgain}
                                disabled={drafting || creating}
                            >
                                {changed ? '↻ Draft again (tabs changed)' : '↻ Draft again'}
                            </button>
                        </div>
                    )}

                    {activeTask && (
                        <p className="task-from-tabs-note">ⓘ Starting this task will park “{activeTask.title}”.</p>
                    )}
                </div>

                <div className="task-from-tabs-actions">
                    <button type="button" className="task-from-tabs-btn" onClick={actions.cancel} disabled={creating}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="task-from-tabs-btn"
                        onClick={() => run('create')}
                        disabled={!canCreate}
                    >
                        {creating && clicked === 'create' ? 'Creating…' : 'Create task'}
                    </button>
                    <button
                        type="button"
                        className="task-from-tabs-btn"
                        onClick={() => run('park')}
                        disabled={!canCreate || checkedIds.length === 0}
                        title="Save the checked tabs to a new task and close them, for later"
                    >
                        {creating && clicked === 'park' ? 'Parking…' : '⏸ Create & park'}
                    </button>
                    <button
                        type="button"
                        className="task-from-tabs-btn-primary"
                        onClick={() => run('start')}
                        disabled={!canCreate}
                    >
                        {creating && clicked === 'start' ? 'Starting…' : '▶ Create & start'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskFromTabsDialog;
