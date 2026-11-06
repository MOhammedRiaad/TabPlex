// The Sources of the Combined review (spec §9): one line per source that the note will cite, with Open and Remove source.
// The By tab review shows the same actions on each source card instead.
import React from 'react';
import { QUICK_VIEW_LABEL, quickReasonText } from '../constants';
import { NoteSource } from '../types';
import { hostOf } from '../utils/studyNote';

interface SourceListProps {
    sources: NoteSource[];
    onOpen: (source: NoteSource) => void;
    onRemoveSource: (ref: number) => void;
    /** False while a run is going: the sources can be opened but not removed */
    removable: boolean;
}

const SourceList: React.FC<SourceListProps> = ({ sources, onOpen, onRemoveSource, removable }) => (
    <section className="tabnotes-section" aria-label="Sources">
        <h3>Sources</h3>
        <ul className="tabnotes-list">
            {sources.map((source, index) => {
                const host = hostOf(source.url);
                const title = source.title || host || 'Untitled page';
                return (
                    <li key={source.ref} className="tabnotes-list-item" data-source-index={index}>
                        <span className="tabnotes-ref">[{source.ref}]</span>
                        <span className="tabnotes-pick-title">{title}</span>
                        {host && <span className="tabnotes-host">{host}</span>}
                        {source.mode === 'quick' && <span className="tabnotes-tag">{QUICK_VIEW_LABEL}</span>}
                        {source.mode === 'quick' && source.quickReason && (
                            <span className="tabnotes-muted" title={quickReasonText(source.quickReason)}>
                                {quickReasonText(source.quickReason)}
                            </span>
                        )}
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
                                data-source-remove=""
                                disabled={!removable}
                                onClick={() => onRemoveSource(source.ref)}
                                aria-label={`Remove ${title} from the note`}
                            >
                                Remove source
                            </button>
                        </span>
                    </li>
                );
            })}
        </ul>
    </section>
);

export default SourceList;
