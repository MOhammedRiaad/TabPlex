import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskForm, { EMPTY_TASK_FORM, TaskFormValues, formValuesToTask, taskToFormValues } from '../components/TaskForm';
import NewTaskDialog from '../components/NewTaskDialog';
import AddTaskForm from '../components/AddTaskForm';
import TaskCard from '../components/TaskCard';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { makeBoard, makeTab, makeTask } from '../../../test/factories';
import { respondToMessages } from '../../../test/chromeMock';

const tabs = [makeTab({ id: 't1', title: 'Spec doc' }), makeTab({ id: 't2', title: 'Pricing page' })];

function renderForm(initial: TaskFormValues = EMPTY_TASK_FORM) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
        <TaskForm initial={initial} availableTabs={tabs} submitLabel="Save" onSubmit={onSubmit} onCancel={onCancel} />
    );
    return { onSubmit, onCancel };
}

describe('TaskForm', () => {
    beforeEach(() => respondToMessages());

    it('has every field labelled: title, notes, priority, due date, checklist and linked tabs', () => {
        renderForm();
        expect(screen.getByLabelText('Title')).toHaveFocus();
        expect(screen.getByLabelText('Notes')).toBeInTheDocument();
        expect(screen.getByLabelText('Priority')).toHaveValue('medium');
        expect(screen.getByLabelText('Due date')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Checklist' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Linked tabs' })).toBeInTheDocument();
    });

    it('requires a title, and clears the error when typing', () => {
        const { onSubmit } = renderForm();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
        expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
        expect(screen.queryByRole('alert')).toBeNull();
        fireEvent.submit(screen.getByLabelText('Title').closest('form')!);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits every field', () => {
        const { onSubmit } = renderForm();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Plan launch' } });
        fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'For Q4' } });
        fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'high' } });
        fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-20' } });
        const item = screen.getByLabelText('New checklist item');
        fireEvent.change(item, { target: { value: 'Write copy' } });
        fireEvent.keyDown(item, { key: 'Enter' }); // adds the item, doesn't submit
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.change(item, { target: { value: '  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add item' })); // empty: ignored
        fireEvent.click(screen.getByLabelText('Pricing page'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const values = onSubmit.mock.calls[0][0] as TaskFormValues;
        expect(values).toMatchObject({
            title: 'Plan launch',
            description: 'For Q4',
            priority: 'high',
            dueDate: '2026-10-20',
            tabIds: ['t2'],
        });
        expect(values.checklist).toEqual([{ id: expect.any(String), text: 'Write copy', completed: false }]);
    });

    it('edits an existing checklist and links, and cancels with the button or Esc', () => {
        const { onSubmit, onCancel } = renderForm(
            taskToFormValues(
                makeTask({
                    tabIds: ['t1'],
                    checklist: [
                        { id: 'c1', text: 'One', completed: false },
                        { id: 'c2', text: 'Two', completed: false },
                    ],
                })
            )
        );
        fireEvent.click(screen.getByLabelText('Done: One'));
        fireEvent.click(screen.getByRole('button', { name: 'Remove Two' }));
        fireEvent.click(screen.getByLabelText('Spec doc')); // unlink
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            checklist: [{ id: 'c1', text: 'One', completed: true }],
            tabIds: [],
        });

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' });
        expect(onCancel).toHaveBeenCalledTimes(2);
    });

    it('hides linked tabs when there are none, and maps values to task fields', () => {
        render(
            <TaskForm
                initial={EMPTY_TASK_FORM}
                availableTabs={[]}
                submitLabel="Add"
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />
        );
        expect(screen.queryByRole('group', { name: 'Linked tabs' })).toBeNull();
        expect(formValuesToTask({ ...EMPTY_TASK_FORM, title: '  T  ', description: '  ' })).toEqual({
            title: 'T',
            description: undefined,
            dueDate: undefined,
            priority: 'medium',
            checklist: [],
            tabIds: [],
            tags: [],
        });
    });
});

describe('NewTaskDialog', () => {
    beforeEach(() => {
        respondToMessages();
        useBoardStore.setState({ tasks: [], tabs, boards: [makeBoard({ id: 'b1' })] });
        useUIStore.setState({ newTaskDialogOpen: false, toast: null });
    });

    it('renders nothing until opened, then creates a full task on the first board', () => {
        const { rerender } = render(<NewTaskDialog />);
        expect(screen.queryByRole('dialog')).toBeNull();
        useUIStore.getState().actions.openNewTaskDialog();
        rerender(<NewTaskDialog />);

        expect(screen.getByRole('dialog', { name: 'New task' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Ship v1.1 ' } });
        fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Release notes' } });
        fireEvent.change(screen.getByLabelText('New checklist item'), { target: { value: 'Tag' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
        fireEvent.click(screen.getByLabelText('Spec doc'));
        fireEvent.click(screen.getByRole('button', { name: 'Create task' }));

        const [task] = useBoardStore.getState().tasks;
        expect(task).toMatchObject({
            id: expect.stringMatching(/^task/),
            title: 'Ship v1.1',
            description: 'Release notes',
            status: 'todo',
            priority: 'medium',
            boardId: 'b1',
            tabIds: ['t1'],
        });
        expect(task.checklist!.map(i => i.text)).toEqual(['Tag']);
        expect(useUIStore.getState()).toMatchObject({
            newTaskDialogOpen: false,
            toast: { message: 'Created “Ship v1.1”', type: 'success' },
        });
    });

    it('closes from Cancel or the backdrop without creating anything', () => {
        useUIStore.setState({ newTaskDialogOpen: true });
        const { rerender } = render(<NewTaskDialog />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(useUIStore.getState().newTaskDialogOpen).toBe(false);

        useUIStore.setState({ newTaskDialogOpen: true });
        rerender(<NewTaskDialog />);
        fireEvent.click(document.querySelector('.new-task-overlay')!);
        expect(useUIStore.getState().newTaskDialogOpen).toBe(false);
        expect(useBoardStore.getState().tasks).toEqual([]);
    });
});

describe('AddTaskForm in a folder', () => {
    beforeEach(() => respondToMessages());

    it("offers only that folder's saved tabs and creates the task in the folder", () => {
        useBoardStore.setState({
            tasks: [],
            tabs: [makeTab({ id: 'a', title: 'In folder', folderId: 'f1' }), makeTab({ id: 'b', title: 'Elsewhere' })],
        });
        render(<AddTaskForm status="doing" boardId="b1" folderId="f1" />);
        fireEvent.click(screen.getByRole('button', { name: '+ Add Task' }));
        expect(screen.getByLabelText('In folder')).toBeInTheDocument();
        expect(screen.queryByLabelText('Elsewhere')).toBeNull();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Folder task' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
        expect(useBoardStore.getState().tasks[0]).toMatchObject({
            title: 'Folder task',
            status: 'doing',
            boardId: 'b1',
            folderId: 'f1',
        });
        expect(screen.getByRole('button', { name: '+ Add Task' })).toBeInTheDocument();
    });
});

describe('TaskCard editing (parity with create)', () => {
    beforeEach(() => respondToMessages());

    it('links and unlinks saved tabs, and refuses an empty title', () => {
        const t = makeTask({ tabIds: ['t1'] });
        useBoardStore.setState({ tasks: [t], tabs });
        render(<TaskCard task={t} />);
        fireEvent.click(screen.getByTitle('Edit task'));

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
        expect(useBoardStore.getState().tasks[0].title).toBe(t.title);

        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } });
        fireEvent.click(screen.getByLabelText('Spec doc'));
        fireEvent.click(screen.getByLabelText('Pricing page'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(useBoardStore.getState().tasks[0]).toMatchObject({ title: 'Renamed', tabIds: ['t2'] });
    });
});
