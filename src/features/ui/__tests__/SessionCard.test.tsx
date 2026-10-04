import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionCard from '../components/SessionCard';
import { makeSession } from '../../../test/factories';
import { Session } from '../../../types';

const NOW = new Date('2026-10-03T12:00:00');

function renderCard(session: Session) {
    const handlers = { onRestore: vi.fn(), onEnd: vi.fn(), onDelete: vi.fn() };
    const utils = render(<SessionCard session={session} {...handlers} />);
    return { ...handlers, ...utils };
}

const menu = () => screen.getByRole('menu', { name: 'Session actions' });

describe('SessionCard', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it('shows an active session with its tab count and summary', () => {
        renderCard(
            makeSession({ name: 'Research', tabIds: ['a', 'b', 'c'], endTime: undefined, summary: 'Pricing pages' })
        );
        expect(screen.getByRole('heading', { name: 'Research' })).toBeInTheDocument();
        expect(screen.getByLabelText('Active session')).toBeInTheDocument();
        expect(screen.getByLabelText('3 tabs')).toHaveTextContent('3');
        expect(screen.getByLabelText('Session summary')).toHaveTextContent('Pricing pages');
        expect(screen.queryByText('Duration')).toBeNull();
    });

    it('shows when an ended session ran and for how long', () => {
        renderCard(
            makeSession({
                tabIds: ['a'],
                startTime: '2026-10-03T09:00:00',
                endTime: '2026-10-03T10:30:00',
                summary: undefined,
            })
        );
        expect(screen.getByLabelText('Ended session')).toBeInTheDocument();
        expect(screen.getByLabelText('1 tab')).toBeInTheDocument();
        expect(screen.getByLabelText('Session duration: 1h 30m')).toBeInTheDocument();
        expect(screen.queryByLabelText('Session summary')).toBeNull();
        // Ended sessions can't be ended again
        expect(screen.queryByRole('button', { name: 'End session' })).toBeNull();
    });

    it.each([
        ['2026-10-03T09:00:00', '2026-10-03T09:45:00', '45m'],
        ['2026-10-03T08:00:00', '2026-10-03T10:00:00', '2h'],
    ])('formats a session from %s to %s as %s', (startTime, endTime, duration) => {
        renderCard(makeSession({ startTime, endTime }));
        expect(screen.getByLabelText(`Session duration: ${duration}`)).toBeInTheDocument();
    });

    it.each([
        ['2026-10-02T12:00:00', 'Yesterday'],
        ['2026-09-30T12:00:00', '3 days ago'],
        [
            '2026-09-01T12:00:00',
            new Date('2026-09-01T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }),
        ],
    ])('labels a start on %s as "%s"', (startTime, label) => {
        renderCard(makeSession({ startTime, endTime: undefined }));
        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('treats a session without tab ids as having no tabs', () => {
        renderCard({ ...makeSession(), tabIds: undefined as unknown as string[] });
        expect(screen.getByLabelText('0 tabs')).toBeInTheDocument();
    });

    it('restores and ends from the quick buttons', () => {
        const session = makeSession({ id: 's1', endTime: undefined });
        const { onRestore, onEnd } = renderCard(session);
        const quick = screen.getByRole('navigation', { name: 'Quick actions' });
        fireEvent.click(within(quick).getByRole('button', { name: 'Restore session tabs' }));
        expect(onRestore).toHaveBeenCalledWith(session);
        fireEvent.click(within(quick).getByRole('button', { name: 'End session' }));
        expect(onEnd).toHaveBeenCalledWith('s1');
    });

    it('uses the actions menu: restore, end, delete after confirming, close on outside click', () => {
        const confirm = vi.spyOn(window, 'confirm');
        const session = makeSession({ id: 's1', endTime: undefined });
        const { onRestore, onEnd, onDelete } = renderCard(session);
        const toggle = screen.getByRole('button', { name: 'Toggle actions menu' });

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Restore session tabs' }));
        expect(onRestore).toHaveBeenCalledWith(session);
        expect(screen.queryByRole('menu')).toBeNull();

        fireEvent.click(toggle);
        fireEvent.click(within(menu()).getByRole('menuitem', { name: 'End session' }));
        expect(onEnd).toHaveBeenCalledWith('s1');

        confirm.mockReturnValueOnce(false);
        fireEvent.click(toggle);
        fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Delete session' }));
        expect(onDelete).not.toHaveBeenCalled();

        confirm.mockReturnValueOnce(true);
        fireEvent.click(toggle);
        fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Delete session' }));
        expect(onDelete).toHaveBeenCalledWith('s1');

        fireEvent.click(toggle);
        fireEvent.mouseDown(within(menu()).getByRole('menuitem', { name: 'Restore session tabs' })); // inside: stays
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.mouseDown(document.body); // outside: closes
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
