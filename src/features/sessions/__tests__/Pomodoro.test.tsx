import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PomodoroView from '../../pomodoro/PomodoroView';
import TimerManager from '../components/TimerManager';
import { useTimerStore } from '../../../store/timerStore';
import { useBoardStore } from '../../../store/boardStore';
import { makeTask } from '../../../test/factories';

const timer = () => useTimerStore.getState();
const settings = {
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 2,
    autoStartBreaks: false,
    autoStartWork: false,
    soundEnabled: true,
};

class FakeAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator = () => ({
        connect: vi.fn(),
        frequency: { setValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
    });
    createGain = () => ({ connect: vi.fn(), gain: { setValueAtTime: vi.fn() } });
    close = vi.fn();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    useTimerStore.setState({
        mode: 'work',
        activeMode: null,
        timeLeft: 25 * 60,
        isRunning: false,
        endTime: null,
        linkedTaskId: null,
        completedSessions: 0,
        remainingTime: { work: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
        settings,
    });
    useBoardStore.setState({
        tasks: [
            makeTask({ id: 'a', title: 'Focus task' }),
            makeTask({ id: 'b', title: 'Second', status: 'doing' }),
            makeTask({ id: 'c', title: 'Old', status: 'done' }),
        ],
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'granted', requestPermission: vi.fn() }));
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const renderView = () =>
    render(
        <MemoryRouter>
            <PomodoroView />
        </MemoryRouter>
    );

describe('PomodoroTimer', () => {
    it('starts, pauses, resets and switches modes', () => {
        renderView();
        expect(screen.getByText('25:00')).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Start/));
        expect(timer().isRunning).toBe(true);
        fireEvent.click(screen.getByText(/Pause/));
        expect(timer().isRunning).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: /Short Break/ }));
        expect(screen.getByText('05:00')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Long Break/ }));
        expect(screen.getByText('15:00')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Work$/ }));
        fireEvent.click(screen.getByText(/Reset/));
        expect(timer().timeLeft).toBe(25 * 60);
        fireEvent.click(screen.getByText('← Back to Today'));
    });

    it('asks for notification permission when starting', () => {
        vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission: vi.fn() }));
        renderView();
        fireEvent.click(screen.getByText(/Start/));
        expect(Notification.requestPermission).toHaveBeenCalled();
    });

    it('links, switches, completes and unlinks tasks', () => {
        renderView();
        fireEvent.click(screen.getByText(/Link a task|Link Task/i));
        expect(screen.queryByText('Old')).toBeNull();
        fireEvent.click(screen.getByText('Focus task'));
        expect(timer().linkedTaskId).toBe('a');
        expect(useBoardStore.getState().tasks[0].status).toBe('doing');
        fireEvent.click(screen.getByTitle('Switch task'));
        fireEvent.click(screen.getByText('Second'));
        expect(timer().linkedTaskId).toBe('b');
        fireEvent.click(screen.getByTitle('Mark as done'));
        expect(useBoardStore.getState().tasks[1].status).toBe('done');
        expect(timer().linkedTaskId).toBeNull();
        fireEvent.click(screen.getByText(/Link a task|Link Task/i));
        fireEvent.click(screen.getByText('✕'));
        act(() => timer().setLinkedTaskId('a'));
        fireEvent.click(screen.getByTitle('Unlink task'));
        expect(timer().linkedTaskId).toBeNull();
    });

    it('shows an empty task picker', () => {
        useBoardStore.setState({ tasks: [] });
        renderView();
        fireEvent.click(screen.getByText(/Link a task|Link Task/i));
        expect(screen.getByText(/No active tasks/i)).toBeInTheDocument();
    });

    it('edits settings', () => {
        renderView();
        fireEvent.click(screen.getByLabelText('Settings'));
        const [work, short, long, interval] = screen.getAllByRole('spinbutton');
        fireEvent.change(work, { target: { value: '50' } });
        fireEvent.change(short, { target: { value: '' } });
        fireEvent.change(long, { target: { value: '20' } });
        fireEvent.change(interval, { target: { value: '3' } });
        const [breaks, work2, sound] = screen.getAllByRole('checkbox');
        fireEvent.click(breaks);
        fireEvent.click(work2);
        fireEvent.click(sound);
        expect(timer().settings).toMatchObject({
            workDuration: 50,
            shortBreakDuration: 5,
            longBreakDuration: 20,
            longBreakInterval: 3,
            autoStartBreaks: true,
            autoStartWork: true,
            soundEnabled: false,
        });
    });
});

describe('TimerManager', () => {
    it('ticks, completes work sessions, credits the linked task and starts breaks', () => {
        useTimerStore.setState({ linkedTaskId: 'a', settings: { ...settings, autoStartBreaks: true } });
        render(<TimerManager />);
        act(() => timer().setIsRunning(true));
        act(() => vi.advanceTimersByTime(60_000));
        expect(timer().timeLeft).toBe(24 * 60);
        act(() => vi.advanceTimersByTime(24 * 60_000));
        expect(timer()).toMatchObject({ mode: 'shortBreak', completedSessions: 1, isRunning: true });
        expect(useBoardStore.getState().tasks[0].completedSessions).toBe(1);
        expect(Notification).toHaveBeenCalledWith('🍅 Work session complete!');
        act(() => vi.advanceTimersByTime(5 * 60_000 + 1000));
        expect(timer()).toMatchObject({ mode: 'work', isRunning: false });
        expect(Notification).toHaveBeenCalledWith('☕ Break is over!');
    });

    it('takes a long break after the interval and can auto-start work', () => {
        useTimerStore.setState({
            completedSessions: 1,
            settings: { ...settings, autoStartWork: true, soundEnabled: false },
        });
        render(<TimerManager />);
        act(() => timer().setIsRunning(true));
        act(() => vi.advanceTimersByTime(25 * 60_000 + 1000));
        expect(timer()).toMatchObject({ mode: 'longBreak', isRunning: false, completedSessions: 2 });
        act(() => timer().setIsRunning(true));
        act(() => vi.advanceTimersByTime(15 * 60_000 + 1000));
        expect(timer()).toMatchObject({ mode: 'work', isRunning: true });
    });

    it('keeps the visible time when viewing another mode, and survives audio errors', () => {
        vi.stubGlobal('AudioContext', function () {
            throw new Error('no audio');
        });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        useTimerStore.setState({ linkedTaskId: 'missing' });
        render(<TimerManager />);
        act(() => timer().setIsRunning(true));
        act(() => timer().setMode('shortBreak'));
        act(() => vi.advanceTimersByTime(10_000));
        expect(timer().timeLeft).toBe(5 * 60);
        act(() => vi.advanceTimersByTime(25 * 60_000));
        expect(console.error).toHaveBeenCalled();
    });
});
