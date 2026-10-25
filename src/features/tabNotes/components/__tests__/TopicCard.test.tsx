import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TopicCard, { TopicEdits } from '../TopicCard';
import { KeyPoint, NoteSource, Topic } from '../../types';
import { noEdits } from './helpers';

const alpha: NoteSource = {
    ref: 1,
    tabId: 1,
    windowId: 1,
    title: 'First page',
    url: 'https://example.com/a',
    mode: 'ai',
    truncated: false,
    notEnglish: false,
};
const beta: NoteSource = { ...alpha, ref: 2, tabId: 2, title: 'Second page', url: 'https://example.org/b' };
const points: KeyPoint[] = [
    { id: 'p1-1', sourceRef: 1, text: 'Resolvers keep answers.', topicHint: '' },
    { id: 'p2-1', sourceRef: 2, text: 'Resolvers keep answers for the TTL.', topicHint: '' },
    { id: 'p1-2', sourceRef: 1, text: 'Negative answers are cached too.', topicHint: '' },
];

/** One shared topic whose bullet cites both pages */
const sharedTopic = (combinedBy: 'ai' | 'words', text = 'Resolvers keep answers.'): Topic => ({
    id: 't1',
    heading: 'DNS caching',
    kind: 'shared',
    combinedBy,
    bullets: [
        {
            id: 'b1',
            text,
            pointIds: ['p1-1', 'p2-1'],
            origin: combinedBy === 'ai' ? 'ai' : 'point',
            edited: false,
        },
    ],
    conflicts: [],
});

/** A shared topic with two bullets (one of them edited) and a conflict, for the edit controls */
const busyTopic = (): Topic => ({
    id: 't1',
    heading: 'DNS caching',
    kind: 'shared',
    combinedBy: 'words',
    bullets: [
        { id: 'b1', text: 'Resolvers keep answers.', pointIds: ['p1-1', 'p2-1'], origin: 'point', edited: false },
        { id: 'b2', text: 'Negative answers are cached.', pointIds: ['p1-2'], origin: 'point', edited: true },
    ],
    conflicts: [{ pointIds: ['p1-1', 'p2-1'], text: '' }],
});

const other: Topic = {
    id: 't2',
    heading: 'Inheritance',
    kind: 'shared',
    combinedBy: 'ai',
    bullets: [{ id: 'b3', text: 'Subclasses inherit.', pointIds: ['p1-2'], origin: 'ai', edited: false }],
    conflicts: [],
};

const sectionOf = (ref: number): Topic => ({
    id: 't3',
    heading: 'Second page',
    kind: 'source',
    sourceRef: ref,
    combinedBy: null,
    bullets: [{ id: 'b4', text: 'Only here.', pointIds: ['p2-1'], origin: 'point', edited: false }],
    conflicts: [],
});

/** Renders one topic of a Combined list with the given edits */
function renderTopic(topic: Topic, edits: TopicEdits = noEdits(), topics: Topic[] = [topic], editable = true) {
    return render(
        <TopicCard
            topic={topic}
            topicIndex={0}
            topics={topics}
            points={points}
            sources={[alpha, beta]}
            editable={editable}
            onOpen={vi.fn()}
            edits={edits}
        />
    );
}

describe('TopicCard', () => {
    it('labels a topic combined by the AI', () => {
        renderTopic(sharedTopic('ai'));
        expect(screen.getByText('combined by AI')).toBeInTheDocument();
        expect(screen.queryByText('grouped by shared words (no AI)')).toBeNull();
    });

    it('labels a topic grouped by shared words, without AI', () => {
        renderTopic(sharedTopic('words'));
        expect(screen.getByText('grouped by shared words (no AI)')).toBeInTheDocument();
        expect(screen.queryByText('combined by AI')).toBeNull();
    });

    it('cites each source of a bullet with a chip, from the points it is made of', () => {
        renderTopic(sharedTopic('ai'));
        expect(screen.getByRole('button', { name: 'Open source 1: First page' })).toHaveTextContent('(1)');
        expect(screen.getByRole('button', { name: 'Open source 2: Second page' })).toHaveTextContent('(2)');
    });

    it('opens the source of a chip', () => {
        const onOpen = vi.fn();
        render(
            <TopicCard
                topic={sharedTopic('ai')}
                topicIndex={0}
                topics={[sharedTopic('ai')]}
                points={points}
                sources={[alpha, beta]}
                editable
                onOpen={onOpen}
                edits={noEdits()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Open source 2: Second page' }));
        expect(onOpen).toHaveBeenCalledWith(beta);
    });

    it('shows no combining label on a section of one source', () => {
        renderTopic({
            id: 't2',
            heading: 'First page',
            kind: 'source',
            sourceRef: 1,
            combinedBy: null,
            bullets: [{ id: 'b2', text: 'Only here.', pointIds: ['p1-1'], origin: 'point', edited: false }],
            conflicts: [],
        });
        expect(screen.queryByText('combined by AI')).toBeNull();
        expect(screen.queryByText('grouped by shared words (no AI)')).toBeNull();
    });

    it.each([
        ['timeout', 'the model took too long'],
        ['too-large', 'too many points for the model'],
        ['unusable', "the model's answer was unusable"],
    ] as const)('says why a topic stayed word grouping: %s', (note, text) => {
        renderTopic({ ...sharedTopic('words'), combineNote: note });
        expect(screen.getByText('grouped by shared words (no AI)')).toBeInTheDocument();
        expect(screen.getByText(text)).toBeInTheDocument();
    });

    it('shows no reason for a topic that was combined by the AI', () => {
        renderTopic({ ...sharedTopic('ai'), combineNote: 'timeout' });
        expect(screen.queryByText('the model took too long')).toBeNull();
    });

    it('renders page and model text as text, never as markup', () => {
        renderTopic(sharedTopic('ai', '<img src=x onerror=alert(1)> **bold**'));
        expect(screen.getByText('<img src=x onerror=alert(1)> **bold**')).toBeInTheDocument();
        expect(document.querySelector('img')).toBeNull();
    });

    it('marks an edited bullet with an edited tag', () => {
        renderTopic(busyTopic());
        expect(screen.getByText('edited')).toBeInTheDocument();
        expect(screen.getAllByText('edited')).toHaveLength(1);
    });

    describe('renaming the topic', () => {
        it('commits the heading on blur', async () => {
            const edits = noEdits();
            renderTopic(sharedTopic('ai'), edits);
            const input = screen.getByRole('textbox', { name: 'Topic heading' });
            await userEvent.clear(input);
            await userEvent.type(input, 'Caching of answers');
            await userEvent.tab();
            expect(edits.rename).toHaveBeenCalledWith('t1', 'Caching of answers');
        });

        it('commits on Enter and keeps the typed text when nothing changed', async () => {
            const edits = noEdits();
            renderTopic(sharedTopic('ai'), edits);
            const input = screen.getByRole('textbox', { name: 'Topic heading' });
            await userEvent.type(input, '{Enter}');
            expect(edits.rename).not.toHaveBeenCalled();
            expect(input).toHaveValue('DNS caching');
        });

        it('puts the old heading back when the new one cleans to nothing', async () => {
            const edits = noEdits();
            renderTopic(sharedTopic('ai'), edits);
            const input = screen.getByRole('textbox', { name: 'Topic heading' });
            await userEvent.clear(input);
            await userEvent.type(input, '**');
            await userEvent.tab();
            expect(edits.rename).not.toHaveBeenCalled();
            expect(input).toHaveValue('DNS caching');
        });

        it('is read only while a run is going', () => {
            renderTopic(sharedTopic('ai'), noEdits(), undefined, false);
            expect(screen.getByRole('textbox', { name: 'Topic heading' })).toBeDisabled();
            expect(screen.queryByRole('button', { name: 'Separate by source' })).toBeNull();
        });
    });

    describe('editing a bullet', () => {
        it('opens a textarea with the text, saves the new text and leaves the editor', async () => {
            const edits = noEdits();
            renderTopic(busyTopic(), edits);
            await userEvent.click(screen.getAllByRole('button', { name: /^Edit bullet 1 of/ })[0]);
            const area = screen.getByRole('textbox', { name: 'Text of bullet 1 of DNS caching' });
            expect(area).toHaveValue('Resolvers keep answers.');
            await userEvent.clear(area);
            await userEvent.type(area, 'Resolvers keep each answer.');
            await userEvent.click(screen.getByRole('button', { name: 'Save' }));
            expect(edits.editBullet).toHaveBeenCalledWith('b1', 'Resolvers keep each answer.');
            expect(screen.queryByRole('textbox', { name: 'Text of bullet 1 of DNS caching' })).toBeNull();
        });

        it('cancels without saving and returns the focus to the Edit button', async () => {
            const edits = noEdits();
            renderTopic(busyTopic(), edits);
            await userEvent.click(screen.getAllByRole('button', { name: /^Edit bullet 1 of/ })[0]);
            await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(edits.editBullet).not.toHaveBeenCalled();
            expect(screen.getAllByRole('button', { name: /^Edit bullet 1 of/ })[0]).toHaveFocus();
        });

        it('does not allow saving an empty bullet', async () => {
            renderTopic(busyTopic());
            await userEvent.click(screen.getAllByRole('button', { name: /^Edit bullet 1 of/ })[0]);
            await userEvent.clear(screen.getByRole('textbox', { name: 'Text of bullet 1 of DNS caching' }));
            expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        });
    });

    describe('removing', () => {
        it('removes a bullet, a conflict and the topic', async () => {
            const edits = noEdits();
            renderTopic(busyTopic(), edits);
            await userEvent.click(screen.getByRole('button', { name: 'Remove bullet 2 of DNS caching' }));
            expect(edits.removeBullet).toHaveBeenCalledWith('b2');

            await userEvent.click(screen.getByRole('button', { name: 'Remove conflict 1 of DNS caching' }));
            expect(edits.removeConflict).toHaveBeenCalledWith('t1', 0);

            await userEvent.click(screen.getByRole('button', { name: 'Remove topic DNS caching' }));
            expect(edits.removeTopic).toHaveBeenCalledWith('t1');
        });

        it('separates a shared topic by source', async () => {
            const edits = noEdits();
            renderTopic(busyTopic(), edits);
            await userEvent.click(screen.getByRole('button', { name: 'Separate by source' }));
            expect(edits.separate).toHaveBeenCalledWith('t1');
        });

        it('a source section has bullet removal but no move, separate or topic removal', () => {
            renderTopic(sectionOf(1), noEdits());
            expect(screen.getByRole('button', { name: 'Remove bullet 1 of Second page' })).toBeInTheDocument();
            expect(screen.queryByRole('combobox', { name: 'Move bullet to' })).toBeNull();
            expect(screen.queryByRole('button', { name: 'Separate by source' })).toBeNull();
            expect(screen.queryByRole('button', { name: 'Remove topic Second page' })).toBeNull();
        });
    });

    describe('moving a bullet', () => {
        it('moves a bullet to another shared topic, chosen with the keyboard-friendly select', async () => {
            const edits = noEdits();
            renderTopic(busyTopic(), edits, [busyTopic(), other]);
            const select = screen.getAllByRole('combobox', { name: 'Move bullet to' })[0];
            select.focus();
            expect(select).toHaveFocus();
            await userEvent.selectOptions(select, 'Inheritance');
            expect(edits.moveBullet).toHaveBeenCalledWith('b1', 't2');
        });

        it('moves a bullet to Own section', async () => {
            const edits = noEdits();
            renderTopic(busyTopic(), edits, [busyTopic(), other]);
            await userEvent.selectOptions(
                screen.getAllByRole('combobox', { name: 'Move bullet to' })[0],
                'Own section'
            );
            expect(edits.moveBullet).toHaveBeenCalledWith('b1', 'own');
        });

        it('lists the other shared topics, not this one, and the placeholder is not a target', () => {
            renderTopic(busyTopic(), noEdits(), [busyTopic(), other]);
            const select = screen.getAllByRole('combobox', { name: 'Move bullet to' })[0];
            const options = within(select)
                .getAllByRole('option')
                .map(option => option.textContent);
            expect(options).toEqual(['Move to…', 'Own section', 'Inheritance']);
        });
    });

    it('shows read-only bullets with no controls while a run is going', () => {
        renderTopic(busyTopic(), noEdits(), undefined, false);
        expect(screen.queryByRole('button', { name: /^Edit bullet/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Remove bullet/ })).toBeNull();
        expect(screen.queryByRole('combobox', { name: 'Move bullet to' })).toBeNull();
    });
});

describe('TopicCard with incomplete data', () => {
    const renderWith = (topic: Topic, sources: NoteSource[], edits: TopicEdits = noEdits(), pointList = points) =>
        render(
            <TopicCard
                topic={topic}
                topicIndex={0}
                topics={[topic]}
                points={pointList}
                sources={sources}
                editable
                onOpen={vi.fn()}
                edits={edits}
            />
        );

    it('names a source without a title by its host, or as an untitled page', () => {
        const noTitle: NoteSource = { ...alpha, title: '' };
        const noTitleNoHost: NoteSource = { ...beta, title: '', url: 'not a url' };

        renderWith(sharedTopic('words'), [noTitle, noTitleNoHost]);

        expect(screen.getByRole('button', { name: 'Open source 1: example.com' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open source 2: Untitled page' })).toBeInTheDocument();
    });

    it('shows no chip for a point whose source is not in the note', () => {
        renderWith(sharedTopic('words'), [alpha]);

        expect(screen.getByRole('button', { name: 'Open source 1: First page' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Open source 2/ })).toBeNull();
    });

    it('shows two bullets made of the same points', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const topic = sharedTopic('words');
        topic.bullets.push({ ...topic.bullets[0], id: 'b9', text: 'The same points, worded again.' });

        renderWith(topic, [alpha, beta]);

        expect(screen.getByText('Resolvers keep answers.')).toBeInTheDocument();
        expect(screen.getByText('The same points, worded again.')).toBeInTheDocument();
        expect(error).not.toHaveBeenCalled();
    });

    it('does not move a bullet when the placeholder option is chosen again', () => {
        const edits = noEdits();
        renderWith(busyTopic(), [alpha, beta], edits);

        fireEvent.change(screen.getAllByRole('combobox', { name: 'Move bullet to' })[0], { target: { value: '' } });

        expect(edits.moveBullet).not.toHaveBeenCalled();
    });

    it('quotes only the points of a conflict that still exist', () => {
        const topic: Topic = { ...busyTopic(), conflicts: [{ pointIds: ['p1-1', 'ghost'], text: '' }] };

        renderWith(topic, [alpha, beta]);

        const conflict = document.querySelector('.tabnotes-conflict') as HTMLElement;
        expect(conflict).toHaveTextContent('"Resolvers keep answers."');
        expect(conflict).not.toHaveTextContent('ghost');
    });
});
