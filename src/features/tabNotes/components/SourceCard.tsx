// Step 4 of the dialog: one card per source that was read. The title is plain text (never a link); the points are
// editable, and removing a point or the source only changes what the note will contain (spec §9).
import React from 'react';
import { KeyPoint, NoteSource } from '../types';
import { NO_POINTS_LINE, QUICK_VIEW_LABEL } from '../constants';
import { hostOf } from '../utils/studyNote';

interface SourceCardProps {
    source: NoteSource;
    /** The points of this source as they will be written (edits applied) */
    points: KeyPoint[];
    onEdit: (pointId: string, text: string) => void;
    onRemovePoint: (pointId: string) => void;
    onRemoveSource: (ref: number) => void;
    onOpen: (source: NoteSource) => void;
}

const SourceCard: React.FC<SourceCardProps> = ({ source, points, onEdit, onRemovePoint, onRemoveSource, onOpen }) => {
    const host = hostOf(source.url);
    const title = source.title || host || 'Untitled page';
    return (
        <section className="tabnotes-card" aria-label={`Source ${source.ref}: ${title}`}>
            <div className="tabnotes-card-head">
                <h3 className="tabnotes-card-title">
                    <span className="tabnotes-ref">[{source.ref}]</span>
                    <span>{title}</span>
                </h3>
                {host && <span className="tabnotes-host">{host}</span>}
                {source.mode === 'quick' && <span className="tabnotes-tag">{QUICK_VIEW_LABEL}</span>}
                <span className="tabnotes-card-actions">
                    <button
                        type="button"
                        className="tabnotes-btn"
                        onClick={() => onOpen(source)}
                        aria-label={`Open ${title}`}
                    >
                        Open
                    </button>
                    <button
                        type="button"
                        className="tabnotes-btn"
                        onClick={() => onRemoveSource(source.ref)}
                        aria-label={`Remove ${title} from the note`}
                    >
                        Remove source
                    </button>
                </span>
            </div>
            {points.length === 0 ? (
                <p className="tabnotes-muted">{NO_POINTS_LINE}</p>
            ) : (
                <ul className="tabnotes-points">
                    {points.map((point, index) => (
                        <li key={point.id} className="tabnotes-point">
                            <textarea
                                className="tabnotes-point-text"
                                value={point.text}
                                rows={2}
                                onChange={e => onEdit(point.id, e.target.value)}
                                aria-label={`Point ${index + 1} of ${title}`}
                            />
                            <button
                                type="button"
                                className="tabnotes-btn tabnotes-icon-btn"
                                onClick={() => onRemovePoint(point.id)}
                                aria-label={`Remove point ${index + 1} of ${title}`}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

export default SourceCard;
