import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SESSION_NAME_SCHEMA,
    buildSessionNameInput,
    fallbackSessionName,
    normalizeSessionName,
    suggestSessionName,
} from '../utils/sessionName';
import SessionCard from '../../ui/components/SessionCard';
import SessionsView from '../SessionsView';
import { useBoardStore } from '../../../store/boardStore';
import { respondToMessages } from '../../../test/chromeMock';
import { makeSession, makeTab } from '../../../test/factories';
import { AiSession } from '../../ai/utils/promptApi';

const MONDAY = new Date('2026-10-05T12:00:00');
const day = MONDAY.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function stubModel(answer = '{"name":"Q4 Pricing Research"}') {
    const session = { prompt: vi.fn().mockResolvedValue(answer), destroy: vi.fn() };
    const create = vi.fn().mockResolvedValue(session);
    vi.stubGlobal('LanguageModel', { create, availability: vi.fn().mockResolvedValue('available') });
    return { create, session };
}

describe('session names', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('fallback: the two most common sites, how many more, and the day', () => {
        const tabs = [
            'https://github.com/a',
            'https://docs.github.com/b',
            'https://www.google.com/x',
            'https://stripe.com/p',
            'https://paddle.com/p',
            'chrome://settings',
        ].map(url => ({ url }));
        expect(fallbackSessionName(tabs, MONDAY)).toBe(`github.com, google.com +2 more · ${day}`);
        expect(fallbackSessionName([{ url: 'https://a.dev/1' }, { url: 'https://a.dev/2' }], MONDAY)).toBe(
            `a.dev · ${day}`
        );
        expect(fallbackSessionName([{ url: 'chrome://newtab' }], MONDAY)).toBe(`Session · ${day}`);
        expect(fallbackSessionName([], MONDAY)).toBe(`Session · ${day}`);
    });

    it('AI: normalizes the answer, and the schema has no length cap', async () => {
        expect(JSON.stringify(SESSION_NAME_SCHEMA)).not.toContain('maxLength');
        expect(normalizeSessionName({ name: '  "Q4 Pricing."  ' })).toBe('Q4 Pricing');
        expect(normalizeSessionName({ name: 'x' })).toBeNull();
        expect(normalizeSessionName('text')).toBeNull();
        expect(normalizeSessionName({ name: 'n'.repeat(100) })).toHaveLength(60);
        expect(buildSessionNameInput([{ title: 'Stripe', url: 'https://stripe.com/p?q=1' }])).toBe(
            'Tabs:\n- Stripe (stripe.com/p)\n\nName this session.'
        );

        const prompt = vi.fn().mockResolvedValue('{"name":"Payments Research"}');
        const session = Promise.resolve({ prompt, destroy: vi.fn() } as unknown as AiSession);
        await expect(
            suggestSessionName(session, [
                { title: 'Stripe', url: 'https://stripe.com/p' },
                { title: 'Settings', url: 'chrome://settings' },
            ])
        ).resolves.toBe('Payments Research');
        expect(prompt.mock.calls[0][0]).not.toContain('chrome://');
    });
});

describe('SessionCard rename', () => {
    it('renames inline: Enter saves, Esc and unchanged names do nothing', () => {
        const onRename = vi.fn();
        const session = makeSession({ id: 's1', name: 'Old name' });
        render(
            <SessionCard session={session} onRestore={vi.fn()} onEnd={vi.fn()} onDelete={vi.fn()} onRename={onRename} />
        );
        const openMenu = () => fireEvent.click(screen.getByLabelText('Toggle actions menu'));

        openMenu();
        expect(screen.queryByRole('menuitem', { name: /Suggest a name/ })).toBeNull(); // no AI
        fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
        const input = screen.getByLabelText('Session name');
        expect(input).toHaveFocus();
        fireEvent.change(input, { target: { value: 'New name' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onRename).toHaveBeenCalledWith('s1', 'New name');

        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
        fireEvent.change(screen.getByLabelText('Session name'), { target: { value: 'Ignored' } });
        fireEvent.keyDown(screen.getByLabelText('Session name'), { key: 'Escape' });
        openMenu();
        fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
        fireEvent.blur(screen.getByLabelText('Session name')); // unchanged: no save
        expect(onRename).toHaveBeenCalledTimes(1);
    });

    it('suggests a name with AI, previewed until Enter', async () => {
        const onRename = vi.fn();
        let resolve: (name: string) => void = () => undefined;
        const onSuggestName = vi.fn(() => new Promise<string>(r => (resolve = r)));
        render(
            <SessionCard
                session={makeSession({ id: 's1', name: 'Old' })}
                onRestore={vi.fn()}
                onEnd={vi.fn()}
                onDelete={vi.fn()}
                onRename={onRename}
                onSuggestName={onSuggestName}
            />
        );
        fireEvent.click(screen.getByLabelText('Toggle actions menu'));
        fireEvent.click(screen.getByRole('menuitem', { name: /Suggest a name/ }));
        expect(screen.getByLabelText('Session name')).toHaveValue('Naming…');
        expect(screen.getByLabelText('Session name')).toBeDisabled();
        await act(async () => resolve('Payments Research'));
        expect(screen.getByLabelText('Session name')).toHaveValue('Payments Research');
        expect(onRename).not.toHaveBeenCalled();
        fireEvent.keyDown(screen.getByLabelText('Session name'), { key: 'Enter' });
        expect(onRename).toHaveBeenCalledWith('s1', 'Payments Research');
    });
});

describe('SessionsView naming', () => {
    beforeEach(() => {
        useBoardStore.setState({ sessions: [], tabs: [] });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('saves a session from the current tabs with the readable name, then the AI name', async () => {
        const { create, session } = stubModel();
        const received = respondToMessages(m => {
            if (m.type === 'GET_SESSIONS') return [];
            return { success: true };
        });
        await chrome.tabs.create({ url: 'https://stripe.com/pricing' });
        await chrome.tabs.create({ url: 'https://paddle.com/pricing' });
        render(<SessionsView />);
        // Wait for the model check, then save
        await waitFor(() => expect(screen.getByText(/Start Session from Current Tabs/)).toBeEnabled());
        await act(async () => {
            await new Promise(r => setTimeout(r, 0));
        });
        fireEvent.click(screen.getByText('Start Session from Current Tabs'));
        expect(create).toHaveBeenCalledTimes(1); // synchronously in the click

        await waitFor(() => expect(received.some(m => m.type === 'ADD_SESSION')).toBe(true));
        const added = received.find(m => m.type === 'ADD_SESSION')!.payload as { name: string };
        expect(added.name).toMatch(/^paddle\.com, stripe\.com · /);
        await waitFor(() =>
            expect(received.find(m => m.type === 'UPDATE_SESSION')?.payload).toMatchObject({
                name: 'Q4 Pricing Research',
            })
        );
        await waitFor(() => expect(session.destroy).toHaveBeenCalled());
    });

    it('without AI, keeps the readable name and offers only Rename', async () => {
        const received = respondToMessages(m => (m.type === 'GET_SESSIONS' ? [] : { success: true }));
        await chrome.tabs.create({ url: 'https://a.dev/1' });
        useBoardStore.setState({ tabs: [makeTab({ id: 'x' })] });
        render(<SessionsView />);
        fireEvent.click(screen.getByText('Start Session from Current Tabs'));
        await waitFor(() => expect(received.some(m => m.type === 'ADD_SESSION')).toBe(true));
        expect(received.some(m => m.type === 'UPDATE_SESSION')).toBe(false);
    });
});
