import React, { useEffect, useState } from 'react';
import ModelStatus from '../../ai/components/ModelStatus';
import { isAiError } from '../../ai/utils/promptApi';
import { parseMarkdown } from '../../ui/components/MarkdownEditor';
import {
    ACTION_LABELS,
    ActionItem,
    NoteAiAction,
    NoteAiResult,
    NoteHelper,
    PROGRESS_LABELS,
    noteAiErrorMessage,
} from '../utils/aiNoteHelpers';
import './NoteAi.css';

interface NoteAiDialogProps {
    action: NoteAiAction;
    /** Started in the click that opened the dialog; the parent releases it when the dialog closes */
    helper: NoteHelper;
    text: string;
    /** Titles of existing tasks, so "Action items" doesn't suggest them again */
    existingTaskTitles: string[];
    /** 0..1 while Chrome downloads the model */
    progress: number | null;
    onRetry: () => void;
    onReplace: (text: string) => void;
    onInsertSummary: (summary: string) => void;
    onCreateTasks: (items: ActionItem[]) => void;
    onClose: () => void;
}

/** Runs one note helper, then previews the result; nothing changes until the user applies it */
const NoteAiDialog: React.FC<NoteAiDialogProps> = ({
    action,
    helper,
    text,
    existingTaskTitles,
    progress,
    onRetry,
    onReplace,
    onInsertSummary,
    onCreateTasks,
    onClose,
}) => {
    const [result, setResult] = useState<NoteAiResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<boolean[]>([]);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Only aborts: React may run this effect twice (StrictMode) with the same helper
        const controller = new AbortController();
        setResult(null);
        setError(null);
        helper
            .run(text, controller.signal, existingTaskTitles)
            .then(value => {
                if (controller.signal.aborted) return;
                setResult(value);
                if (value.kind === 'tasks') setSelected(value.items.map(() => true));
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted || isAiError(err, 'aborted')) return;
                setError(noteAiErrorMessage(err));
            });
        return () => controller.abort();
        // A new run only for a new helper (Try again); the text is fixed while the dialog is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [helper]);

    const title = ACTION_LABELS[action];
    const chosen = result?.kind === 'tasks' ? result.items.filter((_, i) => selected[i]) : [];

    return (
        <div className="note-ai-overlay" onClick={onClose}>
            <div
                className="note-ai-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.key === 'Escape' && onClose()}
            >
                <h2>✨ {title}</h2>

                {!result && !error && (
                    <div className="note-ai-busy" aria-live="polite">
                        <p>{PROGRESS_LABELS[action]}</p>
                        {progress !== null && <ModelStatus availability="downloading" progress={progress} />}
                    </div>
                )}

                {error && (
                    <div className="note-ai-error" role="alert">
                        <p>{error}</p>
                    </div>
                )}

                {result?.kind === 'summary' && (
                    <div
                        className="note-ai-preview markdown-preview"
                        // parseMarkdown escapes HTML first, so the model's text can't add markup
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(result.text) }}
                    />
                )}

                {result?.kind === 'text' && (
                    <div className="note-ai-compare">
                        <section>
                            <h3>Before</h3>
                            <pre className="note-ai-text">{text}</pre>
                        </section>
                        <section>
                            <h3>After</h3>
                            <pre className="note-ai-text">{result.text}</pre>
                        </section>
                    </div>
                )}

                {result?.kind === 'tasks' &&
                    (result.items.length === 0 ? (
                        <p>No to-dos found in this note.</p>
                    ) : (
                        <ul className="note-ai-tasks">
                            {result.items.map((item, index) => (
                                <li key={item.title}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={selected[index] ?? false}
                                            onChange={e =>
                                                setSelected(prev =>
                                                    prev.map((value, i) => (i === index ? e.target.checked : value))
                                                )
                                            }
                                        />
                                        {item.title}
                                        {item.priority !== 'medium' && (
                                            <span className={`note-ai-priority ${item.priority}`}>{item.priority}</span>
                                        )}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ))}

                <div className="note-ai-actions">
                    {error && (
                        <button type="button" className="primary" onClick={onRetry}>
                            Try again
                        </button>
                    )}
                    {result?.kind === 'summary' && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard
                                        ?.writeText(result.text)
                                        .then(() => setCopied(true))
                                        .catch(() => undefined);
                                }}
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                            <button type="button" className="primary" onClick={() => onInsertSummary(result.text)}>
                                Insert at top
                            </button>
                        </>
                    )}
                    {result?.kind === 'text' && (
                        <button type="button" className="primary" onClick={() => onReplace(result.text)}>
                            Replace
                        </button>
                    )}
                    {result?.kind === 'tasks' && result.items.length > 0 && (
                        <button
                            type="button"
                            className="primary"
                            disabled={chosen.length === 0}
                            onClick={() => onCreateTasks(chosen)}
                        >
                            Create {chosen.length} {chosen.length === 1 ? 'task' : 'tasks'}
                        </button>
                    )}
                    <button type="button" onClick={onClose} autoFocus>
                        {result?.kind === 'text' ? 'Discard' : result ? 'Close' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NoteAiDialog;
