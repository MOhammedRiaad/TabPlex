import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NoteCard from '../components/NoteCard';
import {
    ACTIONS_SCHEMA,
    NOTE_SUMMARY_OPTIONS,
    cleanRewrite,
    insertSummary,
    noteAiErrorMessage,
    normalizeActions,
    startNoteHelper,
} from '../utils/aiNoteHelpers';
import { AiError } from '../../ai/types';
import { AI_SETTINGS_KEY } from '../../ai/constants';
import { useBoardStore } from '../../../store/boardStore';
import { useUIStore } from '../../ui/store/uiStore';
import { respondToMessages } from '../../../test/chromeMock';
import { makeNote, makeTask } from '../../../test/factories';

const NOTE_TEXT = 'Met with Sam about the pricing page. We need to email legal and update the FAQ.';

/** A fake Prompt API: `answer` is what prompt() returns (a function gets the input) */
function stubLanguageModel(answer: string | ((input: string) => string | Promise<string>), availability = 'available') {
    const session = {
        prompt: vi.fn(async (input: string) => (typeof answer === 'function' ? answer(input) : answer)),
        destroy: vi.fn(),
    };
    const create = vi.fn().mockResolvedValue(session);
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn().mockResolvedValue(availability) });
    return { create, session };
}

function stubSummarizer(summary = '- Email legal\n- Update the FAQ', availability = 'available') {
    const summarizer = { summarize: vi.fn().mockResolvedValue(summary), destroy: vi.fn() };
    const create = vi.fn().mockResolvedValue(summarizer);
    vi.stubGlobal('Summarizer', { create, availability: vi.fn().mockResolvedValue(availability) });
    return { create, summarizer };
}

describe('AI note helpers: prompts and cleaning', () => {
    it('the actions schema has no length caps on text', () => {
        expect(JSON.stringify(ACTIONS_SCHEMA)).not.toContain('maxLength');
        expect(NOTE_SUMMARY_OPTIONS).toMatchObject({ type: 'key-points', format: 'markdown', length: 'short' });
    });

    it('normalizes action items: cleans, cuts, defaults priority, drops short, duplicate and existing ones', () => {
        expect(normalizeActions(null)).toBeNull();
        expect(normalizeActions({ tasks: 'x' })).toBeNull();
        expect(
            normalizeActions(
                {
                    tasks: [
                        { title: '  "Email legal."  ', priority: 'high' },
                        { title: 'email legal' },
                        { title: 'ok' },
                        { title: 'Update the FAQ', priority: 'urgent' },
                        { title: 'Book a room', priority: 'low' },
                        { title: 'Existing task' },
                        null,
                        { title: 'x'.repeat(300) },
                    ],
                },
                ['existing task']
            )
        ).toEqual([
            { title: 'Email legal', priority: 'high' },
            { title: 'Update the FAQ', priority: 'medium' },
            { title: 'Book a room', priority: 'low' },
            { title: 'x'.repeat(200), priority: 'medium' },
        ]);
    });

    it('unwraps one Markdown fence and rejects empty or runaway rewrites', () => {
        expect(cleanRewrite('```markdown\n# Fixed\ntext\n```', '# Fix\ntext')).toBe('# Fixed\ntext');
        expect(cleanRewrite('  plain  ', 'plain')).toBe('plain');
        expect(() => cleanRewrite('   ', 'note')).toThrow(AiError);
        expect(() => cleanRewrite('x'.repeat(601), 'short')).toThrow(/unusable/);
        expect(cleanRewrite('x'.repeat(600), 'short')).toHaveLength(600);
    });

    it('puts the summary at the top and words errors for notes', () => {
        expect(insertSummary('\n\nBody', ' - a\n')).toBe('## Summary\n\n- a\n\nBody');
        expect(noteAiErrorMessage(new AiError('too-large', 'x'))).toMatch(/note is too long/);
        expect(noteAiErrorMessage(new Error('The Summarizer API is not available in this browser'))).toMatch(
            /summarizer/
        );
        expect(noteAiErrorMessage(new AiError('timeout', 'x'))).toMatch(/took too long/);
    });
});

describe('AI note helpers: running', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('creates the session right away (in the click), with the system prompt, and releases it once', async () => {
        const { create, session } = stubLanguageModel('Better text');
        const helper = startNoteHelper('rewrite-formal');
        expect(create).toHaveBeenCalledTimes(1);
        expect(create.mock.calls[0][0].initialPrompts[0].content).toMatch(/more formal/);
        await expect(helper.run('Some text', new AbortController().signal)).resolves.toEqual({
            kind: 'text',
            text: 'Better text',
        });
        helper.release();
        helper.release();
        await waitFor(() => expect(session.destroy).toHaveBeenCalledTimes(1));
    });

    it('proofread uses its own prompt; actions use the schema', async () => {
        const { create } = stubLanguageModel('{"tasks":[{"title":"Email legal"}]}');
        startNoteHelper('proofread').release();
        expect(create.mock.calls[0][0].initialPrompts[0].content).toMatch(/Fix spelling/);
        const actions = startNoteHelper('actions');
        await expect(actions.run(NOTE_TEXT, new AbortController().signal)).resolves.toEqual({
            kind: 'tasks',
            items: [{ title: 'Email legal', priority: 'medium' }],
        });
    });

    it('summarizes with the Summarizer and destroys it', async () => {
        const { create, summarizer } = stubSummarizer();
        const helper = startNoteHelper('summarize');
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'key-points', format: 'markdown' }));
        await expect(helper.run('n'.repeat(7000), new AbortController().signal)).resolves.toEqual({
            kind: 'summary',
            text: '- Email legal\n- Update the FAQ',
        });
        expect(summarizer.summarize.mock.calls[0][0]).toHaveLength(6001); // cut, with an ellipsis
        helper.release();
        await waitFor(() => expect(summarizer.destroy).toHaveBeenCalled());
    });

    it('reports an empty summary, an aborted summary and a missing summarizer', async () => {
        stubSummarizer('  ');
        await expect(startNoteHelper('summarize').run('text', new AbortController().signal)).rejects.toMatchObject({
            code: 'bad-output',
        });
        const controller = new AbortController();
        controller.abort();
        await expect(startNoteHelper('summarize').run('text', controller.signal)).rejects.toMatchObject({
            code: 'aborted',
        });
        vi.unstubAllGlobals();
        await expect(startNoteHelper('summarize').run('text', new AbortController().signal)).rejects.toThrow(
            /Summarizer/
        );
    });
});

describe('✨ AI in the note editor', () => {
    beforeEach(async () => {
        respondToMessages();
        useBoardStore.setState({ notes: [], tasks: [makeTask({ title: 'Update the FAQ' })] });
        useUIStore.setState({ toast: null });
        await chrome.storage.local.remove(AI_SETTINGS_KEY);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    function renderEditing(content = NOTE_TEXT) {
        const note = makeNote({ title: 'Pricing sync', content, tags: ['q4'] });
        useBoardStore.setState({ notes: [note] });
        render(<NoteCard note={note} />);
        fireEvent.click(screen.getByLabelText('Edit note'));
        return note;
    }

    const textarea = () => document.querySelector('.markdown-textarea') as HTMLTextAreaElement;
    const openMenu = async () => fireEvent.click(await screen.findByRole('button', { name: '✨ AI' }));

    it('is hidden when the browser has no on-device AI, or the setting is off', async () => {
        renderEditing();
        await act(async () => undefined);
        expect(screen.queryByRole('button', { name: '✨ AI' })).toBeNull();
    });

    it('is hidden when the setting is off', async () => {
        stubLanguageModel('x');
        await chrome.storage.local.set({ [AI_SETTINGS_KEY]: { noteHelpers: false } });
        renderEditing();
        await act(async () => undefined);
        expect(screen.queryByRole('button', { name: '✨ AI' })).toBeNull();
    });

    it('disables the helpers under 20 characters and hides Summarize without the Summarizer', async () => {
        stubLanguageModel('x');
        renderEditing('Too short');
        await openMenu();
        expect(screen.getByText('Write a bit more first')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Proofread' })).toBeDisabled();
        expect(screen.queryByRole('menuitem', { name: 'Summarize' })).toBeNull();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
        await openMenu();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('rewrites with a preview; Replace changes the editor, Undo restores it, Save stores it', async () => {
        const { create, session } = stubLanguageModel('Sam and I met about pricing. Email legal; update the FAQ.');
        renderEditing();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Shorter' }));
        expect(create).toHaveBeenCalledTimes(1); // created in the click
        const dialog = screen.getByRole('dialog', { name: 'Rewrite: shorter' });
        expect(dialog).toHaveTextContent('Rewriting on your device…');
        await within(dialog).findByText('Sam and I met about pricing. Email legal; update the FAQ.');
        expect(within(dialog).getByText(NOTE_TEXT)).toBeInTheDocument(); // before / after

        fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
        expect(textarea().value).toBe('Sam and I met about pricing. Email legal; update the FAQ.');
        await waitFor(() => expect(session.destroy).toHaveBeenCalled());
        expect(screen.getByRole('status')).toHaveTextContent('Note rewritten');
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(textarea().value).toBe(NOTE_TEXT);

        // Replace again, then save
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Proofread' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));
        expect(screen.getByRole('status')).toHaveTextContent('Note proofread');
        fireEvent.change(textarea(), { target: { value: 'Edited by hand' } });
        expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull(); // edited since: no Undo
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(useBoardStore.getState().notes[0].content).toBe('Edited by hand');
    });

    it('summarizes: Copy, then Insert at top', async () => {
        stubLanguageModel('x');
        stubSummarizer('- Email legal');
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        renderEditing();
        await openMenu();
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Summarize' }));
        const dialog = screen.getByRole('dialog', { name: 'Summarize' });
        await within(dialog).findByText('Email legal');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
        await within(dialog).findByRole('button', { name: 'Copied' });
        expect(writeText).toHaveBeenCalledWith('- Email legal');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Insert at top' }));
        expect(textarea().value).toBe(`## Summary\n\n- Email legal\n\n${NOTE_TEXT}`);
        expect(screen.getByRole('status')).toHaveTextContent('Summary added');
    });

    it('turns action items into the selected tasks, with the note tags, skipping existing tasks', async () => {
        stubLanguageModel(
            '{"tasks":[{"title":"Email legal","priority":"high"},{"title":"Update the FAQ"},{"title":"Book a room"}]}'
        );
        renderEditing();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Action items → tasks' }));
        const dialog = screen.getByRole('dialog', { name: 'Action items → tasks' });
        await within(dialog).findByText('Email legal');
        expect(within(dialog).queryByText('Update the FAQ')).toBeNull(); // already a task
        expect(within(dialog).getByText('high')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByLabelText('Book a room'));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Create 1 task' }));

        const created = useBoardStore.getState().tasks.find(task => task.title === 'Email legal');
        expect(created).toMatchObject({
            status: 'todo',
            priority: 'high',
            description: 'From note “Pricing sync”',
            tags: ['q4'],
        });
        expect(useBoardStore.getState().tasks.some(task => task.title === 'Book a room')).toBe(false);
        expect(useUIStore.getState().toast?.message).toBe('Created 1 task');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('says when there are no to-dos, and the create button needs a selection', async () => {
        stubLanguageModel('{"tasks":[]}');
        renderEditing();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Action items → tasks' }));
        await screen.findByText('No to-dos found in this note.');
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        stubLanguageModel('{"tasks":[{"title":"Email legal"},{"title":"Call Sam"}]}');
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Action items → tasks' }));
        await screen.findByText('Call Sam');
        fireEvent.click(screen.getByLabelText('Email legal'));
        expect(screen.getByRole('button', { name: 'Create 1 task' })).toBeEnabled();
        fireEvent.click(screen.getByLabelText('Call Sam'));
        expect(screen.getByRole('button', { name: 'Create 0 tasks' })).toBeDisabled();
    });

    it('shows errors with Try again (a new session), and Cancel aborts and frees the model', async () => {
        let calls = 0;
        const { create, session } = stubLanguageModel(() => (++calls === 1 ? '' : 'Fixed text'));
        renderEditing();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Proofread' }));
        expect(await screen.findByRole('alert')).toHaveTextContent("couldn't use");
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(create).toHaveBeenCalledTimes(2);
        await screen.findByText('Fixed text');
        fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
        expect(textarea().value).toBe(NOTE_TEXT);

        // A slow answer: Cancel closes the dialog and frees the session
        stubLanguageModel(() => new Promise(() => undefined));
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Clearer' }));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(session.destroy).toHaveBeenCalled());
    });

    it('shows the download progress and frees the model if the card goes away', async () => {
        const session = { prompt: vi.fn(() => new Promise(() => undefined)), destroy: vi.fn() };
        let monitor: ((m: EventTarget) => void) | undefined;
        vi.stubGlobal('LanguageModel', {
            availability: vi.fn().mockResolvedValue('downloadable'),
            create: vi.fn((options: { monitor: (m: EventTarget) => void }) => {
                monitor = options.monitor;
                return Promise.resolve(session);
            }),
        });
        const note = makeNote({ content: NOTE_TEXT });
        const { unmount } = render(<NoteCard note={note} />);
        fireEvent.click(screen.getByLabelText('Edit note'));
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Proofread' }));
        const target = new EventTarget();
        monitor?.(target);
        act(() => {
            target.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: 0.4 }));
        });
        expect(screen.getByText('Downloading on-device AI model… 40%')).toBeInTheDocument();
        unmount();
        await waitFor(() => expect(session.destroy).toHaveBeenCalled());
    });

    it('closes when clicking outside the dialog', async () => {
        stubLanguageModel('Fixed');
        renderEditing();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Proofread' }));
        fireEvent.click(document.querySelector('.note-ai-overlay') as HTMLElement);
        expect(screen.queryByRole('dialog')).toBeNull();
        // Cancel keeps the text
        expect(textarea().value).toBe(NOTE_TEXT);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    it('rejects a note too long for the model', async () => {
        const session = {
            prompt: vi.fn(),
            destroy: vi.fn(),
            contextWindow: 100,
            measureContextUsage: vi.fn().mockResolvedValue(500),
        };
        vi.stubGlobal('LanguageModel', {
            availability: vi.fn().mockResolvedValue('available'),
            create: vi.fn().mockResolvedValue(session),
        });
        renderEditing();
        await openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Proofread' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('This note is too long');
        expect(session.prompt).not.toHaveBeenCalled();
    });
});
