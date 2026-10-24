import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopicCard from '../TopicCard';
import { KeyPoint, NoteSource, Topic } from '../../types';

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

describe('TopicCard', () => {
    it('labels a topic combined by the AI', () => {
        render(<TopicCard topic={sharedTopic('ai')} points={points} sources={[alpha, beta]} onOpen={vi.fn()} />);
        expect(screen.getByText('combined by AI')).toBeInTheDocument();
        expect(screen.queryByText('grouped by shared words (no AI)')).toBeNull();
    });

    it('labels a topic grouped by shared words, without AI', () => {
        render(<TopicCard topic={sharedTopic('words')} points={points} sources={[alpha, beta]} onOpen={vi.fn()} />);
        expect(screen.getByText('grouped by shared words (no AI)')).toBeInTheDocument();
        expect(screen.queryByText('combined by AI')).toBeNull();
    });

    it('cites each source of a bullet with a chip, from the points it is made of', () => {
        render(<TopicCard topic={sharedTopic('ai')} points={points} sources={[alpha, beta]} onOpen={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Open source 1: First page' })).toHaveTextContent('(1)');
        expect(screen.getByRole('button', { name: 'Open source 2: Second page' })).toHaveTextContent('(2)');
    });

    it('opens the source of a chip', () => {
        const onOpen = vi.fn();
        render(<TopicCard topic={sharedTopic('ai')} points={points} sources={[alpha, beta]} onOpen={onOpen} />);
        fireEvent.click(screen.getByRole('button', { name: 'Open source 2: Second page' }));
        expect(onOpen).toHaveBeenCalledWith(beta);
    });

    it('shows no combining label on a section of one source', () => {
        const section: Topic = {
            id: 't2',
            heading: 'First page',
            kind: 'source',
            sourceRef: 1,
            combinedBy: null,
            bullets: [{ id: 'b2', text: 'Only here.', pointIds: ['p1-1'], origin: 'point', edited: false }],
            conflicts: [],
        };
        render(<TopicCard topic={section} points={points} sources={[alpha, beta]} onOpen={vi.fn()} />);
        expect(screen.queryByText('combined by AI')).toBeNull();
        expect(screen.queryByText('grouped by shared words (no AI)')).toBeNull();
    });

    it.each([
        ['timeout', 'the model took too long'],
        ['too-large', 'too many points for the model'],
        ['unusable', "the model's answer was unusable"],
    ] as const)('says why a topic stayed word grouping: %s', (note, text) => {
        const grouped: Topic = { ...sharedTopic('words'), combineNote: note };
        render(<TopicCard topic={grouped} points={points} sources={[alpha, beta]} onOpen={vi.fn()} />);
        expect(screen.getByText('grouped by shared words (no AI)')).toBeInTheDocument();
        expect(screen.getByText(text)).toBeInTheDocument();
    });

    it('shows no reason for a topic that was combined by the AI', () => {
        const combined: Topic = { ...sharedTopic('ai'), combineNote: 'timeout' };
        render(<TopicCard topic={combined} points={points} sources={[alpha, beta]} onOpen={vi.fn()} />);
        expect(screen.queryByText('the model took too long')).toBeNull();
    });

    it('renders page and model text as text, never as markup', () => {
        render(
            <TopicCard
                topic={sharedTopic('ai', '<img src=x onerror=alert(1)> **bold**')}
                points={points}
                sources={[alpha, beta]}
                onOpen={vi.fn()}
            />
        );
        expect(screen.getByText('<img src=x onerror=alert(1)> **bold**')).toBeInTheDocument();
        expect(document.querySelector('img')).toBeNull();
    });
});
