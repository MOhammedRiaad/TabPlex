import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../../store/boardStore';
import { formatRelative } from '../../../utils/dateUtils';
import { useTaskContextActions } from '../../tasks/hooks/useTaskContextActions';
import { getParkedTasks, pluralizeTabs } from '../../tasks/utils/contextUtils';
import './ParkedContexts.css';

const MAX_FAVICONS = 5;

/** "Pick up where you left off" — parked task contexts on the Today view (Park & Resume) */
const ParkedContexts: React.FC = () => {
    const parked = useBoardStore(useShallow(state => getParkedTasks(state.tasks)));
    const { startOrResume } = useTaskContextActions();

    if (parked.length === 0) return null;

    return (
        <section className="dashboard-card parked-contexts" aria-labelledby="parked-contexts-title">
            <h2 id="parked-contexts-title" className="parked-contexts-title">
                Pick up where you left off
            </h2>
            <ul className="parked-contexts-list">
                {parked.map(task => {
                    const tabs = task.context?.tabs ?? [];
                    return (
                        <li key={task.id} className="parked-context">
                            <div className="parked-context-main">
                                <div className="parked-context-head">
                                    <span className="parked-context-name">{task.title}</span>
                                    <span className="parked-context-meta">
                                        {pluralizeTabs(tabs.length)}
                                        {task.context?.parkedAt && <> · {formatRelative(task.context.parkedAt)}</>}
                                    </span>
                                </div>
                                {task.context?.resumeNote && (
                                    <p className="parked-context-note">“{task.context.resumeNote}”</p>
                                )}
                                <div className="parked-context-favicons" aria-hidden="true">
                                    {tabs.slice(0, MAX_FAVICONS).map(tab =>
                                        tab.favicon ? (
                                            <img key={tab.url} src={tab.favicon} alt="" title={tab.title} />
                                        ) : (
                                            <span key={tab.url} title={tab.title}>
                                                {(tab.title || tab.url).charAt(0).toUpperCase()}
                                            </span>
                                        )
                                    )}
                                    {tabs.length > MAX_FAVICONS && <em>+{tabs.length - MAX_FAVICONS}</em>}
                                </div>
                            </div>
                            <button type="button" className="parked-context-resume" onClick={() => startOrResume(task)}>
                                ▶ Resume
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default ParkedContexts;
