// On-device summaries of a parked context with Chrome's built-in Summarizer API (Gemini Nano).
// Runs locally: nothing is sent to a server. Chrome 138+, desktop only, with hardware requirements —
// always feature-detect and treat the summary as optional. https://developer.chrome.com/docs/ai/summarizer-api
import { ContextTab, Task } from '../../../types';
import { describeTabForAi } from '../../ai/utils/tabText';

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface SummarizerCreateOptions {
    type?: 'key-points' | 'tldr' | 'teaser' | 'headline';
    format?: 'markdown' | 'plain-text';
    length?: 'short' | 'medium' | 'long';
    sharedContext?: string;
    expectedInputLanguages?: string[];
    outputLanguage?: string;
    monitor?: (monitor: EventTarget) => void;
}

interface SummarizerInstance {
    summarize(input: string, options?: { context?: string }): Promise<string>;
    destroy?: () => void;
}

interface SummarizerStatic {
    availability(options?: Omit<SummarizerCreateOptions, 'monitor'>): Promise<Availability>;
    create(options?: SummarizerCreateOptions): Promise<SummarizerInstance>;
}

export type SummaryAvailability = Availability | 'unsupported';

const OPTIONS: SummarizerCreateOptions = {
    type: 'tldr',
    format: 'plain-text',
    length: 'short',
    expectedInputLanguages: ['en'],
    outputLanguage: 'en',
    sharedContext:
        'The titles and web addresses of browser tabs a person had open while working on one task, ' +
        'plus their own note about where they stopped. Summarize what they were doing, in one or two sentences, ' +
        'addressed to them ("You were…").',
};

const MAX_INPUT_CHARS = 3500;

function getSummarizer(): SummarizerStatic | null {
    const api = (self as unknown as { Summarizer?: SummarizerStatic }).Summarizer;
    return api ?? null;
}

export async function getSummaryAvailability(): Promise<SummaryAvailability> {
    const api = getSummarizer();
    if (!api) return 'unsupported';
    try {
        const { monitor: _monitor, ...options } = OPTIONS;
        return await api.availability(options);
    } catch {
        return 'unavailable';
    }
}

/**
 * Create a summarizer. Call this directly inside a click handler: Chrome requires user activation
 * to start the model download, and the activation expires a few seconds after the click.
 */
export function createSummarizer(onDownloadProgress?: (fraction: number) => void): Promise<SummarizerInstance> {
    const api = getSummarizer();
    if (!api) return Promise.reject(new Error('The Summarizer API is not available in this browser'));
    return api.create({
        ...OPTIONS,
        monitor: monitor => {
            monitor.addEventListener('downloadprogress', event => {
                onDownloadProgress?.((event as ProgressEvent).loaded);
            });
        },
    });
}

export function buildSummaryInput(
    task: Pick<Task, 'title' | 'description'>,
    tabs: ContextTab[],
    note?: string
): string {
    const lines = [`Task: ${task.title}`];
    if (task.description) lines.push(`Task description: ${task.description}`);
    if (note) lines.push(`Their note: ${note}`);
    // Host + path only: query strings can hold tokens and personal data
    lines.push('Open tabs:', ...tabs.map(tab => `- ${describeTabForAi(tab)}`));
    const text = lines.join('\n');
    return text.length > MAX_INPUT_CHARS ? `${text.slice(0, MAX_INPUT_CHARS)}…` : text;
}

export async function summarizeContext(
    summarizer: SummarizerInstance,
    task: Pick<Task, 'title' | 'description'>,
    tabs: ContextTab[],
    note?: string
): Promise<string> {
    const summary = await summarizer.summarize(buildSummaryInput(task, tabs, note));
    return summary.trim();
}
