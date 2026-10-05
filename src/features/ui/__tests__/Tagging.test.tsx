import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TagInput, { TagList } from '../components/TagInput';
import TaskForm, { EMPTY_TASK_FORM } from '../../tasks/components/TaskForm';
import TaskCard from '../../tasks/components/TaskCard';
import TasksView from '../../tasks/TasksView';
import NoteCard from '../../notes/components/NoteCard';
import NotesView from '../../notes/NotesView';
import BoardModal from '../../boards/components/BoardModal';
import { useBoardStore } from '../../../store/boardStore';
import { respondToMessages } from '../../../test/chromeMock';
import { makeNote, makeTab, makeTask } from '../../../test/factories';
import { MAX_TAGS } from '../../../utils/tags';

/** TagInput with its own state, like a form uses it */
function Harness({ initial = [] as string[], suggestions = [] as string[] }) {
    const [tags, setTags] = useState(initial);
    return (
        <>
            <TagInput tags={tags} onChange={setTags} suggestions={suggestions} />
            <output data-testid="tags">{tags.join('|')}</output>
        </>
    );
}

const tagsValue = () => screen.getByTestId('tags').textContent;
// With suggestions the input is a combobox (it has a `list`), so find it by its label
const input = () => screen.getByLabelText('Add tag');

describe('TagInput', () => {
    it('adds with Enter, comma and blur, and removes with × or Backspace', () => {
        render(<Harness />);
        fireEvent.change(input(), { target: { value: '#Research' } });
        fireEvent.keyDown(input(), { key: 'Enter' });
        expect(tagsValue()).toBe('research');

        fireEvent.change(input(), { target: { value: 'q4, design,' } });
        expect(tagsValue()).toBe('research|q4|design');
        expect(input()).toHaveValue('');

        fireEvent.change(input(), { target: { value: 'later' } });
        fireEvent.blur(input());
        expect(tagsValue()).toBe('research|q4|design|later');

        fireEvent.click(screen.getByRole('button', { name: 'Remove tag q4' }));
        fireEvent.keyDown(input(), { key: 'Backspace' });
        expect(tagsValue()).toBe('research|design');
        fireEvent.change(input(), { target: { value: 'x' } });
        fireEvent.keyDown(input(), { key: 'Backspace' }); // with text: keeps the tags
        expect(tagsValue()).toBe('research|design');
    });

    it('suggests tags in use that are not set yet, and stops at the limit', () => {
        render(<Harness initial={['q4']} suggestions={['q4', 'web']} />);
        expect(input()).toHaveAttribute('list');
        expect([...document.querySelectorAll('datalist option')].map(o => o.getAttribute('value'))).toEqual(['web']);

        const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`);
        render(<TagInput tags={full} onChange={vi.fn()} />);
        expect(screen.getAllByLabelText('Add tag')).toHaveLength(1); // only the first harness
    });

    it('TagList renders chips, or nothing', () => {
        const { container } = render(<TagList tags={[]} />);
        expect(container).toBeEmptyDOMElement();
        render(<TagList tags={['a', 'b']} />);
        expect(within(screen.getByRole('list', { name: 'Tags' })).getAllByRole('listitem')).toHaveLength(2);
    });
});

describe('Tags on tasks, notes and tabs', () => {
    beforeEach(() => {
        respondToMessages();
        useBoardStore.setState({ tasks: [], notes: [], tabs: [], boards: [], folders: [] });
    });

    it('the task form submits tags, and the card shows them', () => {
        const onSubmit = vi.fn();
        render(
            <TaskForm
                initial={EMPTY_TASK_FORM}
                availableTabs={[]}
                submitLabel="Save"
                onSubmit={onSubmit}
                onCancel={vi.fn()}
            />
        );
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Tagged' } });
        fireEvent.change(input(), { target: { value: 'q4, web' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSubmit.mock.calls[0][0].tags).toEqual(['q4', 'web']);

        const card = render(<TaskCard task={makeTask({ title: 'Card', tags: ['q4'] })} />);
        expect(within(card.container).getByText('#q4')).toBeInTheDocument();
    });

    it('filters the Tasks view by tag, and search matches tags', () => {
        useBoardStore.setState({
            tasks: [
                makeTask({ id: 'a', title: 'Alpha', tags: ['q4'] }),
                makeTask({ id: 'b', title: 'Beta', tags: ['web'] }),
                makeTask({ id: 'c', title: 'Gamma' }),
            ],
        });
        render(
            <MemoryRouter>
                <TasksView />
            </MemoryRouter>
        );
        const titles = () => [...document.querySelectorAll('.task-title')].map(e => e.textContent);
        const filter = screen.getByLabelText('Tag:');
        expect([...filter.querySelectorAll('option')].map(o => o.textContent)).toEqual([
            'All tags',
            '#q4 (1)',
            '#web (1)',
        ]);
        fireEvent.change(filter, { target: { value: 'web' } });
        expect(titles()).toEqual(['Beta']);
        fireEvent.change(filter, { target: { value: '' } });
        fireEvent.change(screen.getByPlaceholderText(/Search tasks/), { target: { value: 'q4' } });
        expect(titles()).toEqual(['Alpha']);
    });

    it('the note editor saves tags; the Notes view filters by them', () => {
        const note = makeNote({ id: 'n1', content: 'Plan', tags: ['old'] });
        useBoardStore.setState({ notes: [note, makeNote({ id: 'n2', title: 'Other', content: 'Other' })] });
        const { unmount } = render(<NoteCard note={note} />);
        expect(screen.getByText('#old')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove tag old' }));
        fireEvent.change(input(), { target: { value: 'launch' } });
        fireEvent.keyDown(input(), { key: 'Enter' });
        fireEvent.click(screen.getByText('Save'));
        expect(useBoardStore.getState().notes[0].tags).toEqual(['launch']);
        unmount();

        render(
            <MemoryRouter>
                <NotesView />
            </MemoryRouter>
        );
        fireEvent.change(screen.getByLabelText('Tag:'), { target: { value: 'launch' } });
        expect(document.querySelectorAll('.note-card')).toHaveLength(1);
        expect(screen.getByText(/Showing 1 of 2/)).toBeInTheDocument();
    });

    it('cancelling a note edit drops tag changes', () => {
        const note = makeNote({ tags: ['keep'] });
        useBoardStore.setState({ notes: [note] });
        render(<NoteCard note={note} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove tag keep' }));
        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.getByText('#keep')).toBeInTheDocument();
        expect(useBoardStore.getState().notes[0].tags).toEqual(['keep']);
    });

    it('the tab dialog creates and edits tags', () => {
        useBoardStore.setState({ tabs: [makeTab({ tags: ['docs'] })] });
        const onSubmit = vi.fn();
        const { rerender } = render(
            <BoardModal isOpen onClose={vi.fn()} mode="create" type="tab" folders={[]} onSubmit={onSubmit} />
        );
        const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
        fireEvent.change(byId('board-tab-title'), { target: { value: 'Spec' } });
        fireEvent.change(byId('board-tab-url'), { target: { value: 'example.com' } });
        fireEvent.change(input(), { target: { value: 'docs' } });
        fireEvent.keyDown(input(), { key: 'Enter' });
        fireEvent.submit(byId('board-tab-title').closest('form')!);
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Spec', tags: ['docs'] }));

        const tab = makeTab({ id: 't9', tags: ['a', 'b'] });
        rerender(
            <BoardModal isOpen onClose={vi.fn()} mode="edit" type="tab" tab={tab} folders={[]} onSubmit={onSubmit} />
        );
        expect(screen.getByRole('button', { name: 'Remove tag a' })).toBeInTheDocument();
    });
});
