// One topic of the Combined view (spec §9): an editable heading, its bullets with a "(n)" chip for each source they cite,
// and a ⚠ row for each conflict. Bullets can be edited, moved to another shared topic (or to the own sections) and
// removed; a shared topic can be separated by source or removed. Chips open the source exactly like the Open button.
// Page text and model text are rendered as text. Every change goes through `edits` (the dialog applies it to the store).
import React, { useEffect, useRef, useState } from 'react';
import { QUICK_VIEW_LABEL, combineNoteText, quickReasonText } from '../constants';
import { KeyPoint, NoteSource, Topic, TopicBullet } from '../types';
import { hostOf } from '../utils/studyNote';
import { cleanHeadingText, sourcesOf } from '../utils/groupTopics';
import { moveTargets } from '../utils/topicEdits';
import './TopicCard.css';

/** The edits of the Combined view, by id. The dialog applies them to the store and keeps the focus where it belongs. */
export interface TopicEdits {
    rename(topicId: string, heading: string): void;
    editBullet(bulletId: string, text: string): void;
    removeBullet(bulletId: string): void;
    removeConflict(topicId: string, index: number): void;
    /** The id of another shared topic, or 'own' for the bullet's sources' sections */
    moveBullet(bulletId: string, target: string): void;
    separate(topicId: string): void;
    removeTopic(topicId: string): void;
}

interface TopicCardProps {
    topic: Topic;
    /** Position in the Combined list (the dialog uses it to return focus after an action) */
    topicIndex: number;
    /** Every topic of the Combined view: the targets of "Move to" */
    topics: Topic[];
    /** The points of the draft: bullets and conflicts name their points by id */
    points: KeyPoint[];
    /** The sources of the draft, for the chips */
    sources: NoteSource[];
    /** False while a run is going: the topic is shown read only */
    editable: boolean;
    onOpen: (source: NoteSource) => void;
    edits: TopicEdits;
}

const titleOf = (source: NoteSource) => source.title || hostOf(source.url) || 'Untitled page';

const chipFor = (ref: number, sources: NoteSource[], onOpen: (source: NoteSource) => void) => {
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

/**
 * React keys for the bullets of a topic: the ids of the points a bullet is made of, which survive renumbering (bullet ids
 * do not). A suffix keeps two bullets with the same points apart.
 */
function keysOf(bullets: TopicBullet[]): string[] {
    const seen = new Map<string, number>();
    return bullets.map(bullet => {
        const base = bullet.pointIds.join('|');
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        return count === 0 ? base : `${base}#${count}`;
    });
}

/** The heading of a topic as an input, committed on blur or Enter. A heading that cleans to nothing is put back. */
const HeadingField: React.FC<{ topic: Topic; editable: boolean; onRename: (heading: string) => void }> = ({
    topic,
    editable,
    onRename,
}) => {
    const [text, setText] = useState(topic.heading);
    const [shown, setShown] = useState(topic.heading);
    // The text follows the heading when it changes from outside (an AI step, a removal, a rename that was cleaned)
    if (shown !== topic.heading) {
        setShown(topic.heading);
        setText(topic.heading);
    }
    const commit = () => {
        const clean = cleanHeadingText(text);
        if (clean !== '' && clean !== topic.heading) onRename(text);
        // Shows the heading the store kept (a cleaned one, or the old one when the new text cleaned to nothing)
        setText(topic.heading);
    };
    return (
        <input
            type="text"
            className="tabnotes-topic-input"
            data-topic-heading=""
            aria-label="Topic heading"
            value={text}
            maxLength={200}
            disabled={!editable}
            onChange={e => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                }
            }}
        />
    );
};

interface BulletRowProps {
    bullet: TopicBullet;
    /** 0-based position in the topic */
    index: number;
    topic: Topic;
    /** The shared topics a bullet can move to (none for a bullet of a source section) */
    targets: Topic[];
    points: KeyPoint[];
    sources: NoteSource[];
    editable: boolean;
    onOpen: (source: NoteSource) => void;
    edits: TopicEdits;
}

/** One bullet: its text and chips, or the editor (textarea, Save, Cancel) while it is being edited */
const BulletRow: React.FC<BulletRowProps> = ({
    bullet,
    index,
    topic,
    targets,
    points,
    sources,
    editable,
    onOpen,
    edits,
}) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(bullet.text);
    const editButton = useRef<HTMLButtonElement>(null);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const wasEditing = useRef(false);

    // Focus follows the editor: into the textarea when it opens, back to the Edit button when it closes
    useEffect(() => {
        if (editing) {
            wasEditing.current = true;
            textarea.current?.focus();
        } else if (wasEditing.current) {
            wasEditing.current = false;
            editButton.current?.focus();
        }
    }, [editing]);

    const startEditing = () => {
        setDraft(bullet.text);
        setEditing(true);
    };
    const save = () => {
        edits.editBullet(bullet.id, draft);
        setEditing(false);
    };
    const refs = sourcesOf(bullet.pointIds, points);
    const position = `${index + 1} of ${topic.heading}`;

    if (editing) {
        return (
            <li className="tabnotes-topic-bullet" data-bullet-index={index}>
                <div className="tabnotes-bullet-edit">
                    <textarea
                        ref={textarea}
                        className="tabnotes-point-text"
                        aria-label={`Text of bullet ${position}`}
                        value={draft}
                        rows={2}
                        onChange={e => setDraft(e.target.value)}
                    />
                    <span className="tabnotes-card-actions">
                        <button type="button" className="tabnotes-btn" disabled={draft.trim() === ''} onClick={save}>
                            Save
                        </button>
                        <button type="button" className="tabnotes-btn" onClick={() => setEditing(false)}>
                            Cancel
                        </button>
                    </span>
                </div>
            </li>
        );
    }

    return (
        <li className="tabnotes-topic-bullet" data-bullet-index={index}>
            <div className="tabnotes-bullet-row">
                <span className="tabnotes-bullet-text">{bullet.text}</span>
                {refs.map(ref => chipFor(ref, sources, onOpen))}
                {bullet.edited && <span className="tabnotes-tag">edited</span>}
                {editable && (
                    <span className="tabnotes-card-actions">
                        <button
                            ref={editButton}
                            type="button"
                            className="tabnotes-btn"
                            data-bullet-edit=""
                            onClick={startEditing}
                            aria-label={`Edit bullet ${position}`}
                        >
                            Edit
                        </button>
                        {topic.kind === 'shared' && (
                            <select
                                className="tabnotes-move"
                                value=""
                                aria-label="Move bullet to"
                                onChange={e => {
                                    if (e.target.value !== '') edits.moveBullet(bullet.id, e.target.value);
                                }}
                            >
                                <option value="" disabled>
                                    Move to…
                                </option>
                                <option value="own">Own section</option>
                                {targets.map(target => (
                                    <option key={target.id} value={target.id}>
                                        {target.heading}
                                    </option>
                                ))}
                            </select>
                        )}
                        <button
                            type="button"
                            className="tabnotes-btn tabnotes-icon-btn"
                            onClick={() => edits.removeBullet(bullet.id)}
                            aria-label={`Remove bullet ${position}`}
                        >
                            ✕
                        </button>
                    </span>
                )}
            </div>
        </li>
    );
};

const TopicCard: React.FC<TopicCardProps> = ({
    topic,
    topicIndex,
    topics,
    points,
    sources,
    editable,
    onOpen,
    edits,
}) => {
    const shared = topic.kind === 'shared';
    const soleSource = topic.kind === 'source' ? sources.find(item => item.ref === topic.sourceRef) : undefined;
    const keys = keysOf(topic.bullets);

    return (
        <section className="tabnotes-card tabnotes-topic" aria-label={topic.heading} data-topic-index={topicIndex}>
            <div className="tabnotes-card-head">
                <HeadingField topic={topic} editable={editable} onRename={heading => edits.rename(topic.id, heading)} />
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
                {shared && editable && (
                    <span className="tabnotes-card-actions">
                        <button type="button" className="tabnotes-btn" onClick={() => edits.separate(topic.id)}>
                            Separate by source
                        </button>
                        <button
                            type="button"
                            className="tabnotes-btn tabnotes-icon-btn"
                            onClick={() => edits.removeTopic(topic.id)}
                            aria-label={`Remove topic ${topic.heading}`}
                        >
                            ✕
                        </button>
                    </span>
                )}
            </div>
            <ul className="tabnotes-topic-bullets">
                {topic.bullets.map((bullet, index) => (
                    <BulletRow
                        key={keys[index]}
                        bullet={bullet}
                        index={index}
                        topic={topic}
                        targets={shared ? moveTargets(topics, bullet.id) : []}
                        points={points}
                        sources={sources}
                        editable={editable}
                        onOpen={onOpen}
                        edits={edits}
                    />
                ))}
            </ul>
            {topic.conflicts.map((conflict, index) => {
                const parts = conflict.pointIds.flatMap(id => {
                    const point = points.find(item => item.id === id);
                    return point ? [point] : [];
                });
                return (
                    <div key={index} className="tabnotes-conflict-row">
                        <p className="tabnotes-conflict">
                            <span aria-hidden="true">⚠ </span>
                            Sources differ:{' '}
                            {parts.map((point, position) => (
                                <span key={point.id}>
                                    {position > 0 && '; '}&quot;{point.text}&quot;{' '}
                                    {chipFor(point.sourceRef, sources, onOpen)}
                                </span>
                            ))}
                        </p>
                        {editable && (
                            <button
                                type="button"
                                className="tabnotes-btn tabnotes-icon-btn"
                                onClick={() => edits.removeConflict(topic.id, index)}
                                aria-label={`Remove conflict ${index + 1} of ${topic.heading}`}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                );
            })}
        </section>
    );
};

export default TopicCard;
