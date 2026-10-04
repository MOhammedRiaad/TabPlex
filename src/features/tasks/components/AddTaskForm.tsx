import React, { useState } from 'react';
import { useBoardStore } from '../../../store/boardStore';
import { generateTaskId } from '../../../utils/idGenerator';
import TaskForm, { EMPTY_TASK_FORM, formValuesToTask } from './TaskForm';

import './AddTaskForm.css';

interface AddTaskFormProps {
    status?: 'todo' | 'doing' | 'done';
    boardId?: string;
    folderId?: string;
}

/** "+ Add Task" in a column: expands into the full task form */
const AddTaskForm: React.FC<AddTaskFormProps> = ({ status = 'todo', boardId, folderId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const tabs = useBoardStore(state => state.tabs);
    const addTask = useBoardStore(state => state.addTask);

    // In a folder, offer that folder's saved tabs; elsewhere all of them
    const availableTabs = folderId ? tabs.filter(tab => tab.folderId === folderId) : tabs;

    if (!isExpanded) {
        return (
            <button className="add-task-btn" onClick={() => setIsExpanded(true)}>
                + Add Task
            </button>
        );
    }

    return (
        <div className="add-task-form">
            <TaskForm
                initial={EMPTY_TASK_FORM}
                availableTabs={availableTabs}
                submitLabel="Add task"
                onSubmit={values => {
                    addTask({ id: generateTaskId(), status, boardId, folderId, ...formValuesToTask(values) });
                    setIsExpanded(false);
                }}
                onCancel={() => setIsExpanded(false)}
            />
        </div>
    );
};

export default AddTaskForm;
