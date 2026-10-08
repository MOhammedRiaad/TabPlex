import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AiSession,
    aiErrorMessage,
    createSession,
    fitInput,
    getModelAvailability,
    isAiError,
    promptJson,
} from '../promptApi';
import { AI_FALLBACK_CHAR_BUDGET, AI_TIMEOUT_MS } from '../../constants';
import { AiError, AiErrorCode } from '../../types';

const stubModel = (impl: Record<string, unknown>) => vi.stubGlobal('LanguageModel', impl);

const session = (overrides: Partial<AiSession> = {}): AiSession => ({
    prompt: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
});

const schema = { type: 'object' };
const validateName = (raw: unknown) =>
    raw && typeof raw === 'object' && typeof (raw as { name?: unknown }).name === 'string'
        ? (raw as { name: string })
        : null;

async function expectAiError(promise: Promise<unknown>, code: AiErrorCode) {
    const error = await promise.then(
        () => undefined,
        (e: unknown) => e
    );
    expect(isAiError(error, code)).toBe(true);
}

describe('getModelAvailability', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is unsupported without the API', async () => {
        expect(await getModelAvailability()).toBe('unsupported');
    });

    it.each(['available', 'downloadable', 'downloading', 'unavailable'])('passes through %s', async value => {
        const availability = vi.fn().mockResolvedValue(value);
        stubModel({ availability });
        expect(await getModelAvailability()).toBe(value);
        const options = availability.mock.calls[0][0];
        expect(options.expectedInputs).toEqual([{ type: 'text', languages: ['en'] }]);
        expect(options.expectedOutputs).toEqual([{ type: 'text', languages: ['en'] }]);
        expect(options).not.toHaveProperty('monitor');
        expect(options).not.toHaveProperty('initialPrompts');
    });

    it('treats a failing check as unavailable', async () => {
        stubModel({ availability: vi.fn().mockRejectedValue(new Error('x')) });
        expect(await getModelAvailability()).toBe('unavailable');
    });
});

describe('createSession', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('rejects as unsupported without the API', async () => {
        await expectAiError(createSession('sys'), 'unsupported');
    });

    it('calls create synchronously (user activation) with the system prompt and reports download progress', async () => {
        const target = new EventTarget();
        const created = session();
        const create = vi.fn(async (options: { monitor: (m: EventTarget) => void }) => {
            options.monitor(target);
            const progress = new Event('downloadprogress') as Event & { loaded: number };
            progress.loaded = 0.5;
            target.dispatchEvent(progress);
            return created;
        });
        stubModel({ create });
        const onProgress = vi.fn();

        const pending = createSession('You sort tabs.', onProgress);
        expect(create).toHaveBeenCalledTimes(1); // before any await
        expect(await pending).toBe(created);
        expect(create.mock.calls[0][0]).toMatchObject({
            initialPrompts: [{ role: 'system', content: 'You sort tabs.' }],
            expectedInputs: [{ type: 'text', languages: ['en'] }],
        });
        expect(onProgress).toHaveBeenCalledWith(0.5);

        await createSession('no progress callback'); // optional
    });

    it('maps a create failure to download-failed', async () => {
        stubModel({ create: vi.fn().mockRejectedValue(new Error('NotAllowedError')) });
        await expectAiError(createSession('sys'), 'download-failed');
        stubModel({ create: vi.fn().mockRejectedValue('weird') });
        const error = await createSession('sys').catch((e: unknown) => e);
        expect((error as AiError).message).toBe('The browser could not start the on-device model');
    });
});

describe('promptJson', () => {
    afterEach(() => vi.useRealTimers());

    it('returns the validated answer, constraining the output to the schema', async () => {
        const prompt = vi.fn().mockResolvedValue('{"name":"Pricing"}');
        expect(await promptJson(session({ prompt }), 'input', { schema, validate: validateName })).toEqual({
            name: 'Pricing',
        });
        expect(prompt).toHaveBeenCalledTimes(1);
        expect(prompt.mock.calls[0][1]).toMatchObject({
            responseConstraint: schema,
            omitResponseConstraintInput: true,
        });
    });

    it('strips Markdown code fences', async () => {
        const prompt = vi.fn().mockResolvedValue('```json\n{"name":"A"}\n```');
        expect(await promptJson(session({ prompt }), 'in', { schema, validate: validateName })).toEqual({ name: 'A' });
    });

    it('retries once after invalid JSON, with a correction', async () => {
        const prompt = vi.fn().mockResolvedValueOnce('not json').mockResolvedValueOnce('{"name":"B"}');
        expect(await promptJson(session({ prompt }), 'in', { schema, validate: validateName })).toEqual({ name: 'B' });
        expect(prompt).toHaveBeenCalledTimes(2);
        expect(prompt.mock.calls[1][0]).toMatch(/^in\n\nYour previous answer was not valid\./);
    });

    it('retries once when validation fails, then gives up with bad-output', async () => {
        const prompt = vi.fn().mockResolvedValue('{"other":1}');
        await expectAiError(promptJson(session({ prompt }), 'in', { schema, validate: validateName }), 'bad-output');
        expect(prompt).toHaveBeenCalledTimes(2);
    });

    it('times out', async () => {
        vi.useFakeTimers();
        const prompt = vi.fn(
            (_input: string, options?: { signal?: AbortSignal }) =>
                new Promise<string>((_resolve, reject) =>
                    options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
                )
        );
        const pending = promptJson(session({ prompt }), 'in', { schema, validate: validateName });
        const check = expectAiError(pending, 'timeout');
        await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
        await check;
    });

    it("is aborted by the caller's signal, immediately if already aborted", async () => {
        const prompt = vi.fn(
            (_input: string, options?: { signal?: AbortSignal }) =>
                new Promise<string>((_resolve, reject) =>
                    options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
                )
        );
        const controller = new AbortController();
        const pending = promptJson(session({ prompt }), 'in', {
            schema,
            validate: validateName,
            signal: controller.signal,
        });
        controller.abort();
        await expectAiError(pending, 'aborted');

        const unused = vi.fn();
        await expectAiError(
            promptJson(session({ prompt: unused }), 'in', {
                schema,
                validate: validateName,
                signal: controller.signal,
            }),
            'aborted'
        );
        expect(unused).not.toHaveBeenCalled();
    });

    it('maps QuotaExceededError to too-large and other failures to bad-output', async () => {
        const quota = vi.fn().mockRejectedValue(new DOMException('too many tokens', 'QuotaExceededError'));
        await expectAiError(
            promptJson(session({ prompt: quota }), 'in', { schema, validate: validateName }),
            'too-large'
        );

        const broken = vi.fn().mockRejectedValue(new Error('model crashed'));
        const error = await promptJson(session({ prompt: broken }), 'in', { schema, validate: validateName }).catch(
            (e: unknown) => e
        );
        expect(error).toMatchObject({ code: 'bad-output', message: 'model crashed' });

        const odd = vi.fn().mockRejectedValue('string failure');
        await expectAiError(
            promptJson(session({ prompt: odd }), 'in', { schema, validate: validateName }),
            'bad-output'
        );
    });
});

describe('fitInput', () => {
    const items = Array.from({ length: 60 }, (_, i) => `item-${i}`);
    const build = (list: string[]) => list.join('\n');
    const largestFitting = (budget: number) => {
        let n = 0;
        while (n < items.length && build(items.slice(0, n + 1)).length <= budget) n++;
        return n;
    };

    it('returns everything when it fits', async () => {
        const measure = vi.fn(async (text: string) => text.length);
        const result = await fitInput(session({ contextWindow: 100_000, measureContextUsage: measure }), items, build);
        expect(result).toEqual({ input: build(items), used: 60 });
    });

    it('keeps the largest prefix that fits the context window (with 10% headroom)', async () => {
        // 1 token per character, 100-token window: the prompt must stay within 90 (10% headroom)
        const measure = vi.fn(async (text: string) => text.length);
        const result = await fitInput(session({ contextWindow: 100, measureContextUsage: measure }), items, build);
        expect(result.used).toBe(largestFitting(90));
        expect(result.input.length).toBeLessThanOrEqual(90);
        expect(build(items.slice(0, result.used + 1)).length).toBeGreaterThan(90);
        expect(measure.mock.calls.length).toBeLessThan(12); // binary search, not one call per item
    });

    it('supports the older inputQuota / measureInputUsage names', async () => {
        const measure = vi.fn(async (text: string) => text.length);
        const result = await fitInput(session({ inputQuota: 100, measureInputUsage: measure }), items, build);
        expect(result.used).toBe(largestFitting(90));
        expect(measure).toHaveBeenCalled();
    });

    it('falls back to a character budget when the session cannot measure', async () => {
        const big = Array.from({ length: 2000 }, (_, i) => `entry number ${i}`);
        const result = await fitInput(session(), big, build);
        expect(result.input.length).toBeLessThanOrEqual(AI_FALLBACK_CHAR_BUDGET);
        expect(build(big.slice(0, result.used + 1)).length).toBeGreaterThan(AI_FALLBACK_CHAR_BUDGET);
    });

    it('throws too-large when even the minimum does not fit', async () => {
        const measure = vi.fn(async () => 1000);
        await expectAiError(
            fitInput(session({ contextWindow: 100, measureContextUsage: measure }), items, build, 4),
            'too-large'
        );
    });
});

describe('aiErrorMessage', () => {
    it.each([
        ['unsupported', /desktop Chrome 138\+, or a preview build of Edge/],
        ['unavailable', /doesn't meet your browser's requirements/],
        ['download-failed', /couldn't download/],
        ['too-large', /Too many tabs/],
        ['bad-output', /couldn't use/],
        ['timeout', /took too long/],
    ] as const)('explains %s', (code, text) => {
        expect(aiErrorMessage(new AiError(code, 'x'))).toMatch(text);
    });

    it('says nothing for a cancel and passes other errors through', () => {
        expect(aiErrorMessage(new AiError('aborted', 'x'))).toBe('');
        expect(aiErrorMessage(new Error('plain'))).toBe('plain');
        expect(aiErrorMessage('text')).toBe('text');
    });
});
