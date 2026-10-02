import React from 'react';
import { useBoardStore } from '../../../store/boardStore';
import { useTaskContextActions } from '../../tasks/hooks/useTaskContextActions';
import { getActiveContextTask, pluralizeTabs } from '../../tasks/utils/contextUtils';
import './ActiveContextPill.css';

/** Header indicator for the task whose tabs are open right now (Park & Resume) */
const ActiveContextPill: React.FC = () => {
    const activeTask = useBoardStore(state => getActiveContextTask(state.tasks));
    const { requestPark } = useTaskContextActions();

    if (!activeTask) return null;

    const count = activeTask.context?.tabs.length ?? 0;

    return (
        <div className="active-context-pill" title={`Working on "${activeTask.title}"`}>
            <span className="active-context-dot" aria-hidden="true" />
            <span className="active-context-title">{activeTask.title}</span>
            <span className="active-context-count">· {pluralizeTabs(count)}</span>
            <button
                type="button"
                className="active-context-park"
                onClick={() => requestPark(activeTask)}
                title="Park this task (Alt+Shift+P)"
            >
                ⏸ Park
            </button>
        </div>
    );
};

export default ActiveContextPill;
