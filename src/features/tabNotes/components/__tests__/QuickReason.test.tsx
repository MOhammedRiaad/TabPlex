import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SourceCard from '../SourceCard';
import SourceList from '../SourceList';
import TopicCard from '../TopicCard';
import { KeyPoint, NoteSource, Topic } from '../../types';
import { noEdits } from './helpers';

const source = (overrides: Partial<NoteSource> = {}): NoteSource => ({
    ref: 1,
    tabId: 10,
    windowId: 1,
    title: 'Long page',
    url: 'https://example.com/long',
    mode: 'quick',
    truncated: false,
    notEnglish: false,
    ...overrides,
});

const handlers = () => ({ onOpen: vi.fn(), onRemoveSource: vi.fn(), removable: true });

describe('quick view reason', () => {
    it('shows the reason next to the quick view tag in the Sources list', () => {
        render(<SourceList sources={[source({ quickReason: 'too-large' })]} {...handlers()} />);
        const row = screen.getByText('quick view').closest('li') as HTMLElement;
        expect(within(row).getByText('page too long for the model')).toHaveAttribute(
            'title',
            'page too long for the model'
        );
    });

    it('shows the reason on a source card, and nothing when the quick view was chosen', () => {
        const point: KeyPoint = { id: 'p1-1', sourceRef: 1, text: 'A point of the page.', topicHint: '' };
        const common = { points: [point], onEdit: vi.fn(), onRemovePoint: vi.fn(), ...handlers() };
        const { unmount } = render(<SourceCard source={source({ quickReason: 'timeout' })} {...common} />);
        expect(screen.getByText('quick view')).toBeInTheDocument();
        expect(screen.getByText('the model took too long')).toBeInTheDocument();
        unmount();

        render(<SourceCard source={source()} {...common} />);
        expect(screen.getByText('quick view')).toBeInTheDocument();
        expect(screen.queryByText(/the model/)).not.toBeInTheDocument();
    });

    it('shows the reason on a topic card whose only source is a quick view', () => {
        const topic: Topic = {
            id: 't1',
            heading: 'Caching',
            kind: 'source',
            sourceRef: 1,
            combinedBy: null,
            bullets: [],
            conflicts: [],
        };
        render(
            <TopicCard
                topic={topic}
                topicIndex={0}
                topics={[topic]}
                points={[]}
                sources={[source({ quickReason: 'bad-output' })]}
                editable
                onOpen={vi.fn()}
                edits={noEdits()}
            />
        );
        expect(screen.getByText('quick view')).toBeInTheDocument();
        expect(screen.getByText("the model's answer was unusable")).toBeInTheDocument();
    });
});
