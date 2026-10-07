// ✨ AI note helpers (docs/specs/AI_NOTE_HELPERS.md): summarize, action items → tasks, proofread and rewrite a note
// with Chrome's built-in AI, on the device. Every result is previewed; nothing changes until the user applies it.
import {
    AiSession,
    aiErrorMessage,
    createSession,
    fitInput,
    isAiError,
    promptJson,
    promptText,
} from '../../ai/utils/promptApi';
import { AiError, ModelAvailability } from '../../ai/types';
import {
    SummarizerCreateOptions,
    SummarizerInstance,
    createSummarizer,
    getSummaryAvailability,
} from '../../tasks/utils/aiSummary';
import { cleanLine } from '../../taskDraft/utils/aiDraft';
import { Task } from '../../../types';

export type RewriteStyle = 'shorter' | 'clearer' | 'formal';
export type NoteAiAction = 'summarize' | 'actions' | 'proofread' | `rewrite-${RewriteStyle}`;

export interface ActionItem {
    title: string;
    priority: Task['priority'];
}

export type NoteAiResult =
    | { kind: 'summary'; text: string }
    | { kind: 'tasks'; items: ActionItem[] }
    | { kind: 'text'; text: string };

/** Fewer characters than this and the helpers have nothing to work with */
export const NOTE_AI_MIN_CHARS = 20;
const TASK_TITLE_MAX = 200;
const SUMMARY_INPUT_MAX = 6000;
/** A rewrite longer than this many times the note is a runaway answer */
const MAX_GROWTH = 3;

export const ACTION_LABELS: Record<NoteAiAction, string> = {
    summarize: 'Summarize',
    actions: 'Action items → tasks',
    proofread: 'Proofread',
    'rewrite-shorter': 'Rewrite: shorter',
    'rewrite-clearer': 'Rewrite: clearer',
    'rewrite-formal': 'Rewrite: more formal',
};

export const PROGRESS_LABELS: Record<NoteAiAction, string> = {
    summarize: 'Summarizing on your device…',
    actions: 'Finding to-dos on your device…',
    proofread: 'Proofreading on your device…',
    'rewrite-shorter': 'Rewriting on your device…',
    'rewrite-clearer': 'Rewriting on your device…',
    'rewrite-formal': 'Rewriting on your device…',
};

export const PROOFREAD_SYSTEM =
    "Fix spelling, grammar and punctuation in the user's Markdown note. Keep the meaning, wording, Markdown " +
    'structure, links and code exactly unless they are wrong. Reply with the corrected note only.';

const STYLE_WORDS: Record<RewriteStyle, string> = { shorter: 'shorter', clearer: 'clearer', formal: 'more formal' };

export const rewriteSystem = (style: RewriteStyle) =>
    `Rewrite the user's Markdown note to be ${STYLE_WORDS[style]}. Keep all facts, links, code and Markdown ` +
    'structure. Reply with the rewritten note only.';

export const ACTIONS_SYSTEM = [
    'List the concrete to-dos in the note as tasks. Only things someone has to do; skip facts and ideas.',
    'Each title is a short imperative phrase. Answer only with JSON that matches the schema.',
].join('\n');

// No maxLength on strings (Chrome's built-in AI guidance): titles are cut on the client
export const ACTIONS_SCHEMA = {
    type: 'object',
    properties: {
        tasks: {
            type: 'array',
            maxItems: 10,
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string', minLength: 3 },
                    priority: { enum: ['low', 'medium', 'high'] },
                },
                required: ['title'],
            },
        },
    },
    required: ['tasks'],
};

export const NOTE_SUMMARY_OPTIONS: SummarizerCreateOptions = {
    type: 'key-points',
    format: 'markdown',
    length: 'short',
    expectedInputLanguages: ['en'],
    outputLanguage: 'en',
    sharedContext: "A person's own note. Summarize its key points for them.",
};

/** Tasks from the model's answer: clean, cut, no duplicates, none already on the board */
export function normalizeActions(raw: unknown, existingTitles: string[] = []): ActionItem[] | null {
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { tasks?: unknown }).tasks)) return null;
    const seen = new Set(existingTitles.map(title => title.trim().toLowerCase()));
    const items: ActionItem[] = [];
    for (const entry of (raw as { tasks: unknown[] }).tasks) {
        if (!entry || typeof entry !== 'object') continue;
        const { title, priority } = entry as { title?: unknown; priority?: unknown };
        const clean = cleanLine(String(title ?? ''))
            .slice(0, TASK_TITLE_MAX)
            .trim();
        const key = clean.toLowerCase();
        if (clean.length < 3 || seen.has(key)) continue;
        seen.add(key);
        items.push({
            title: clean,
            priority: priority === 'low' || priority === 'high' ? priority : 'medium',
        });
    }
    return items;
}

/** A rewritten or proofread note: unwrap one Markdown fence; empty or runaway answers are errors */
export function cleanRewrite(raw: string, input: string): string {
    const text = raw
        .trim()
        .replace(/^```(?:markdown|md)?[ \t]*\n([\s\S]*?)\n?```$/i, '$1')
        .trim();
    if (!text || text.length > Math.max(input.length, 200) * MAX_GROWTH) {
        throw new AiError('bad-output', 'The on-device model returned an unusable rewrite');
    }
    return text;
}

/** The note with a "## Summary" section at the top */
export function insertSummary(content: string, summary: string): string {
    return `## Summary\n\n${summary.trim()}\n\n${content.replace(/^\s+/, '')}`;
}

/** Text for errors in the note dialog ("too-large" means the note, not tabs) */
export function noteAiErrorMessage(error: unknown): string {
    if (isAiError(error, 'too-large')) return 'This note is too long for the on-device AI. Try it on a shorter note.';
    if (error instanceof Error && !isAiError(error) && /Summarizer/.test(error.message)) {
        return "This browser doesn't have Chrome's built-in summarizer.";
    }
    return aiErrorMessage(error);
}

export const canUseNoteAi = (availability: ModelAvailability) =>
    availability === 'available' || availability === 'downloadable' || availability === 'downloading';

/** Whether "Summarize" can run (the Summarizer is a separate API from the Prompt API) */
export const getNoteSummaryAvailability = () => getSummaryAvailability(NOTE_SUMMARY_OPTIONS);

export interface NoteHelper {
    run(text: string, signal: AbortSignal, existingTaskTitles?: string[]): Promise<NoteAiResult>;
    /** Free the model's memory; safe to call more than once */
    release(): void;
}

const systemFor = (action: Exclude<NoteAiAction, 'summarize'>) =>
    action === 'actions' ? ACTIONS_SYSTEM : action === 'proofread' ? PROOFREAD_SYSTEM : rewriteSystem(styleOf(action));

const styleOf = (action: NoteAiAction) => action.replace('rewrite-', '') as RewriteStyle;

/**
 * Start a helper. Call it synchronously in the click: creating the session or summarizer needs user activation
 * (it may start the model download). The returned helper owns the model and must be released.
 */
export function startNoteHelper(action: NoteAiAction, onDownloadProgress?: (fraction: number) => void): NoteHelper {
    let released = false;

    if (action === 'summarize') {
        const summarizer: Promise<SummarizerInstance> = createSummarizer(onDownloadProgress, NOTE_SUMMARY_OPTIONS);
        summarizer.catch(() => undefined); // surfaces in run()
        return {
            async run(text, signal) {
                const instance = await summarizer;
                if (signal.aborted) throw new AiError('aborted', 'Cancelled');
                const input = text.length > SUMMARY_INPUT_MAX ? `${text.slice(0, SUMMARY_INPUT_MAX)}…` : text;
                const summary = (await instance.summarize(input, { signal })).trim();
                if (signal.aborted) throw new AiError('aborted', 'Cancelled');
                if (!summary) throw new AiError('bad-output', 'The summarizer returned nothing');
                return { kind: 'summary', text: summary };
            },
            release() {
                if (released) return;
                released = true;
                summarizer.then(instance => instance.destroy?.()).catch(() => undefined);
            },
        };
    }

    const session: Promise<AiSession> = createSession(systemFor(action), onDownloadProgress);
    session.catch(() => undefined); // surfaces in run()
    return {
        async run(text, signal, existingTaskTitles = []) {
            const ready = await session;
            // The whole note or nothing: a rewrite of half a note would drop the rest on Replace
            const { input } = await fitInput(ready, [text], ([note]) => note);
            if (action === 'actions') {
                const items = await promptJson(ready, input, {
                    schema: ACTIONS_SCHEMA,
                    validate: raw => normalizeActions(raw, existingTaskTitles),
                    signal,
                });
                return { kind: 'tasks', items };
            }
            return { kind: 'text', text: cleanRewrite(await promptText(ready, input, { signal }), text) };
        },
        release() {
            if (released) return;
            released = true;
            session.then(ready => ready.destroy()).catch(() => undefined);
        },
    };
}
