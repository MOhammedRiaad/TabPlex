// One topic of the Combined view (spec §9): a read-only heading, its bullets with a "(n)" chip for each source they
// cite, and a ⚠ row for each conflict. Chips open the source exactly like the Open button. Page text is rendered as text.
import React from 'react';
import { QUICK_VIEW_LABEL, combineNoteText, quickReasonText } from '../constants';
import { KeyPoint, NoteSource, Topic } from '../types';
import { hostOf } from '../utils/studyNote';
import { sourcesOf } from '../utils/groupTopics';
import './TopicCard.css';

interface TopicCardProps {
    topic: Topic;
    /** The points of the draft: bullets and conflicts name their points by id */
    points: KeyPoint[];
    /** The sources of the draft, for the chips */
    sources: NoteSource[];
    onOpen: (source: NoteSource) => void;
}

const titleOf = (source: NoteSource) => source.title || hostOf(source.url) || 'Untitled page';

const TopicCard: React.FC<TopicCardProps> = ({ topic, points, sources, onOpen }) => {
    const chipFor = (ref: number) => {
        const source = sources.find(item => item.ref === ref);
        if (!source) return null;
        const title = titleOf(source);
        return (
            <button
                key={ref}
                type="button"
                className="tabnotes-chip"
                onClick={() => onOpen(source)}
                aria-label={`Open source ${ref}: ${title}`}
            >
                ({ref})
            </button>
        );
    };

    const shared = topic.kind === 'shared';
    const soleSource = topic.kind === 'source' ? sources.find(item => item.ref === topic.sourceRef) : undefined;

    return (
        <section className="tabnotes-card tabnotes-topic" aria-label={topic.heading}>
            <div className="tabnotes-card-head">
                <h3 className="tabnotes-topic-title">{topic.heading}</h3>
                {shared && topic.combinedBy === 'ai' && <span className="tabnotes-tag">combined by AI</span>}
                {shared && topic.combinedBy === 'words' && (
                    <span className="tabnotes-tag">grouped by shared words (no AI)</span>
                )}
                {shared && topic.combinedBy === 'words' && topic.combineNote && (
                    <span className="tabnotes-muted">{combineNoteText(topic.combineNote)}</span>
                )}
                {soleSource?.mode === 'quick' && <span className="tabnotes-tag">{QUICK_VIEW_LABEL}</span>}
                {soleSource?.mode === 'quick' && soleSource.quickReason && (
                    <span className="tabnotes-muted" title={quickReasonText(soleSource.quickReason)}>
                        {quickReasonText(soleSource.quickReason)}
                    </span>
                )}
            </div>
            <ul className="tabnotes-topic-bullets">
                {topic.bullets.map(bullet => (
                    <li key={bullet.id} className="tabnotes-topic-bullet">
                        <span>{bullet.text}</span> {sourcesOf(bullet.pointIds, points).map(ref => chipFor(ref))}
                    </li>
                ))}
            </ul>
            {topic.conflicts.map((conflict, index) => {
                const parts = conflict.pointIds.flatMap(id => {
                    const point = points.find(item => item.id === id);
                    return point ? [point] : [];
                });
                return (
                    <p key={index} className="tabnotes-conflict">
                        <span aria-hidden="true">⚠ </span>
                        Sources differ:{' '}
                        {parts.map((point, position) => (
                            <span key={point.id}>
                                {position > 0 && '; '}&quot;{point.text}&quot; {chipFor(point.sourceRef)}
                            </span>
                        ))}
                    </p>
                );
            })}
        </section>
    );
};

export default TopicCard;
