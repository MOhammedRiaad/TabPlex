import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TaskFromTabsDialog from '../components/TaskFromTabsDialog';
import { useTaskDraftStore } from '../store/taskDraftStore';
import { useBoardStore } from '../../../store/boardStore';
import { AiError, OrganizableTab } from '../../ai/types';
import { DraftStep } from '../types';
import { makeContext, makeTask } from '../../../test/factories';
import { respondToMessages } from '../../../test/chromeMock';

const tabs: OrganizableTab[] = [
    { id: 1, windowId: 1, title: 'Stripe pricing', url: 'https://stripe.com/pricing?x=1', favicon: 'f.png' },
    { id: 2, windowId: 1, title: 'Paddle | Pricing', url: 'https://www.paddle.com/pricing' },
    { id: 3, windowId: 1, title: 'YouTube', url: 'https://youtube.com/watch' },
];

const steps = (texts: string[]): DraftStep[] => texts.map((text, i) => ({ key: `s${i}`, text, included: true }));

const ready = {
    phase: 'ready' as const,
    tabs,
    checkedIds: [1, 2, 3],
    draftedIds: [1, 2, 3],
    title: 'Compare Stripe and Paddle pricing',
    description: 'Decide which provider to use.',
    priority: 'high' as const,
    steps: steps(['Compare fees', 'Check VAT']),
    source: 'ai' as const,
};

const setState = (partial: Partial<ReturnType<typeof useTaskDraftStore.getState>>) =>
    act(() => useTaskDraftStore.setState(partial));

/** Make the dialog believe the on-device model can run */
function withAi() {
    vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available'), create: vi.fn() });
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('TaskFromTabsDialog', () => {
    beforeEach(() => {
        useTaskDraftStore.getState().actions.cancel();
        useBoardStore.setState({ tasks: [] });
        respondToMessages();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('renders nothing when closed', () => {
        render(<TaskFromTabsDialog />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('1: drafting shows skeletons and progress; only Cancel works', async () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, phase: 'drafting', title: '', downloadProgress: 0.4 });
        expect(screen.getByRole('dialog', { name: 'New task from tabs' })).toBeInTheDocument();
        expect(screen.getByText('Drafting…')).toBeInTheDocument();
        expect(screen.getByText('Drafting from 3 tabs…')).toHaveAttribute('role', 'status');
        expect(document.querySelector('.task-from-tabs-body')).toHaveTextContent('40%'); // download progress
        expect(document.querySelector('.task-from-tabs-fields')).toHaveClass('is-drafting');
        expect(screen.getByRole('textbox', { name: 'Task title' })).toBeDisabled();
        expect(button('Create task')).toBeDisabled();
        expect(button('▶ Create & start')).toBeDisabled();
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'New task from tabs' }));

        fireEvent.click(button('Cancel'));
        expect(useTaskDraftStore.getState().phase).toBe('closed');
    });

    it('2: ready shows the draft, and the tab count follows the checkboxes', async () => {
        render(<TaskFromTabsDialog />);
        setState(ready);
        expect(screen.getByText('✨ Drafted on your device')).toBeInTheDocument();
        const title = screen.getByRole('textbox', { name: 'Task title' });
        expect(title).toHaveValue('Compare Stripe and Paddle pricing');
        await waitFor(() => expect(document.activeElement).toBe(title));
        expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
        expect(screen.getByRole('textbox', { name: 'Step 1' })).toHaveValue('Compare fees');
        expect(screen.getByText('stripe.com/pricing')).toBeInTheDocument(); // short URL, no query

        fireEvent.click(screen.getByRole('checkbox', { name: 'Include YouTube' }));
        expect(screen.getByText('Tabs (2 of 3)')).toBeInTheDocument();

        fireEvent.change(screen.getByRole('textbox', { name: 'Task title' }), { target: { value: 'New title' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Low' }));
        expect(useTaskDraftStore.getState()).toMatchObject({ title: 'New title', priority: 'low', dirty: true });
    });

    it('3: an empty title disables both create buttons', () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, title: '  ' });
        expect(button('Create task')).toBeDisabled();
        expect(button('▶ Create & start')).toBeDisabled();
    });

    it('4: steps can be edited, excluded and removed; "+ Add step" hides at 5', () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, steps: steps(['A step', 'B step', 'C step', 'D step']) });
        fireEvent.click(button('+ Add step'));
        expect(useTaskDraftStore.getState().steps).toHaveLength(5);
        expect(screen.queryByRole('button', { name: '+ Add step' })).toBeNull();

        fireEvent.click(button('Remove step 2'));
        expect(useTaskDraftStore.getState().steps.map(s => s.text)).toEqual(['A step', 'C step', 'D step', '']);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Include step 1' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Step 2' }), { target: { value: 'Changed' } });
        expect(useTaskDraftStore.getState().steps.slice(0, 2)).toMatchObject([
            { text: 'A step', included: false },
            { text: 'Changed', included: true },
        ]);
    });

    it('5: warns that starting parks the active task, only when there is one', () => {
        render(<TaskFromTabsDialog />);
        setState(ready);
        expect(screen.queryByText(/Starting this task will park/)).toBeNull();
        act(() =>
            useBoardStore.setState({
                tasks: [makeTask({ title: 'Plan offsite', context: makeContext({ state: 'active' }) })],
            })
        );
        expect(screen.getByText('ⓘ Starting this task will park “Plan offsite”.')).toBeInTheDocument();
    });

    it('6: hint and Draft again only when AI can be used', async () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, source: 'fallback' });
        expect(screen.queryByRole('button', { name: /Draft again/ })).toBeNull();
        expect(screen.queryByText('✨ Drafted on your device')).toBeNull();

        withAi();
        // Availability is re-checked when the window regains focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });
        await waitFor(() => expect(button('↻ Draft again')).toBeInTheDocument());
        fireEvent.change(screen.getByPlaceholderText('e.g. "for the Q4 launch"'), {
            target: { value: 'for the launch' },
        });
        expect(useTaskDraftStore.getState().hint).toBe('for the launch');
    });

    it('7: Draft again says when the tabs changed', async () => {
        withAi();
        render(<TaskFromTabsDialog />);
        setState(ready);
        await waitFor(() => expect(button('↻ Draft again')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('checkbox', { name: 'Include YouTube' }));
        expect(button('↻ Draft again (tabs changed)')).toHaveClass('has-dot');
    });

    it('8: error shows the note, keeps the fields and still allows Create', () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, phase: 'error', source: 'fallback', error: new AiError('timeout', 'slow') });
        expect(screen.getByRole('alert')).toHaveTextContent(
            'The on-device AI took too long. Try again. You can edit the task yourself.'
        );
        expect(button('Create task')).toBeEnabled();
    });

    it('notes a draft based on fewer tabs, and collapses long tab lists', () => {
        render(<TaskFromTabsDialog />);
        const many = Array.from({ length: 9 }, (_, i) => ({ ...tabs[0], id: 10 + i, title: `Tab ${i}` }));
        setState({ ...ready, tabs: many, checkedIds: many.map(t => t.id), trimmedTo: 5 });
        expect(screen.getByText('ⓘ The draft is based on the first 5 tabs.')).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Include Tab 0' })).toBeNull();
        fireEvent.click(button('▸ show'));
        expect(screen.getByRole('checkbox', { name: 'Include Tab 0' })).toBeInTheDocument();
        fireEvent.click(button('▾ hide'));
        expect(screen.queryByRole('checkbox', { name: 'Include Tab 0' })).toBeNull();
    });

    it('shows a globe when a favicon fails to load', () => {
        render(<TaskFromTabsDialog />);
        setState(ready);
        const img = document.querySelector('img.task-from-tabs-favicon') as HTMLImageElement;
        fireEvent.error(img);
        expect(screen.getAllByText('🌐').length).toBeGreaterThan(0);
    });

    it('9: Esc cancels, but not while creating', () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, phase: 'creating' });
        expect(button('Cancel')).toBeDisabled();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(useTaskDraftStore.getState().phase).toBe('creating');

        setState({ phase: 'ready' });
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(useTaskDraftStore.getState().phase).toBe('ready');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(useTaskDraftStore.getState().phase).toBe('closed');
    });

    it('create buttons run the create hook and show their busy label', async () => {
        render(<TaskFromTabsDialog />);
        setState(ready);
        fireEvent.click(button('▶ Create & start'));
        expect(button('Starting…')).toBeDisabled();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        setState(ready);
        fireEvent.click(button('Create task'));
        expect(button('Creating…')).toBeDisabled();
        await waitFor(() => expect(useTaskDraftStore.getState().phase).toBe('closed'));
        expect(useBoardStore.getState().tasks.map(t => t.title)).toEqual([
            'Compare Stripe and Paddle pricing',
            'Compare Stripe and Paddle pricing',
        ]);
    });

    it('Create & park needs a checked tab, and shows its busy label', async () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, checkedIds: [] });
        expect(button('⏸ Create & park')).toBeDisabled();
        expect(button('⏸ Create & park')).toHaveAttribute('title', expect.stringContaining('close them'));

        setState({ checkedIds: [1, 2] });
        fireEvent.click(button('⏸ Create & park'));
        expect(button('Parking…')).toBeDisabled();
        await waitFor(() => expect(useTaskDraftStore.getState().phase).toBe('closed'));
    });

    it('hides the download line at 100% (the model was already installed)', () => {
        render(<TaskFromTabsDialog />);
        setState({ ...ready, phase: 'drafting', downloadProgress: 1 });
        expect(document.querySelector('.task-from-tabs-body')).not.toHaveTextContent('Downloading');
    });

    it('gives focus back to the button that opened it', async () => {
        render(
            <>
                <button type="button">Opener</button>
                <TaskFromTabsDialog />
            </>
        );
        const opener = screen.getByRole('button', { name: 'Opener' });
        opener.focus();
        setState(ready);
        await waitFor(() => expect(screen.getByRole('textbox', { name: 'Task title' })).toHaveFocus());
        fireEvent.click(button('Cancel'));
        expect(opener).toHaveFocus();
    });
});
