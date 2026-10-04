import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import AnalyticsDashboard from '../AnalyticsDashboard';
import ContextStatsWidget from '../components/ContextStatsWidget';
import { useBoardStore } from '../../../store/boardStore';
import { makeSession, makeTab, makeTask } from '../../../test/factories';

const section = (heading: RegExp) =>
    screen.getByRole('heading', { name: heading }).closest<HTMLElement>('.analytics-section')!;

describe('AnalyticsDashboard', () => {
    beforeEach(() => {
        useBoardStore.setState({ tabs: [], tasks: [], notes: [], sessions: [], history: [] });
    });

    it('shows empty states when there is no data', () => {
        render(<AnalyticsDashboard />);
        expect(screen.getByText('No domain data available')).toBeInTheDocument();
        expect(screen.getByText('No focus sessions recorded on tasks yet.')).toBeInTheDocument();
        expect(within(section(/Task Progress/)).getByText('0%')).toBeInTheDocument();
        expect(within(section(/Session Statistics/)).getByText('0m')).toBeInTheDocument();
    });

    it('ranks domains, strips only a leading "www." and skips invalid URLs', () => {
        useBoardStore.setState({
            tabs: [
                makeTab({ id: 'a', url: 'https://github.com/x' }),
                makeTab({ id: 'b', url: 'https://www.github.com/y' }),
                makeTab({ id: 'c', url: 'https://awww.example.com/' }),
                makeTab({ id: 'd', url: 'not a url' }),
            ],
            history: [{ id: 'h', url: 'https://github.com/z', title: 'Z', createdAt: '2026-10-01T00:00:00.000Z' }],
        });
        render(<AnalyticsDashboard />);
        const domains = within(section(/Most Visited Domains/));
        const names = domains.getAllByText(/\./, { selector: '.domain-name' }).map(e => e.textContent);
        expect(names).toEqual(['github.com', 'awww.example.com']);
        expect(domains.getAllByText(/^\d+$/, { selector: '.domain-count' }).map(e => e.textContent)).toEqual([
            '3',
            '1',
        ]);
    });

    it('turns Pomodoro sessions on tasks into focus time', () => {
        useBoardStore.setState({
            tasks: [
                makeTask({ id: 'm', title: 'Quick fix', completedSessions: 1 }),
                makeTask({ id: 'h', title: 'Pricing page', completedSessions: 3 }),
                makeTask({ id: 'd', title: 'Big launch', completedSessions: 20, status: 'done' }),
                makeTask({ id: 'n', title: 'Untouched' }),
            ],
        });
        render(<AnalyticsDashboard />);
        const focus = within(section(/Task Focus Metrics/));
        expect(focus.getAllByText(/./, { selector: '.domain-name' }).map(e => e.textContent)).toEqual([
            'Big launch',
            'Pricing page',
            'Quick fix',
        ]);
        expect(focus.getByText('1.0 days')).toBeInTheDocument(); // 20 × 25 min = 500 min
        expect(focus.getByText('1.3 hrs')).toBeInTheDocument(); // 75 min
        expect(focus.getByText('25 mins')).toBeInTheDocument();
        expect(within(section(/Task Progress/)).getByText('25%')).toBeInTheDocument();
    });

    it('averages the duration of ended sessions', () => {
        useBoardStore.setState({
            sessions: [
                makeSession({ id: 's1', startTime: '2026-10-03T08:00:00Z', endTime: '2026-10-03T09:00:00Z' }),
                makeSession({ id: 's2', startTime: '2026-10-03T10:00:00Z', endTime: '2026-10-03T12:00:00Z' }),
                makeSession({ id: 's3', startTime: '2026-10-03T13:00:00Z', endTime: undefined }), // still running
            ],
        });
        render(<AnalyticsDashboard />);
        expect(within(section(/Session Statistics/)).getByText('1h 30m')).toBeInTheDocument();
    });
});

describe('ContextStatsWidget', () => {
    const base = { parks: 0, resumes: 0, tabsFreed: 0, averageParkedMs: null, currentlyParked: 0 };

    it('explains the feature when there is no activity', () => {
        render(<ContextStatsWidget stats={base} />);
        expect(screen.getByText(/Start a task to give it its own tabs/)).toBeInTheDocument();
    });

    it('uses singular wording for one of each', () => {
        render(<ContextStatsWidget stats={{ ...base, parks: 1, resumes: 1, tabsFreed: 1, currentlyParked: 1 }} />);
        expect(screen.getByText(/You resumed 1 context this week/)).toHaveTextContent(
            'You resumed 1 context this week and closed 1 tab without losing them.'
        );
        expect(screen.getByText(/1 task is parked/)).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument(); // no average yet
    });

    it('uses plural wording and hides what is zero', () => {
        render(<ContextStatsWidget stats={{ ...base, parks: 3, resumes: 2, averageParkedMs: 90 * 60_000 }} />);
        expect(screen.getByText(/You resumed 2 contexts this week/)).toHaveTextContent(
            'You resumed 2 contexts this week.'
        );
        expect(screen.queryByText(/are parked/)).toBeNull();
        expect(screen.queryByText('—')).toBeNull();
    });

    it('says "tasks are" when several are parked', () => {
        render(<ContextStatsWidget stats={{ ...base, currentlyParked: 2, tabsFreed: 5 }} />);
        expect(screen.getByText(/2 tasks are parked/)).toBeInTheDocument();
        expect(screen.getByText(/closed 5 tabs without losing them/)).toBeInTheDocument();
    });
});
