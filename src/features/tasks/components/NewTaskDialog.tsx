import React from 'react';
import { useBoardStore } from '../../../store/boardStore';
import { generateTaskId } from '../../../utils/idGenerator';
import { useUIActions, useUIStore } from '../../ui/store/uiStore';
import TaskForm, { EMPTY_TASK_FORM, formValuesToTask } from './TaskForm';
import './NewTaskDialog.css';

/** "New task" from anywhere (command palette, Ctrl+Shift+K, Today quick action). Rendered once, in App. */
const NewTaskDialog: React.FC = () => {
    const open = useUIStore(state => state.newTaskDialogOpen);
    const { closeNewTaskDialog, showToast } = useUIActions();
    const tabs = useBoardStore(state => state.tabs);
    const boards = useBoardStore(state => state.boards);
    const addTask = useBoardStore(state => state.addTask);

    if (!open) return null;

    return (
        <div className="new-task-overlay" onClick={closeNewTaskDialog}>
            <div
                className="new-task-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-task-title"
                onClick={e => e.stopPropagation()}
            >
                <h2 id="new-task-title">New task</h2>
                <TaskForm
                    initial={EMPTY_TASK_FORM}
                    availableTabs={tabs}
                    submitLabel="Create task"
                    onSubmit={values => {
                        const task = formValuesToTask(values);
                        addTask({ id: generateTaskId(), status: 'todo', boardId: boards[0]?.id, ...task });
                        showToast(`Created “${task.title}”`, 'success');
                        closeNewTaskDialog();
                    }}
                    onCancel={closeNewTaskDialog}
                />
            </div>
        </div>
    );
};

export default NewTaskDialog;
