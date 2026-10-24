import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TabNotesDialog from '../TabNotesDialog';
import { useTabNotesStore } from '../../store/tabNotesStore';
import { useBoardStore } from '../../../../store/boardStore';
import { useUIActions, useUIStore } from '../../../ui/store/uiStore';
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from '../../../ai/constants';
import { ChromeMock, fakeChrome, installChromeMock } from '../../../../test/chromeMock';
import { KeyPoint, NoteSource, PageSnapshot } from '../../types';
import { groupTopics } from '../../utils/groupTopics';

/** Sentences of each test page, registered when the page is "read" so the model stub can find them */
const known = new Set<string>();

const ALPHA = 'https://alpha.test/a';
const BETA = 'https://beta.test/b';

const PAGE_SENTENCES: Record<string, string[]> = {
    [ALPHA]: [
        'Alpha caches DNS answers in resolvers until their TTL runs out, so repeat queries are fast.',
        'Alpha says negative answers are cached as well, for a shorter time set by the zone.',
        'Alpha notes that clients keep each answer they receive until the cache entry expires.',
    ],
    [BETA]: [
        'Beta explains that recursive resolvers serve cached records to many different clients.',
        'Beta describes how the zone sets the negative cache time in its start of authority record.',
        'Beta warns that stale entries can linger for a while after the underlying record changes.',
    ],
};

/** A page with the given text (registered as known sentences) */
function pageFor(tab: { url?: string; title?: string }): PageSnapshot {
    const url = tab.url ?? '';
    const sentences = PAGE_SENTENCES[url] ?? [
        `${tab.title} discusses its own subject in a few careful sentences for this test page.`,
        `${tab.title} adds a second sentence about that same subject, with enough words to count.`,
        `${tab.title} closes with one more sentence about it so the page has enough text.`,
    ];
    sentences.forEach(sentence => known.add(sentence));
    return {
        href: url,
        contentType: 'text/html',
        lang: 'en',
        description: '',
        truncated: false,
        blocks: [
            { kind: 'heading', level: 2, text: 'Caching' },
            ...sentences.map(text => ({ kind: 'text' as const, text })),
        ],
    };
}

/** The model stub answers with every known sentence the page text contains (grounded, in page order) */
const answerFor = (input: string) =>
    JSON.stringify({
        points: [...known].filter(sentence => input.includes(sentence)).map(text => ({ text, topic: 'Caching' })),
    });

interface ModelOptions {
    availability?: string;
    /** Lets the test hold the model download until it chooses */
    gate?: Promise<void>;
    /** Reports a download fraction before create resolves */
    progress?: number;
}

/** A LanguageModel stub with clone(); create is a spy so tests can see when the session is made */
function stubModel({ availability = 'available', gate, progress }: ModelOptions = {}) {
    const base = {
        prompt: vi.fn(),
        destroy: vi.fn(),
        clone: vi.fn(async () => ({
            prompt: vi.fn(async (input: string) => answerFor(input)),
            destroy: vi.fn(),
        })),
    };
    const create = vi.fn(async (options?: { monitor?: (target: EventTarget) => void }) => {
        if (progress !== undefined) {
            const target = new EventTarget();
            options?.monitor?.(target);
            target.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: progress }));
        }
        await gate;
        return base;
    });
    vi.stubGlobal('LanguageModel', { availability: vi.fn(async () => availability), create });
    return { create, base };
}

function Harness() {
    const { openTabNotesDialog } = useUIActions();
    return (
        <>
            <button type="button" onClick={openTabNotesDialog}>
                Open dialog
            </button>
            <TabNotesDialog />
        </>
    );
}

let browser: ChromeMock['browser'];
let opener: HTMLElement;

/** Renders the harness and opens the dialog with a click on the opener, which keeps focus on it */
function openDialog() {
    render(<Harness />);
    opener = screen.getByRole('button', { name: 'Open dialog' });
    opener.focus();
    fireEvent.click(opener);
    return screen.getByRole('dialog', { name: 'Summarize open tabs' });
}

/** Makes every page readable: each executeScript call returns the page of the tab it was given */
function readPagesOk() {
    fakeChrome().scripting.executeScript.mockImplementation(async (injection: { target: { tabId: number } }) => {
        const tab = browser.tabs.get(injection.target.tabId);
        return [{ frameId: 0, result: pageFor({ url: tab?.url, title: tab?.title }) }];
    });
}

/** Pages whose tab id is in `failing` are refused by the browser (as for pages TabPlex can't script) */
function failOn(tabIds: number[]) {
    const failing = new Set(tabIds);
    fakeChrome().scripting.executeScript.mockImplementation(async (injection: { target: { tabId: number } }) => {
        const id = injection.target.tabId;
        if (failing.has(id)) {
            failing.delete(id);
            throw new Error('Cannot access contents of the page');
        }
        const tab = browser.tabs.get(id);
        return [{ frameId: 0, result: pageFor({ url: tab?.url, title: tab?.title }) }];
    });
}

const state = () => useTabNotesStore.getState();
const runEnded = () => waitFor(() => expect(state().status).not.toBe('running'));

/** Clicks a button once it is enabled (the access check and the model check finish a moment after the dialog opens) */
async function clickReady(name: string) {
    const button = await screen.findByRole('button', { name });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
}

/** Picks a layout in the review: the "Combine similar tabs" radio group */
async function chooseView(name: 'Combined' | 'By tab') {
    const radio = await screen.findByRole('radio', { name });
    await waitFor(() => expect(radio).toBeEnabled());
    fireEvent.click(radio);
}

beforeEach(() => {
    browser = installChromeMock().browser;
    known.clear();
    readPagesOk();
    useTabNotesStore.getState().actions.close();
    useBoardStore.setState({ notes: [] });
    useUIStore.setState({ tabNotesDialogOpen: false, toast: null });
});

afterEach(() => {
    useTabNotesStore.getState().actions.close();
    vi.unstubAllGlobals();
    vi.mocked(fakeChrome().scripting.executeScript).mockReset();
});

describe('TabNotesDialog: picking tabs', () => {
    it('is closed until opened, and is a labelled modal dialog', () => {
        render(<Harness />);
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
        const dialog = screen.getByRole('dialog', { name: 'Summarize open tabs' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('pre-checks every readable tab when there are up to 10, and shows the count', async () => {
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        browser.addTab({ url: BETA, title: 'Beta' });
        browser.addTab({ url: 'https://gamma.test/c', title: 'Gamma' });
        openDialog();
        expect(await screen.findByText('3 of 3 selected, max 12')).toBeInTheDocument();
        for (const box of screen.getAllByRole('checkbox')) expect(box).toBeChecked();
    });

    it('pre-checks nothing with more than 10 readable tabs', async () => {
        for (let i = 0; i < 11; i++) browser.addTab({ url: `https://site${i}.test/p`, title: `Site ${i}` });
        openDialog();
        expect(await screen.findByText('0 of 11 selected, max 12')).toBeInTheDocument();
        for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
    });

    it('caps the selection at 12 and disables the boxes beyond it', async () => {
        for (let i = 0; i < 13; i++) browser.addTab({ url: `https://site${i}.test/p`, title: `Site ${i}` });
        openDialog();
        await screen.findByText('0 of 13 selected, max 12');
        const boxes = screen.getAllByRole('checkbox');
        for (const box of boxes.slice(0, 12)) fireEvent.click(box);
        expect(screen.getByText('12 of 13 selected, max 12')).toBeInTheDocument();
        expect(boxes[12]).toBeDisabled();
        // Unticking one frees a slot
        fireEvent.click(boxes[0]);
        expect(boxes[12]).toBeEnabled();
    });

    it('starts duplicates unchecked and says which tab they repeat', async () => {
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        browser.addTab({ url: `${ALPHA}#section`, title: 'Alpha again' });
        openDialog();
        expect(await screen.findByText('Same page as Alpha')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Alpha again/ })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Alpha alpha/ })).toBeChecked();
    });

    it('greys out unreadable tabs with the reason and keeps them unpickable', async () => {
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        browser.addTab({ url: 'https://alpha.test/paper.pdf', title: 'Paper' });
        browser.addTab({ url: 'https://chromewebstore.google.com/detail/x', title: 'Store' });
        browser.addTab({ url: 'https://loading.test/', title: 'Loading', status: 'loading' });
        const asleep = browser.addTab({ url: 'https://sleepy.test/', title: 'Sleepy' });
        Object.assign(asleep, { discarded: true });
        openDialog();

        expect(await screen.findByText("Can't read PDFs yet")).toBeInTheDocument();
        expect(screen.getByText("Your browser doesn't let extensions read this page")).toBeInTheDocument();
        expect(screen.getByText('Still loading')).toBeInTheDocument();
        expect(screen.getByText('Tab is asleep. Open it once, then try again')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Paper/ })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: /Loading/ })).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: /Alpha/ })).toBeChecked();
    });

    it('says when there are no web pages to pick', async () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
        expect(await screen.findByText('No web pages open in this window.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Make quick view' })).toBeDisabled();
    });

    it('a tab that finishes loading becomes pickable when the tab list changes', async () => {
        const late = browser.addTab({ url: 'https://late.test/x', title: 'Late', status: 'loading' });
        openDialog();
        const box = await screen.findByRole('checkbox', { name: /Late/ });
        expect(box).toBeDisabled();

        late.status = 'complete';
        browser.events.tabUpdated.emit(late.id, { status: 'complete' }, late);
        await waitFor(() => expect(screen.getByRole('checkbox', { name: /Late/ })).toBeEnabled());
    });

    it('Cancel and Escape close the dialog and return focus to the opener', async () => {
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await screen.findByRole('checkbox', { name: /Alpha/ });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(opener).toHaveFocus();

        fireEvent.click(opener);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(opener).toHaveFocus();
    });
});

describe('TabNotesDialog: access to the sites', () => {
    it('shows no access step when the sites are already allowed', async () => {
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Make quick view' })).toBeEnabled());
        expect(screen.queryByRole('button', { name: 'Allow access' })).toBeNull();
        expect(fakeChrome().permissions.request).not.toHaveBeenCalled();
    });

    it('asks for the picked sites only, synchronously in the click, then continues', async () => {
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        browser.addTab({ url: BETA, title: 'Beta' });
        openDialog();
        const summarize = await screen.findByRole('button', { name: 'Make quick view' });
        // Off while the access check is pending and after it finds the missing sites
        expect(summarize).toBeDisabled();
        await screen.findByRole('button', { name: 'Allow access' });
        expect(summarize).toBeDisabled();
        expect(screen.getByText(/TabPlex needs to read these sites: alpha\.test, beta\.test/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Allow access' }));
        // Called during the click, not after an await
        expect(fakeChrome().permissions.request).toHaveBeenCalledTimes(1);
        expect(fakeChrome().permissions.request).toHaveBeenCalledWith({
            origins: ['https://alpha.test/*', 'https://beta.test/*'],
        });

        await waitFor(() => expect(screen.getByRole('button', { name: 'Make quick view' })).toBeEnabled());
        expect(screen.queryByRole('button', { name: 'Allow access' })).toBeNull();
    });

    it('keeps the tabs and says who refused, and Summarize stays off', async () => {
        browser.setPermissionRequestAnswer(false);
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await clickReady('Allow access');

        expect(await screen.findByText("Access wasn't allowed for: alpha.test.")).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Alpha/ })).toBeChecked();
        expect(screen.getByRole('button', { name: 'Make quick view' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Allow access' })).toBeInTheDocument();
    });

    it('asks for access again after a refusal when the user tries again', async () => {
        browser.setPermissionRequestAnswer(false);
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await clickReady('Allow access');
        await screen.findByText("Access wasn't allowed for: alpha.test.");

        browser.setPermissionRequestAnswer(true);
        fireEvent.click(screen.getByRole('button', { name: 'Allow access' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Make quick view' })).toBeEnabled());
        expect(fakeChrome().permissions.request).toHaveBeenCalledTimes(2);
    });
});

describe('TabNotesDialog: summarizing', () => {
    it('labels the button for the model when it can run, and creates the session in the click', async () => {
        const { create } = stubModel();
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await screen.findByRole('button', { name: 'Summarize 1 tab' });
        await clickReady('Summarize 1 tab');
        expect(create).toHaveBeenCalledTimes(1);
        await runEnded();
        expect(state().mode).toBe('ai');
    });

    it('uses "Make quick view" and explains why when the model is unavailable', async () => {
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Make quick view' })).toBeEnabled());
        expect(screen.getByRole('status')).toHaveTextContent("This browser doesn't have built-in AI");
    });

    it('uses "Make quick view" when AI summaries are turned off in Settings', async () => {
        stubModel();
        await chrome.storage.local.set({ [AI_SETTINGS_KEY]: { ...DEFAULT_AI_SETTINGS, tabSummaries: false } });
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        expect(
            await screen.findByText('Summaries with AI are turned off in Settings. Making a quick view instead.')
        ).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Make quick view' })).toBeEnabled());
    });

    it('shows the model download while it runs, and Cancel stops it', async () => {
        const gate = new Promise<void>(() => undefined);
        stubModel({ availability: 'downloadable', gate, progress: 0.5 });
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await clickReady('Summarize 1 tab');
        expect(await screen.findByText('Downloading on-device AI model… 50%')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await runEnded();
        expect(state().status).toBe('cancelled');
    });

    it('marks a source made without AI with the quick view tag', async () => {
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        openDialog();
        await clickReady('Make quick view');
        await runEnded();
        expect(await screen.findByText('quick view')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create note' })).toBeEnabled();
    });

    it('shows progress and keeps finished sources when Cancel is pressed', async () => {
        stubModel();
        browser.grantOrigins('https://alpha.test/*', 'https://beta.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        const beta = browser.addTab({ url: BETA, title: 'Beta' });
        // Beta never answers, so the run is still going when Cancel is pressed
        fakeChrome().scripting.executeScript.mockImplementation(async (injection: { target: { tabId: number } }) => {
            if (injection.target.tabId === beta.id) return new Promise<never>(() => undefined);
            const tab = browser.tabs.get(injection.target.tabId);
            return [{ frameId: 0, result: pageFor({ url: tab?.url, title: tab?.title }) }];
        });
        openDialog();
        await clickReady('Summarize 2 tabs');
        expect(await screen.findByText('Reading and summarizing 2 of 2 · beta.test…')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(await screen.findByRole('region', { name: 'Source 1: Alpha' })).toBeInTheDocument();
        expect(screen.getByText('Not read (cancelled)')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(state().status).toBe('cancelled');
        expect(screen.getByRole('button', { name: 'Create note' })).toBeEnabled();
    });

    it('Escape while a run is going aborts it and closes the dialog', async () => {
        stubModel();
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        fakeChrome().scripting.executeScript.mockImplementation(async () => new Promise<never>(() => undefined));
        openDialog();
        await clickReady('Summarize 1 tab');
        await screen.findByText('Reading and summarizing 1 of 1 · alpha.test…');

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(state().status).toBe('idle');
        expect(opener).toHaveFocus();
    });

    it('a failed tab is listed with its reason and can be retried on its own', async () => {
        const { create } = stubModel();
        browser.grantOrigins('https://alpha.test/*', 'https://beta.test/*');
        browser.addTab({ url: ALPHA, title: 'Alpha' });
        const beta = browser.addTab({ url: BETA, title: 'Beta' });
        failOn([beta.id]);
        openDialog();
        await clickReady('Summarize 2 tabs');
        await runEnded();

        expect(await screen.findByText('Could not be read')).toBeInTheDocument();
        expect(screen.getByText("TabPlex doesn't have access to this site.")).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Source 1: Alpha' })).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Source 2: Beta' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Retry Beta' }));
        await screen.findByRole('region', { name: 'Source 2: Beta' });
        await runEnded();
        expect(screen.queryByText('Could not be read')).toBeNull();
        expect(create).toHaveBeenCalledTimes(2);
    });
});

describe('TabNotesDialog: review and the note', () => {
    /** Runs the dialog over Alpha and Beta with the model, and waits for the review */
    async function reviewAlphaAndBeta() {
        stubModel();
        browser.grantOrigins('https://alpha.test/*', 'https://beta.test/*');
        const alpha = browser.addTab({ url: ALPHA, title: 'Alpha' });
        const beta = browser.addTab({ url: BETA, title: 'Beta' });
        openDialog();
        await clickReady('Summarize 2 tabs');
        await runEnded();
        await chooseView('By tab');
        await screen.findByRole('region', { name: 'Source 2: Beta' });
        return { alpha, beta };
    }

    it('creates a tagged Markdown study note through the board store and closes', async () => {
        await reviewAlphaAndBeta();
        const title = screen.getByRole('textbox', { name: 'Note title' });
        expect((title as HTMLInputElement).value).toMatch(/^Study notes · /);
        expect(screen.getByRole('checkbox', { name: 'Tag "study"' })).toBeChecked();

        fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(useUIStore.getState().toast?.message).toBe('Note created');
        expect(opener).toHaveFocus();

        const [note] = useBoardStore.getState().notes;
        expect(note.format).toBe('markdown');
        expect(note.tags).toEqual(['study']);
        expect(note.title).toMatch(/^Study notes · /);
        expect(note.content.startsWith(`# ${note.title}`)).toBe(true);
        expect(note.content).toContain('Alpha caches DNS answers');
        expect(note.content).toContain('Beta explains that recursive resolvers');
        expect(note.content).toContain('[1](https://alpha.test/a)');
        expect(note.content).toContain('[2](https://beta.test/b)');
    });

    it('uses the title and tag the user chose', async () => {
        await reviewAlphaAndBeta();
        fireEvent.change(screen.getByRole('textbox', { name: 'Note title' }), { target: { value: 'Exam prep' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'Tag "study"' }));
        fireEvent.click(screen.getByRole('button', { name: 'Create note' }));

        const [note] = useBoardStore.getState().notes;
        expect(note.title).toBe('Exam prep');
        expect(note.content.startsWith('# Exam prep\n')).toBe(true);
        expect(note.tags).toEqual([]);
    });

    it('edits a point and removes a point; the note has the edited text and not the removed one', async () => {
        await reviewAlphaAndBeta();
        const first = screen.getByRole('textbox', { name: 'Point 1 of Alpha' });
        fireEvent.change(first, { target: { value: 'Edited: resolvers cache for the TTL.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Remove point 2 of Beta' }));
        expect(screen.queryByDisplayValue(/Beta describes how the zone sets/)).toBeNull();
        expect(screen.getByDisplayValue(/Beta warns that stale entries/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
        const [note] = useBoardStore.getState().notes;
        expect(note.content).toContain('- Edited: resolvers cache for the TTL.');
        expect(note.content).not.toContain('Alpha caches DNS answers');
        expect(note.content).not.toContain('Beta describes how the zone sets the negative cache time');
        expect(note.content).toContain('Beta explains that recursive resolvers');
    });

    it('removes a source: its section and its links leave the note', async () => {
        await reviewAlphaAndBeta();
        fireEvent.click(screen.getByRole('button', { name: 'Remove Beta from the note' }));
        expect(screen.queryByRole('region', { name: 'Source 2: Beta' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
        const [note] = useBoardStore.getState().notes;
        expect(note.content).not.toContain('Beta');
        expect(note.content).not.toContain('beta.test');
        expect(note.content).toContain('[1](https://alpha.test/a)');
    });

    it('Create note is off when every source was removed', async () => {
        await reviewAlphaAndBeta();
        fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha from the note' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove Beta from the note' }));
        expect(screen.getByRole('button', { name: 'Create note' })).toBeDisabled();
    });

    it('Open switches to a tab that is still on the same page and focuses its window', async () => {
        const { alpha } = await reviewAlphaAndBeta();
        const update = vi.mocked(chrome.tabs.update);
        const focus = vi.mocked(chrome.windows.update);
        fireEvent.click(screen.getByRole('button', { name: 'Open Alpha' }));
        await waitFor(() => expect(update).toHaveBeenCalledWith(alpha.id, { active: true }));
        expect(focus).toHaveBeenCalledWith(alpha.windowId, { focused: true });
        expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('Open opens the page again when the tab was closed', async () => {
        const { beta } = await reviewAlphaAndBeta();
        browser.tabs.delete(beta.id);
        fireEvent.click(screen.getByRole('button', { name: 'Open Beta' }));
        await waitFor(() => expect(chrome.tabs.create).toHaveBeenCalledWith({ url: BETA }));
    });

    it('Open opens the page again when the tab moved to another page', async () => {
        const { alpha } = await reviewAlphaAndBeta();
        alpha.url = 'https://elsewhere.test/';
        fireEvent.click(screen.getByRole('button', { name: 'Open Alpha' }));
        await waitFor(() => expect(chrome.tabs.create).toHaveBeenCalledWith({ url: ALPHA }));
        expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    it('Close discards the review and saves nothing', async () => {
        await reviewAlphaAndBeta();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(useBoardStore.getState().notes).toHaveLength(0);
        expect(state().status).toBe('idle');
    });
});

describe('TabNotesDialog: the page must not be trusted as markup', () => {
    it('renders a title that looks like HTML as text', async () => {
        browser.grantOrigins('https://alpha.test/*');
        browser.addTab({ url: ALPHA, title: '<img src=x onerror="alert(1)">Alpha' });
        openDialog();
        expect(await screen.findByText('<img src=x onerror="alert(1)">Alpha')).toBeInTheDocument();
        expect(document.querySelector('img[onerror]')).toBeNull();
    });
});

describe('TabNotesDialog: the Combined review', () => {
    const GAMMA = 'https://gamma.test/g';

    /** Three tabs: Alpha and Beta say the same thing about DNS caching (one conflict), Gamma says something else */
    const DNS_POINTS: KeyPoint[] = [
        {
            id: 'p1-1',
            sourceRef: 1,
            text: 'The default TTL for a cached DNS answer is 300 seconds in most resolvers.',
            topicHint: '',
        },
        { id: 'p1-2', sourceRef: 1, text: 'Resolvers keep each answer until its TTL runs out.', topicHint: '' },
        {
            id: 'p2-1',
            sourceRef: 2,
            text: 'The default TTL for a cached DNS answer is 3600 seconds in most resolvers.',
            topicHint: '',
        },
        { id: 'p2-2', sourceRef: 2, text: 'Resolvers keep each answer until its TTL runs out.', topicHint: '' },
        { id: 'p3-1', sourceRef: 3, text: 'fetch() returns a promise that resolves to the response.', topicHint: '' },
    ];

    const sourceOf = (ref: number, title: string, url: string, tabId: number): NoteSource => ({
        ref,
        tabId,
        windowId: 1,
        title,
        url,
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    });

    /** Puts a finished run (sources and points, grouped as the store does it) in the store and opens the review */
    function openReviewOf(sources: NoteSource[], points: KeyPoint[]) {
        useTabNotesStore.setState({ status: 'done', sources, points, combined: groupTopics(points, sources) });
        return openDialog();
    }

    /** The three tabs of the review, created in the browser so that "Open" can find them */
    function threeSources() {
        const alpha = browser.addTab({ url: ALPHA, title: 'Alpha' });
        const beta = browser.addTab({ url: BETA, title: 'Beta' });
        const gamma = browser.addTab({ url: GAMMA, title: 'Gamma' });
        return [
            sourceOf(1, 'Alpha', ALPHA, alpha.id),
            sourceOf(2, 'Beta', BETA, beta.id),
            sourceOf(3, 'Gamma', GAMMA, gamma.id),
        ];
    }

    it('shows Combined by default: one card per shared topic, marked as grouped by words, with chips for its sources', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        expect(screen.getByRole('radio', { name: 'Combined' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Combined' })).toBeEnabled();
        expect(screen.getByRole('radio', { name: 'By tab' })).not.toBeChecked();

        expect(screen.getAllByText('grouped by shared words (no AI)').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: 'Open source 1: Alpha' })[0]).toHaveTextContent('(1)');
        expect(screen.getAllByRole('button', { name: 'Open source 2: Beta' })[0]).toHaveTextContent('(2)');
        // The pages' points are not repeated per tab: the shared bullet cites both pages
        expect(screen.queryByRole('region', { name: 'Source 1: Alpha' })).toBeNull();
    });

    it('shows a conflict as a ⚠ row that names both pages', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        const row = screen.getByText(/Sources differ:/).closest('p');
        expect(row).not.toBeNull();
        expect(row).toHaveTextContent('300 seconds');
        expect(row).toHaveTextContent('3600 seconds');
        expect(within(row as HTMLElement).getByRole('button', { name: 'Open source 2: Beta' })).toBeInTheDocument();
    });

    it('puts what only one tab says under "Only in one source"', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        const group = screen.getByRole('region', { name: 'Only in one source' });
        expect(within(group).getByText('fetch() returns a promise that resolves to the response.')).toBeInTheDocument();
        expect(within(group).getByRole('button', { name: 'Open source 3: Gamma' })).toBeInTheDocument();
    });

    it('lists every source that the note cites, with Open and Remove source', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        const list = screen.getByRole('region', { name: 'Sources' });
        expect(within(list).getByText('[1]')).toBeInTheDocument();
        expect(within(list).getByRole('button', { name: 'Open Gamma' })).toBeInTheDocument();
        expect(within(list).getByRole('button', { name: 'Remove Gamma from the note' })).toBeInTheDocument();
    });

    it('a chip opens its source like the Open button: the tab is focused', async () => {
        const sources = threeSources();
        openReviewOf(sources, DNS_POINTS);
        fireEvent.click(screen.getAllByRole('button', { name: 'Open source 1: Alpha' })[0]);
        await waitFor(() => expect(chrome.tabs.update).toHaveBeenCalledWith(sources[0].tabId, { active: true }));
        expect(chrome.windows.update).toHaveBeenCalledWith(sources[0].windowId, { focused: true });
        expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('a chip opens the page again when its tab was closed', async () => {
        const sources = threeSources();
        browser.tabs.delete(sources[1].tabId);
        openReviewOf(sources, DNS_POINTS);
        fireEvent.click(screen.getAllByRole('button', { name: 'Open source 2: Beta' })[0]);
        await waitFor(() => expect(chrome.tabs.create).toHaveBeenCalledWith({ url: BETA }));
    });

    it('switches to By tab and back, and keeps a point edit made in By tab', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        fireEvent.click(screen.getByRole('radio', { name: 'By tab' }));
        expect(screen.getByRole('radio', { name: 'By tab' })).toBeChecked();
        expect(screen.getByRole('region', { name: 'Source 1: Alpha' })).toBeInTheDocument();
        expect(screen.queryByText('grouped by shared words (no AI)')).toBeNull();

        fireEvent.change(screen.getByRole('textbox', { name: 'Point 1 of Alpha' }), {
            target: { value: 'Edited in By tab.' },
        });
        fireEvent.click(screen.getByRole('radio', { name: 'Combined' }));
        expect(screen.getByRole('radio', { name: 'Combined' })).toBeChecked();
        expect(screen.getAllByText('grouped by shared words (no AI)').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('radio', { name: 'By tab' }));
        expect(screen.getByDisplayValue('Edited in By tab.')).toBeInTheDocument();
    });

    it('Create note saves the Combined layout when it is on screen', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        fireEvent.click(screen.getByRole('button', { name: 'Create note' }));

        const [note] = useBoardStore.getState().notes;
        expect(note.content).toContain('## ');
        expect(note.content).toContain('> Sources differ: [1](https://alpha.test/a) says');
        expect(note.content).toContain('## Only in one source');
        expect(note.content).not.toMatch(/## Alpha \(\[1\]/);
    });

    it('Create note saves the By tab layout when it is on screen', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        fireEvent.click(screen.getByRole('radio', { name: 'By tab' }));
        fireEvent.click(screen.getByRole('button', { name: 'Create note' }));

        const [note] = useBoardStore.getState().notes;
        expect(note.content).toContain('## Alpha ([1](https://alpha.test/a))');
        expect(note.content).toContain('## Gamma ([3](https://gamma.test/g))');
        expect(note.content).not.toContain('Sources differ');
        expect(note.content).not.toContain('## Only in one source');
    });

    it('removing a source takes its points out of both views', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        fireEvent.click(screen.getByRole('button', { name: 'Remove Gamma from the note' }));
        expect(screen.queryByRole('region', { name: 'Only in one source' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Open source 3: Gamma' })).toBeNull();

        fireEvent.click(screen.getByRole('radio', { name: 'By tab' }));
        expect(screen.queryByRole('region', { name: 'Source 3: Gamma' })).toBeNull();
        expect(screen.queryByDisplayValue(/fetch\(\) returns a promise/)).toBeNull();
    });

    it('removing a source that leaves one tab turns Combined off, with the reason', () => {
        openReviewOf(threeSources(), DNS_POINTS);
        fireEvent.click(screen.getByRole('button', { name: 'Remove Beta from the note' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove Gamma from the note' }));

        expect(screen.getByRole('radio', { name: 'Combined' })).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'By tab' })).toBeChecked();
        expect(screen.getByText('Nothing to combine with one page')).toBeInTheDocument();
    });

    it('with one tab, By tab is the only layout and Combined is disabled', () => {
        const [alpha] = threeSources();
        openReviewOf(
            [alpha],
            DNS_POINTS.filter(point => point.sourceRef === 1)
        );
        expect(screen.getByRole('radio', { name: 'Combined' })).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'By tab' })).toBeChecked();
        expect(screen.getByText('Nothing to combine with one page')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Source 1: Alpha' })).toBeInTheDocument();
    });

    it('when no tabs share a topic, By tab is shown with the reason, and Combined is disabled', () => {
        const [alpha, , gamma] = threeSources();
        const unrelated: KeyPoint[] = [
            { id: 'p1-1', sourceRef: 1, text: 'Cats sleep for most of the day in warm houses.', topicHint: '' },
            {
                id: 'p3-1',
                sourceRef: 3,
                text: 'fetch() returns a promise that resolves to the response.',
                topicHint: '',
            },
        ];
        openReviewOf([alpha, gamma], unrelated);
        expect(screen.getByRole('radio', { name: 'Combined' })).toBeDisabled();
        expect(screen.getByRole('radio', { name: 'By tab' })).toBeChecked();
        expect(screen.getByText("These tabs don't share a topic, so each has its own section.")).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Source 3: Gamma' })).toBeInTheDocument();
    });
});
