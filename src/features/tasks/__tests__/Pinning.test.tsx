import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import TaskCard from '../components/TaskCard';
import TasksList from '../components/TasksList';
import NoteCard from '../../notes/components/NoteCard';
import NotesList from '../../notes/components/NotesList';
import TodayNotes from '../../today/components/TodayNotes';
import TodayTasks from '../../today/components/TodayTasks';
import { useBoardStore } from '../../../store/boardStore';
import { respondToMessages, flushPromises } from '../../../test/chromeMock';
import { makeNote, makeTask } from '../../../test/factories';

const cardTitles = () => [...document.querySelectorAll('.task-title')].map(e => e.textContent);

describe('Pinning (docs/specs/PINNING.md)', () => {
    let received: { type: string; payload: { id: string; pinned?: boolean } }[];

    beforeEach(() => {
        received = respondToMessages();
        useBoardStore.setState({ tasks: [], notes: [], tabs: [] });
    });

    it('pins and unpins a task from its card, saved and synced like any edit', async () => {
        const task = makeTask();
        useBoardStore.setState({ tasks: [task] });
        const { rerender } = render(<TaskCard task={task} />);
        const pin = screen.getByRole('button', { name: 'Pin task' });
        expect(pin).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(pin);
        expect(useBoardStore.getState().tasks[0].pinned).toBe(true);
        await flushPromises();
        expect(received.find(m => m.type === 'UPDATE_TASK')!.payload).toMatchObject({ id: task.id, pinned: true });

        rerender(<TaskCard task={useBoardStore.getState().tasks[0]} />);
        expect(document.querySelector('.task-card')).toHaveClass('is-pinned');
        fireEvent.click(screen.getByRole('button', { name: 'Unpin task' }));
        expect(useBoardStore.getState().tasks[0].pinned).toBe(false);
    });

    it('pins and unpins a note from its card', () => {
        const note = makeNote();
        useBoardStore.setState({ notes: [note] });
        const { rerender } = render(<NoteCard note={note} />);
        fireEvent.click(screen.getByRole('button', { name: 'Pin note' }));
        expect(useBoardStore.getState().notes[0].pinned).toBe(true);
        rerender(<NoteCard note={useBoardStore.getState().notes[0]} />);
        const unpin = screen.getByRole('button', { name: 'Unpin note' });
        expect(unpin).toHaveAttribute('aria-pressed', 'true');
        expect(document.querySelector('.note-card')).toHaveClass('is-pinned');
        fireEvent.click(unpin);
        expect(useBoardStore.getState().notes[0].pinned).toBe(false);
    });

    it('shows pinned tasks first in each Tasks column', () => {
        render(
            <MemoryRouter>
                <TasksList
                    todoTasks={[
                        makeTask({ id: 'a', title: 'First' }),
                        makeTask({ id: 'b', title: 'Pinned todo', pinned: true }),
                    ]}
                    doingTasks={[makeTask({ id: 'c', title: 'Doing', status: 'doing' })]}
                    doneTasks={[
                        makeTask({ id: 'd', title: 'Done one', status: 'done' }),
                        makeTask({ id: 'e', title: 'Pinned done', status: 'done', pinned: true }),
                    ]}
                />
            </MemoryRouter>
        );
        expect(cardTitles()).toEqual(['Pinned todo', 'First', 'Doing', 'Pinned done', 'Done one']);
    });

    it("keeps a pinned task on Today even when it's beyond the first three", () => {
        const todo = [1, 2, 3, 4].map(i => makeTask({ id: `t${i}`, title: `Task ${i}`, pinned: i === 4 }));
        render(
            <MemoryRouter>
                <TodayTasks
                    todoTasks={todo}
                    doingTasks={[]}
                    doneTasks={[]}
                    showAllTasks={false}
                    onToggleShowAll={() => undefined}
                    dateFilter="all"
                    onDateFilterChange={() => undefined}
                    priorityFilter="all"
                    onPriorityFilterChange={() => undefined}
                />
            </MemoryRouter>
        );
        expect(cardTitles()).toEqual(['Task 4', 'Task 1', 'Task 2']);
    });

    it('shows pinned notes first, on Today too even when older than the six newest', () => {
        const notes = Array.from({ length: 7 }, (_, i) =>
            makeNote({
                id: `n${i}`,
                title: `Note ${i}`,
                content: `Note ${i}`,
                createdAt: `2026-10-0${i + 1}T09:00:00`,
                pinned: i === 0, // the oldest
            })
        );
        const { unmount } = render(
            <MemoryRouter>
                <TodayNotes notes={notes} />
            </MemoryRouter>
        );
        const shown = () => [...document.querySelectorAll('.note-markdown')].map(e => e.textContent);
        expect(shown()).toEqual(['Note 0', 'Note 6', 'Note 5', 'Note 4', 'Note 3', 'Note 2']);
        unmount();

        render(<NotesList notes={[notes[3], notes[0]]} viewMode="list" />);
        expect(shown()).toEqual(['Note 0', 'Note 3']);
    });
});
