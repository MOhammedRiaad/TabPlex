import React, { useId, useState } from 'react';
import { Tab, Task } from '../../../types';
import { generateId } from '../../../utils/idGenerator';
import { validateRequiredText } from '../../../utils/formValidation';
import './TaskForm.css';

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 2000;
export const CHECKLIST_ITEM_MAX = 200;

/** The fields a user can set on a task, the same when creating and editing */
export interface TaskFormValues {
    title: string;
    description: string;
    dueDate: string;
    priority: Task['priority'];
    checklist: NonNullable<Task['checklist']>;
    tabIds: string[];
}

export const EMPTY_TASK_FORM: TaskFormValues = {
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    checklist: [],
    tabIds: [],
};

export const taskToFormValues = (task: Task): TaskFormValues => ({
    title: task.title,
    description: task.description ?? '',
    dueDate: task.dueDate ?? '',
    priority: task.priority,
    checklist: task.checklist ?? [],
    tabIds: task.tabIds ?? [],
});

/** The form values as task fields: trimmed, with empty optional fields left out */
export const formValuesToTask = (values: TaskFormValues) => ({
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    dueDate: values.dueDate || undefined,
    priority: values.priority,
    checklist: values.checklist,
    tabIds: values.tabIds,
});

interface TaskFormProps {
    initial: TaskFormValues;
    /** Saved tabs that can be linked to the task */
    availableTabs: Tab[];
    submitLabel: string;
    onSubmit: (values: TaskFormValues) => void;
    onCancel: () => void;
    className?: string;
}

/** Create and edit form for a task: title, notes, priority, due date, checklist and linked tabs */
const TaskForm: React.FC<TaskFormProps> = ({ initial, availableTabs, submitLabel, onSubmit, onCancel, className }) => {
    const id = useId();
    const [values, setValues] = useState<TaskFormValues>(initial);
    const [newItem, setNewItem] = useState('');
    const [error, setError] = useState<string>();

    const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
        setValues(prev => ({ ...prev, [key]: value }));

    const addItem = () => {
        const text = newItem.trim();
        if (!text) return;
        set('checklist', [...values.checklist, { id: generateId(), text, completed: false }]);
        setNewItem('');
    };

    const toggleTab = (tabId: string) =>
        set(
            'tabIds',
            values.tabIds.includes(tabId) ? values.tabIds.filter(t => t !== tabId) : [...values.tabIds, tabId]
        );

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const problem = validateRequiredText(values.title, 'Title', TASK_TITLE_MAX);
        if (problem) {
            setError(problem);
            return;
        }
        onSubmit(values);
    };

    return (
        <form
            className={`task-form ${className ?? ''}`}
            onSubmit={submit}
            onKeyDown={e => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    onCancel();
                }
            }}
            noValidate
        >
            <label className="task-form-field" htmlFor={`${id}-title`}>
                <span>Title</span>
                <input
                    id={`${id}-title`}
                    type="text"
                    value={values.title}
                    maxLength={TASK_TITLE_MAX}
                    onChange={e => {
                        set('title', e.target.value);
                        setError(undefined);
                    }}
                    placeholder="Task title"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    autoFocus
                />
            </label>
            {error && (
                <p id={`${id}-error`} className="task-form-error" role="alert">
                    {error}
                </p>
            )}

            <label className="task-form-field" htmlFor={`${id}-description`}>
                <span>Notes</span>
                <textarea
                    id={`${id}-description`}
                    value={values.description}
                    maxLength={TASK_DESCRIPTION_MAX}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Description"
                    rows={3}
                />
            </label>

            <div className="task-form-row">
                <label className="task-form-field" htmlFor={`${id}-priority`}>
                    <span>Priority</span>
                    <select
                        id={`${id}-priority`}
                        value={values.priority}
                        onChange={e => set('priority', e.target.value as Task['priority'])}
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </label>
                <label className="task-form-field" htmlFor={`${id}-due`}>
                    <span>Due date</span>
                    <input
                        id={`${id}-due`}
                        type="date"
                        value={values.dueDate}
                        onChange={e => set('dueDate', e.target.value)}
                    />
                </label>
            </div>

            <fieldset className="task-form-checklist">
                <legend>Checklist</legend>
                {values.checklist.length > 0 && (
                    <ul>
                        {values.checklist.map(item => (
                            <li key={item.id}>
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() =>
                                        set(
                                            'checklist',
                                            values.checklist.map(i =>
                                                i.id === item.id ? { ...i, completed: !i.completed } : i
                                            )
                                        )
                                    }
                                    aria-label={`Done: ${item.text}`}
                                />
                                <span>{item.text}</span>
                                <button
                                    type="button"
                                    className="task-form-remove"
                                    onClick={() =>
                                        set(
                                            'checklist',
                                            values.checklist.filter(i => i.id !== item.id)
                                        )
                                    }
                                    aria-label={`Remove ${item.text}`}
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="task-form-add-item">
                    <input
                        type="text"
                        value={newItem}
                        maxLength={CHECKLIST_ITEM_MAX}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // add the item, don't submit the form
                                addItem();
                            }
                        }}
                        placeholder="Add item..."
                        aria-label="New checklist item"
                    />
                    <button type="button" onClick={addItem}>
                        Add item
                    </button>
                </div>
            </fieldset>

            {availableTabs.length > 0 && (
                <fieldset className="task-form-tabs">
                    <legend>Linked tabs</legend>
                    <div className="task-form-tab-list">
                        {availableTabs.map(tab => (
                            <label key={tab.id}>
                                <input
                                    type="checkbox"
                                    checked={values.tabIds.includes(tab.id)}
                                    onChange={() => toggleTab(tab.id)}
                                />
                                <span>{tab.title}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            <div className="task-form-actions">
                <button type="button" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="task-form-submit">
                    {submitLabel}
                </button>
            </div>
        </form>
    );
};

export default TaskForm;
