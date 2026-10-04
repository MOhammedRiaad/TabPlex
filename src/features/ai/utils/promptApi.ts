// Wrapper around Chrome's built-in Prompt API (LanguageModel, Gemini Nano). Runs on the device: nothing is sent
// to a server. Desktop Chrome 138+ with hardware requirements, so callers must always have a non-AI path.
// Runs in the UI page only (user activation for the model download). See docs/specs/AI_FOUNDATION.md.
// https://developer.chrome.com/docs/ai/prompt-api
import { AI_FALLBACK_CHAR_BUDGET, AI_TIMEOUT_MS } from '../constants';
import { AiError, AiErrorCode, ModelAvailability } from '../types';

type ChromeAvailability = Exclude<ModelAvailability, 'unsupported'>;

interface PromptOptions {
    responseConstraint?: object;
    omitResponseConstraintInput?: boolean;
    signal?: AbortSignal;
}

/** The subset of a LanguageModel session we use. Context-size names changed across Chrome versions. */
export interface AiSession {
    prompt(input: string, options?: PromptOptions): Promise<string>;
    /** Current name of the context size (tokens) */
    readonly contextWindow?: number;
    /** Older name of the same value */
    readonly inputQuota?: number;
    measureContextUsage?(input: string, options?: PromptOptions): Promise<number>;
    measureInputUsage?(input: string, options?: PromptOptions): Promise<number>;
    destroy(): void;
}

interface LanguageModelCreateOptions {
    initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
    expectedInputs?: { type: 'text'; languages: string[] }[];
    expectedOutputs?: { type: 'text'; languages: string[] }[];
    monitor?: (monitor: EventTarget) => void;
}

interface LanguageModelStatic {
    availability(options?: Omit<LanguageModelCreateOptions, 'monitor' | 'initialPrompts'>): Promise<ChromeAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<AiSession>;
}

const BASE_OPTIONS = {
    expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
    expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
};

const RETRY_SUFFIX = '\n\nYour previous answer was not valid. Reply with JSON that matches the schema exactly.';

function getApi(): LanguageModelStatic | null {
    return (self as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel ?? null;
}

export function isAiError(error: unknown, code?: AiErrorCode): error is AiError {
    return error instanceof AiError && (code === undefined || error.code === code);
}

/** Never rejects: 'unsupported' without the API, 'unavailable' if the check itself fails */
export async function getModelAvailability(): Promise<ModelAvailability> {
    const api = getApi();
    if (!api) return 'unsupported';
    try {
        return await api.availability(BASE_OPTIONS);
    } catch {
        return 'unavailable';
    }
}

/**
 * Create a session. Call this synchronously inside a click/key handler, before any await: Chrome needs user
 * activation to start the model download, and the activation expires a few seconds after the event.
 */
export function createSession(
    systemPrompt: string,
    onDownloadProgress?: (fraction: number) => void
): Promise<AiSession> {
    const api = getApi();
    if (!api) return Promise.reject(new AiError('unsupported', "This browser doesn't have built-in AI"));
    return api
        .create({
            ...BASE_OPTIONS,
            initialPrompts: [{ role: 'system', content: systemPrompt }],
            monitor: monitor => {
                monitor.addEventListener('downloadprogress', event => {
                    onDownloadProgress?.((event as ProgressEvent).loaded);
                });
            },
        })
        .catch((error: unknown) => {
            throw new AiError(
                'download-failed',
                error instanceof Error ? error.message : 'Chrome could not start the on-device model'
            );
        });
}

/** Small models sometimes wrap JSON in a Markdown code fence even when constrained */
function stripFences(raw: string): string {
    return raw
        .trim()
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/, '')
        .trim();
}

export interface PromptJsonOptions<T> {
    /** JSON Schema passed to the model as responseConstraint */
    schema: object;
    /** Returns the cleaned value, or null if the parsed JSON is unusable */
    validate: (raw: unknown) => T | null;
    signal?: AbortSignal;
    timeoutMs?: number;
}

/**
 * Prompt for JSON matching `schema`, parse and validate it. Retries once on unusable output. Errors are
 * AiErrors: 'bad-output', 'timeout', 'aborted' or 'too-large'. Does not destroy the session (the caller owns it).
 */
export async function promptJson<T>(session: AiSession, input: string, options: PromptJsonOptions<T>): Promise<T> {
    const { schema, validate, signal, timeoutMs = AI_TIMEOUT_MS } = options;
    if (signal?.aborted) throw new AiError('aborted', 'Cancelled');

    const controller = new AbortController();
    let reason: 'timeout' | 'aborted' | null = null;
    const onAbort = () => {
        reason = 'aborted';
        controller.abort();
    };
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => {
        reason = 'timeout';
        controller.abort();
    }, timeoutMs);

    const attempt = async (text: string): Promise<T | null> => {
        const raw = await session.prompt(text, {
            responseConstraint: schema,
            omitResponseConstraintInput: true,
            signal: controller.signal,
        });
        try {
            return validate(JSON.parse(stripFences(raw)));
        } catch {
            return null; // not JSON
        }
    };

    try {
        const value = (await attempt(input)) ?? (await attempt(input + RETRY_SUFFIX));
        if (value === null) {
            throw new AiError('bad-output', 'The on-device model returned an answer TabPlex could not use');
        }
        return value;
    } catch (error) {
        if (isAiError(error)) throw error;
        if (reason === 'timeout') throw new AiError('timeout', 'The on-device model took too long');
        if (reason === 'aborted') throw new AiError('aborted', 'Cancelled');
        // Check by name: a DOMException isn't an Error instance in every environment
        const { name, message } = (error ?? {}) as { name?: unknown; message?: unknown };
        if (name === 'QuotaExceededError') throw new AiError('too-large', String(message ?? 'Too much input'));
        throw new AiError('bad-output', typeof message === 'string' ? message : String(error));
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
    }
}

/**
 * Keep the first N items (tab-strip order) whose prompt fits the session's context window, with 10% headroom
 * for the system prompt and the answer. Falls back to a character budget when the session can't measure.
 */
export async function fitInput<I>(
    session: AiSession,
    items: I[],
    build: (items: I[]) => string,
    minItems = 1
): Promise<{ input: string; used: number }> {
    const window = session.contextWindow ?? session.inputQuota;
    const measure = (session.measureContextUsage ?? session.measureInputUsage)?.bind(session);
    const canMeasure = typeof window === 'number' && window > 0 && measure !== undefined;

    const fits = async (n: number): Promise<boolean> => {
        const text = build(items.slice(0, n));
        if (canMeasure) return (await measure(text)) <= (window as number) * 0.9;
        return text.length <= AI_FALLBACK_CHAR_BUDGET;
    };

    const low = Math.min(minItems, items.length);
    if (await fits(items.length)) return { input: build(items), used: items.length };
    if (!(await fits(low))) throw new AiError('too-large', 'Too many tabs for the on-device model');

    // Largest n in [low, items.length) that fits
    let lo = low;
    let hi = items.length - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (await fits(mid)) lo = mid;
        else hi = mid - 1;
    }
    return { input: build(items.slice(0, lo)), used: lo };
}

const ERROR_TEXT: Record<AiErrorCode, string> = {
    unsupported: "This browser doesn't have Chrome's built-in AI (Chrome 138+ on desktop).",
    unavailable: "This device doesn't meet Chrome's requirements for built-in AI.",
    'download-failed': "Chrome couldn't download the on-device AI model. Try again later.",
    'too-large': 'Too many tabs for the on-device model. Close a few and try again.',
    'bad-output': "The on-device AI gave an answer TabPlex couldn't use. Try again.",
    timeout: 'The on-device AI took too long. Try again.',
    aborted: '', // the user cancelled: show nothing
};

/** User-facing text for any error from this module */
export function aiErrorMessage(error: unknown): string {
    if (isAiError(error)) return ERROR_TEXT[error.code];
    return error instanceof Error ? error.message : String(error);
}
