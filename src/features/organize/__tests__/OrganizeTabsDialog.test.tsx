import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizeTabsDialog from '../components/OrganizeTabsDialog';
import QuickActions from '../../today/components/QuickActions';
import { useOrganizeStore } from '../store/organizeStore';
import { AiError } from '../../ai/types';
import { OrganizableTab } from '../../ai/types';
import { GroupProposal } from '../types';

const tabs: OrganizableTab[] = Array.from({ length: 6 }, (_, i) => ({
    id: 101 + i,
    windowId: 1,
    title: `Tab ${i + 1}`,
    url: `https://site${i}.dev/page?secret=1`,
    favicon: i === 0 ? 'f.png' : undefined,
}));

const proposal = (overrides: Partial<GroupProposal> = {}): GroupProposal => ({
    source: 'ai',
    groups: [
        { key: 'g1', name: 'Pricing', color: 'red', tabIds: [101, 102], enabled: true },
        { key: 'g2', name: 'React', color: 'blue', tabIds: [103, 104], enabled: true },
        { key: 'g3', name: 'Trip', color: 'green', tabIds: [105, 106], enabled: true },
    ],
    ungroupedTabIds: [],
    omittedTabIds: [],
    ...overrides,
});

function Location() {
    return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderDialog() {
    return render(
        <MemoryRouter initialEntries={['/today']}>
            <Routes>
                <Route
                    path="*"
                    element={
                        <>
                            <OrganizeTabsDialog />
                            <Location />
                        </>
                    }
                />
            </Routes>
        </MemoryRouter>
    );
}

const setState = (partial: Partial<ReturnType<typeof useOrganizeStore.getState>>) =>
    act(() => useOrganizeStore.setState(partial));

describe('OrganizeTabsDialog', () => {
    beforeEach(() => {
        useOrganizeStore.getState().actions.close();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('renders nothing when closed and keeps the store environment current', async () => {
        vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available') });
        renderDialog();
        expect(screen.queryByRole('dialog')).toBeNull();
        await vi.waitFor(() => expect(useOrganizeStore.getState().availability).toBe('available'));
        expect(useOrganizeStore.getState().aiEnabled).toBe(true);
    });

    it('loading: says what is happening, with download progress, and cancels', () => {
        renderDialog();
        setState({ phase: 'loading', loadingStep: 'reading' });
        expect(screen.getByRole('dialog', { name: 'Organize tabs' })).toBeInTheDocument();
        expect(screen.getByText('Looking at your tabs…')).toBeInTheDocument();

        setState({ loadingStep: 'downloading', downloadProgress: 0.42 });
        expect(screen.getByText('Getting the on-device AI ready…')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Downloading on-device AI model… 42%');

        setState({ loadingStep: 'thinking', downloadProgress: null, tabs });
        expect(screen.getByText('Sorting 6 tabs on your computer…')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(useOrganizeStore.getState().phase).toBe('closed');
    });

    it('closes from the backdrop only while loading or on error', () => {
        renderDialog();
        setState({ phase: 'loading' });
        fireEvent.click(document.querySelector('.organize-overlay')!);
        expect(useOrganizeStore.getState().phase).toBe('closed');

        setState({ phase: 'preview', tabs, proposal: proposal(), windowId: 1 });
        fireEvent.click(document.querySelector('.organize-overlay')!);
        expect(useOrganizeStore.getState().phase).toBe('preview');
        fireEvent.click(screen.getByRole('dialog')); // clicks inside never close
        expect(useOrganizeStore.getState().phase).toBe('preview');
    });

    it('preview: groups, badge, names, short URLs and the create button', () => {
        renderDialog();
        setState({ phase: 'preview', tabs, proposal: proposal(), windowId: 1 });
        expect(screen.getByRole('dialog', { name: 'Organize 6 tabs' })).toBeInTheDocument();
        expect(screen.getByText('✨ Suggested by on-device AI')).toBeInTheDocument();
        expect(screen.getAllByRole('textbox', { name: 'Group name' }).map(i => (i as HTMLInputElement).value)).toEqual([
            'Pricing',
            'React',
            'Trip',
        ]);
        expect(screen.getByText('site0.dev/page')).toBeInTheDocument(); // no query string
        expect(screen.getByRole('button', { name: 'Colour: red. Change colour' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create 3 groups' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Group by site instead' })).toBeInTheDocument();

        for (const box of screen.getAllByRole('checkbox', { name: /^Create group/ })) fireEvent.click(box);
        expect(screen.getByRole('button', { name: 'Create groups' })).toBeDisabled();
    });

    it('preview edits go through the store; a group under 2 tabs says so', () => {
        renderDialog();
        setState({ phase: 'preview', tabs, proposal: proposal(), windowId: 1 });
        fireEvent.change(screen.getAllByRole('textbox', { name: 'Group name' })[0], { target: { value: 'Prices' } });
        fireEvent.click(screen.getByRole('button', { name: 'Colour: blue. Change colour' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove Tab 1 from Prices' }));
        const first = useOrganizeStore.getState().proposal!.groups[0];
        expect(first).toMatchObject({ name: 'Prices', tabIds: [102], enabled: false });
        expect(screen.getByText('Needs at least 2 tabs')).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Create group Prices' })).toBeDisabled();
        expect(screen.getByText('Not grouped (1)')).toBeInTheDocument();
        expect(useOrganizeStore.getState().proposal!.groups[1].color).toBe('red');

        fireEvent.click(screen.getByText('Collapse groups after creating'));
        expect(useOrganizeStore.getState().collapseAfter).toBe(true);
    });

    it('collapses tab lists when there are more than 4 groups, and expands on click', () => {
        renderDialog();
        const groups = Array.from({ length: 5 }, (_, i) => ({
            key: `g${i + 1}`,
            name: `G${i}`,
            color: 'blue' as const,
            tabIds: [101 + (i % 6), 102 + (i % 5)],
            enabled: true,
        }));
        setState({ phase: 'preview', tabs, proposal: proposal({ groups }), windowId: 1 });
        expect(screen.queryByText('Tab 1')).toBeNull();
        fireEvent.click(screen.getAllByRole('button', { name: /2 tabs ▸/ })[0]);
        expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('site source: badge, empty note, and "Try with AI" only when AI can run', async () => {
        vi.stubGlobal('LanguageModel', { availability: vi.fn().mockResolvedValue('available') });
        renderDialog();
        setState({
            phase: 'preview',
            tabs,
            proposal: proposal({ source: 'site', groups: [], ungroupedTabIds: [101, 102] }),
            windowId: 1,
        });
        expect(screen.getByText('Grouped by site')).toBeInTheDocument();
        expect(screen.getByText(/No two tabs share a site/)).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Try with AI' })).toBeInTheDocument();
    });

    it('notes tabs left out of the model input', () => {
        renderDialog();
        setState({ phase: 'preview', tabs, proposal: proposal({ omittedTabIds: [107, 108, 109] }), windowId: 1 });
        expect(screen.getByText(/3 tabs on the right weren't included/)).toBeInTheDocument();
    });

    it('applying: everything disabled and Esc does nothing', () => {
        renderDialog();
        setState({ phase: 'applying', tabs, proposal: proposal(), windowId: 1 });
        expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(useOrganizeStore.getState().phase).toBe('applying');
    });

    it('Esc closes the preview', () => {
        renderDialog();
        setState({ phase: 'preview', tabs, proposal: proposal(), windowId: 1 });
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(useOrganizeStore.getState().phase).toBe('preview');
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(useOrganizeStore.getState().phase).toBe('closed');
    });

    it('error: message, retry only for retryable errors, and the site fallback', () => {
        renderDialog();
        setState({ phase: 'error', tabs, error: new AiError('timeout', 'x') });
        expect(screen.getByText('⚠ The on-device AI took too long. Try again.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

        setState({ error: new AiError('too-large', 'x') });
        expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Group by site instead' }));
        expect(useOrganizeStore.getState().proposal!.source).toBe('site');

        setState({ phase: 'error', error: new Error('boom') });
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(useOrganizeStore.getState().phase).toBe('closed');
    });

    it('done: summary with plurals, skipped note, save to Boards then open them', () => {
        const save = vi.spyOn(useOrganizeStore.getState().actions, 'saveToBoards');
        renderDialog();
        setState({
            phase: 'done',
            tabs,
            created: [{ groupId: 1, title: 'Pair', color: 'green', tabIds: [101, 102] }],
            skippedTabIds: [103],
        });
        expect(screen.getByRole('dialog', { name: 'Organized' })).toBeInTheDocument();
        expect(screen.getByText('✓ Created 1 group with 2 tabs.')).toBeInTheDocument();
        expect(screen.getByText('Pair (2)')).toBeInTheDocument();
        expect(screen.getByText('⚠ 1 tab was skipped because it closed or moved.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save to Boards' }));
        expect(save).toHaveBeenCalled();
        setState({ savedToBoards: true, skippedTabIds: [103, 104] });
        expect(screen.getByText('⚠ 2 tabs were skipped because they closed or moved.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Open Boards' }));
        expect(screen.getByTestId('location')).toHaveTextContent('/boards');
        expect(useOrganizeStore.getState().phase).toBe('closed');
    });

    it('done with nothing created: only Done', () => {
        renderDialog();
        setState({ phase: 'done', tabs, created: [], skippedTabIds: [] });
        expect(screen.getByText('No groups were created: the tabs closed or moved.')).toBeInTheDocument();
        const footer = document.querySelector('.organize-actions') as HTMLElement;
        expect(
            within(footer)
                .getAllByRole('button')
                .map(b => b.textContent)
        ).toEqual(['Done']);
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(useOrganizeStore.getState().phase).toBe('closed');
    });

    it('starts from the Today quick action', () => {
        const start = vi
            .spyOn(useOrganizeStore.getState().actions, 'startOrganize')
            .mockImplementation(() => undefined);
        render(
            <MemoryRouter>
                <QuickActions />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: /Organize tabs/ }));
        expect(start).toHaveBeenCalled();
    });
});
