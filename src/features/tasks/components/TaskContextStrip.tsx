import React, { useState } from 'react';
import { ContextTab, Task } from '../../../types';
import { formatRelative } from '../../../utils/dateUtils';
import { useTaskContextActions } from '../hooks/useTaskContextActions';
import { pluralizeTabs } from '../utils/contextUtils';
import './TaskContextStrip.css';

const MAX_FAVICONS = 5;

const Favicon: React.FC<{ tab: ContextTab }> = ({ tab }) => {
    const [failed, setFailed] = useState(false);
    if (!tab.favicon || failed) {
        return (
            <span className="context-favicon context-favicon-fallback" title={tab.title}>
                {(tab.title || tab.url).charAt(0).toUpperCase()}
            </span>
        );
    }
    return (
        <img className="context-favicon" src={tab.favicon} alt="" title={tab.title} onError={() => setFailed(true)} />
    );
};

interface TaskContextStripProps {
    task: Task;
    /** Hide the add/edit controls (used on the Today view) */
    compact?: boolean;
}

/** Park & Resume controls and summary for one task */
const TaskContextStrip: React.FC<TaskContextStripProps> = ({ task, compact = false }) => {
    const { startOrResume, requestPark, addCurrentTabs, removeTab } = useTaskContextActions();
    const [expanded, setExpanded] = useState(false);
    const [busy, setBusy] = useState(false);

    const ctx = task.context;
    const tabs = ctx?.tabs ?? [];
    const state = ctx?.state ?? 'idle';
    const isDone = task.status === 'done';

    const run = (action: () => Promise<void>) => async () => {
        setBusy(true);
        try {
            await action();
        } finally {
            setBusy(false);
        }
    };

    if (isDone && tabs.length === 0) return null;

    const statusLabel =
        state === 'active'
            ? 'Active now'
            : state === 'parked' && ctx?.parkedAt
              ? `Parked ${formatRelative(ctx.parkedAt)}`
              : tabs.length
                ? 'Not started'
                : '';

    return (
        <div className={`task-context task-context-${state}`} onClick={e => e.stopPropagation()}>
            {(tabs.length > 0 || state !== 'idle') && (
                <button
                    type="button"
                    className="task-context-summary"
                    onClick={() => setExpanded(v => !v)}
                    aria-expanded={expanded}
                    title={expanded ? 'Hide tabs' : 'Show tabs'}
                >
                    {state === 'active' && <span className="task-context-dot" aria-hidden="true" />}
                    <span className="task-context-favicons">
                        {tabs.slice(0, MAX_FAVICONS).map(tab => (
                            <Favicon key={tab.url} tab={tab} />
                        ))}
                    </span>
                    <span className="task-context-meta">
                        {pluralizeTabs(tabs.length)}
                        {statusLabel && <> · {statusLabel}</>}
                    </span>
                    <span className="task-context-chevron" aria-hidden="true">
                        {expanded ? '▾' : '▸'}
                    </span>
                </button>
            )}

            {state === 'parked' && ctx?.resumeNote && <p className="task-context-note">“{ctx.resumeNote}”</p>}
            {state === 'parked' && ctx?.aiSummary && (
                <p className="task-context-summary-ai" title="Written on your device by Chrome's built-in AI">
                    <span aria-hidden="true">✨</span> {ctx.aiSummary}
                </p>
            )}

            {expanded && tabs.length > 0 && (
                <ul className="task-context-tabs">
                    {tabs.map(tab => (
                        <li key={tab.url}>
                            <Favicon tab={tab} />
                            <a href={tab.url} target="_blank" rel="noopener noreferrer" title={tab.url}>
                                {tab.title}
                            </a>
                            {!compact && !isDone && (
                                <button
                                    type="button"
                                    className="task-context-remove"
                                    onClick={run(() => removeTab(task, tab.url))}
                                    disabled={busy}
                                    aria-label={`Remove ${tab.title} from this task`}
                                    title="Remove from task"
                                >
                                    ×
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!isDone && (
                <div className="task-context-actions">
                    {state === 'active' ? (
                        <button
                            type="button"
                            className="task-context-btn task-context-btn-primary"
                            onClick={() => requestPark(task)}
                            disabled={busy}
                            title="Save this task's tabs and a note, then close them"
                        >
                            ⏸ Park
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="task-context-btn task-context-btn-primary"
                            onClick={run(() => startOrResume(task))}
                            disabled={busy}
                            title={
                                state === 'parked'
                                    ? 'Reopen this task’s tabs in a tab group'
                                    : 'Start working: tabs you open join this task’s group'
                            }
                        >
                            ▶ {state === 'parked' ? 'Resume' : 'Start'}
                        </button>
                    )}
                    {!compact && (
                        <button
                            type="button"
                            className="task-context-btn"
                            onClick={run(() => addCurrentTabs(task))}
                            disabled={busy}
                            title="Attach the tabs open in this window to the task"
                        >
                            + Add current tabs
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TaskContextStrip;
