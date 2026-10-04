// AI path of "New task from tabs": prompt, response schema, and the normalizer that cleans the model's answer.
// See docs/specs/AI_TASK_FROM_TABS.md §5.2.
import { describeTabForAi } from '../../ai/utils/tabText';
import { Task } from '../../../types';
import { HINT_MAX, MAX_STEPS, STEP_MAX, TASK_DESCRIPTION_MAX, TASK_TITLE_MAX, TaskDraft } from '../types';

export const DRAFT_SYSTEM_PROMPT = [
    'You turn a set of browser tabs into one to-do task for the person who opened them.',
    'Each tab has a title and a short address. They may also give a hint about their goal.',
    'Write:',
    '- title: what they are trying to get done, as a short imperative phrase (3 to 8 words, at most 80 characters), e.g. "Compare Stripe and Paddle pricing". No quotes, no emoji, no trailing period.',
    '- description: one or two plain sentences of context, at most 280 characters. Empty string if there is nothing useful to add.',
    '- priority: "high" only if the tabs or hint suggest urgency (deadline, outage, bug, payment due, today); "low" for reading, entertainment or someday ideas; otherwise "medium".',
    '- steps: 0 to 5 concrete next actions, each an imperative phrase of at most 80 characters, in a sensible order. Do not invent facts that are not suggested by the tabs.',
    'Answer only with JSON that matches the schema.',
].join('\n');

export const DIFFERENT_DRAFT = '\nWrite a different draft from your last answer.';

export function buildDraftInput(tabs: { title: string; url: string }[], hint?: string): string {
    const lines = tabs.map(tab => `- ${describeTabForAi(tab)}`);
    const parts = [`Tabs:\n${lines.join('\n')}`];
    const cleanHint = hint?.trim().slice(0, HINT_MAX);
    if (cleanHint) parts.push(`Their hint: ${cleanHint}`);
    parts.push('Draft the task.');
    return parts.join('\n\n');
}

// No maxLength: a hard length cap can make the model squeeze text into emoji or gibberish (Chrome's built-in AI
// guidance). The prompt asks for short text and normalizeDraft cuts it to the limits.
export const DRAFT_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string', minLength: 3 },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        steps: {
            type: 'array',
            maxItems: MAX_STEPS,
            items: { type: 'string', minLength: 3 },
        },
    },
    required: ['title', 'description', 'priority', 'steps'],
    additionalProperties: false,
};

const WRAPPING_QUOTES = /^(["'“‘])(.*)(["'”’])$/s;

/** One line of model or tab text: single spaces, no wrapping quotes, no emoji, no single trailing period */
export function cleanLine(raw: string): string {
    let text = raw
        .replace(/\p{Extended_Pictographic}|️/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    const quoted = text.match(WRAPPING_QUOTES);
    if (quoted) text = quoted[2].trim();
    return text.replace(/\.$/, '').trim();
}

const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high'];

/** Repair the model's answer; null makes promptJson retry once */
export function normalizeDraft(raw: unknown): TaskDraft | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const data = raw as Record<string, unknown>;

    const title = cleanLine(String(data.title ?? ''))
        .slice(0, TASK_TITLE_MAX)
        .trim();
    if (title.length < 3) return null;

    let description =
        typeof data.description === 'string'
            ? data.description.replace(/\s+/g, ' ').trim().slice(0, TASK_DESCRIPTION_MAX).trim()
            : '';
    if (description.toLowerCase() === title.toLowerCase()) description = '';

    const priority = PRIORITIES.includes(data.priority as Task['priority'])
        ? (data.priority as Task['priority'])
        : 'medium';

    const steps: string[] = [];
    const seen = new Set([title.toLowerCase()]);
    for (const entry of Array.isArray(data.steps) ? data.steps : []) {
        const step = cleanLine(String(entry ?? ''))
            .slice(0, STEP_MAX)
            .trim();
        if (step.length < 3 || seen.has(step.toLowerCase())) continue;
        seen.add(step.toLowerCase());
        steps.push(step);
        if (steps.length === MAX_STEPS) break;
    }

    return { title, description, priority, steps };
}
