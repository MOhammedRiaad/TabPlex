import React, { useEffect, useRef, useState } from 'react';
import { useAiSettings } from '../../ai/hooks/useAiSettings';
import { useModelAvailability } from '../../ai/hooks/useModelAvailability';
import { SummaryAvailability } from '../../tasks/utils/aiSummary';
import {
    ACTION_LABELS,
    NOTE_AI_MIN_CHARS,
    NoteAiAction,
    canUseNoteAi,
    getNoteSummaryAvailability,
} from '../utils/aiNoteHelpers';
import './NoteAi.css';

interface NoteAiMenuProps {
    /** The note text the helpers would work on */
    text: string;
    /** Called synchronously in the click, so the model can be created with user activation */
    onStart: (action: NoteAiAction) => void;
}

const REWRITES: NoteAiAction[] = ['rewrite-shorter', 'rewrite-clearer', 'rewrite-formal'];
const REWRITE_LABELS: Record<string, string> = {
    'rewrite-shorter': 'Shorter',
    'rewrite-clearer': 'Clearer',
    'rewrite-formal': 'More formal',
};

/** ✨ AI in the note editor toolbar. Hidden (not disabled) when on-device AI can't run or the setting is off. */
const NoteAiMenu: React.FC<NoteAiMenuProps> = ({ text, onStart }) => {
    const { settings } = useAiSettings();
    const { availability } = useModelAvailability();
    const [summary, setSummary] = useState<SummaryAvailability>('unsupported');
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        let cancelled = false;
        getNoteSummaryAvailability().then(value => {
            if (!cancelled) setSummary(value);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!settings.noteHelpers || !canUseNoteAi(availability)) return null;

    const tooShort = text.trim().length < NOTE_AI_MIN_CHARS;
    const hint = tooShort ? 'Write a bit more first' : undefined;
    const canSummarize = summary === 'available' || summary === 'downloadable' || summary === 'downloading';

    const item = (action: NoteAiAction, label = ACTION_LABELS[action]) => (
        <li role="none" key={action}>
            <button
                type="button"
                role="menuitem"
                disabled={tooShort}
                title={hint}
                onClick={() => {
                    setOpen(false);
                    onStart(action);
                }}
            >
                {label}
            </button>
        </li>
    );

    return (
        <div className="note-ai-menu" ref={rootRef}>
            <button
                ref={buttonRef}
                type="button"
                className="toolbar-btn note-ai-btn"
                aria-haspopup="menu"
                aria-expanded={open}
                title="On-device AI helpers"
                onClick={() => setOpen(value => !value)}
            >
                ✨ AI
            </button>
            {open && (
                <ul className="note-ai-menu-list" role="menu" aria-label="AI helpers">
                    {tooShort && (
                        <li role="none" className="note-ai-menu-hint">
                            {hint}
                        </li>
                    )}
                    {canSummarize && item('summarize')}
                    {item('actions')}
                    {item('proofread')}
                    <li role="none" className="note-ai-menu-group">
                        Rewrite
                    </li>
                    {REWRITES.map(action => item(action, REWRITE_LABELS[action]))}
                </ul>
            )}
        </div>
    );
};

export default NoteAiMenu;
