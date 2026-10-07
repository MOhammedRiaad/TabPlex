import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardStore } from '../../../../store/boardStore';
import { useUIStore } from '../../../ui/store/uiStore';
import { respondToMessages } from '../../../../test/chromeMock';
import { makeBoard, makeFolder, makeTab } from '../../../../test/factories';
import { useCurrentBoard } from '../../utils/currentBoard';
import { BoardActionsProvider } from '../BoardActions';
import BoardStyleFrame, { useBoardFrame } from '../BoardStyleFrame';
import { BoardStyle } from '../boardStyle';
import { SWIPE_TOUCH_DISTANCE, SWIPE_WHEEL_DISTANCE } from '../BoardCarousel';

const active = () => useUIStore.getState().activeBoardId;

/** Stands in for the board header + folders */
const Board: React.FC = () => {
    const frame = useBoardFrame();
    const current = useCurrentBoard();
    return (
        <div>
            <h2>Showing {current?.name}</h2>
            <input aria-label="Search" />
            {frame.showAllBoards && (
                <button type="button" onClick={frame.showAllBoards}>
                    All boards
                </button>
            )}
        </div>
    );
};

function renderStyle(style: BoardStyle) {
    const toast = vi.fn();
    const utils = render(
        <BoardActionsProvider onShowToast={toast}>
            <BoardStyleFrame style={style}>
                <Board />
            </BoardStyleFrame>
        </BoardActionsProvider>
    );
    return { ...utils, toast, user: userEvent.setup() };
}

function wheelAt(target: Element, init: WheelEventInit, timeStamp: number) {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    useBoardStore.setState({
        boards: [
            makeBoard({ id: 'b1', name: 'Work', color: '#3b82f6' }),
            makeBoard({ id: 'b2', name: 'Home', color: '#f59e0b' }),
            makeBoard({ id: 'b3', name: 'Reading', color: undefined }),
        ],
        folders: [
            makeFolder({ id: 'f1', boardId: 'b1', name: 'Docs' }),
            makeFolder({ id: 'f2', boardId: 'b1', name: 'Sprint' }),
            makeFolder({ id: 'f3', boardId: 'b2', name: 'Recipes' }),
        ],
        tabs: [
            makeTab({ id: 't1', folderId: 'f1' }),
            makeTab({ id: 't2', folderId: 'f1' }),
            makeTab({ id: 't3', folderId: 'f3' }),
            makeTab({ id: 't4', folderId: '' }),
        ],
    });
    useUIStore.setState({ activeBoardId: null });
    respondToMessages();
    localStorage.clear();
});

describe('Board tabs', () => {
    it('shows a tab per board with its tab count and switches on click', async () => {
        const { user } = renderStyle('tabs');
        const tabs = screen.getAllByRole('tab');
        expect(tabs.map(tab => tab.textContent)).toEqual(['Work2', 'Home1', 'Reading0']);
        expect(screen.getByRole('tab', { name: /Work/ })).toHaveAttribute('aria-selected', 'true');
        await user.click(screen.getByRole('tab', { name: /Home/ }));
        expect(active()).toBe('b2');
        expect(screen.getByRole('heading')).toHaveTextContent('Showing Home');
    });

    it('moves between tabs with the arrow keys, wrapping around', async () => {
        const { user } = renderStyle('tabs');
        screen.getByRole('tab', { name: /Work/ }).focus();
        await user.keyboard('{ArrowLeft}');
        expect(active()).toBe('b3');
        await user.keyboard('{ArrowRight}');
        expect(active()).toBe('b1');
        await user.keyboard('{Home}');
        expect(active()).toBe('b1');
    });

    it('renames on double-click, opens a menu on right-click and creates from +', async () => {
        const { user } = renderStyle('tabs');
        await user.dblClick(screen.getByRole('tab', { name: /Home/ }));
        expect(within(screen.getByRole('dialog', { name: 'Rename board' })).getByLabelText('Name')).toHaveValue('Home');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        fireEvent.contextMenu(screen.getByRole('tab', { name: /Reading/ }), { clientX: 10, clientY: 10 });
        expect(screen.getByRole('menu', { name: 'Reading actions' })).toBeInTheDocument();
        await user.keyboard('{Escape}');

        await user.click(screen.getByRole('button', { name: 'New board' }));
        expect(screen.getByRole('dialog', { name: 'New board' })).toBeInTheDocument();
    });

    it('lists and filters every board from the ▾ button', async () => {
        const { user } = renderStyle('tabs');
        const toggle = screen.getByRole('button', { name: 'All boards' });
        await user.click(toggle);
        const list = screen.getByRole('list', { name: 'Boards' });
        expect(within(list).getAllByRole('button')).toHaveLength(3);
        await user.type(screen.getByLabelText('Find a board'), 'zzz');
        expect(list).toHaveTextContent('No board matches “zzz”');
        await user.clear(screen.getByLabelText('Find a board'));
        await user.type(screen.getByLabelText('Find a board'), 'rea{Enter}');
        expect(active()).toBe('b3');
        expect(screen.queryByLabelText('Find a board')).not.toBeInTheDocument();

        await user.click(toggle);
        await user.click(within(screen.getByRole('list', { name: 'Boards' })).getByRole('button', { name: /Home/ }));
        expect(active()).toBe('b2');

        await user.click(toggle);
        await user.keyboard('{Escape}');
        expect(screen.queryByLabelText('Find a board')).not.toBeInTheDocument();
        await user.click(toggle);
        await user.click(screen.getByRole('heading'));
        expect(screen.queryByLabelText('Find a board')).not.toBeInTheDocument();
    });
});

describe('Accordion and Bookshelf', () => {
    it('puts closed boards on either side of the open one and opens them on click', async () => {
        useUIStore.setState({ activeBoardId: 'b2' });
        const { user, container } = renderStyle('accordion');
        const spines = [...container.querySelectorAll('.bsw-spine')].map(el => el.getAttribute('aria-label'));
        expect(spines).toEqual(['Open Work, 2 tabs', 'Open Reading, 0 tabs', 'New board']);
        expect(screen.getByRole('region', { name: 'Home' })).toHaveClass('bsw-enter-forward');

        await user.click(screen.getByRole('button', { name: 'Open Work, 2 tabs' }));
        expect(active()).toBe('b1');
        expect(screen.getByRole('region', { name: 'Work' })).toHaveClass('bsw-enter-back');
        await user.click(screen.getByRole('button', { name: 'Open Reading, 0 tabs' }));
        expect(screen.getByRole('region', { name: 'Reading' })).toHaveClass('bsw-enter-forward');
    });

    it('renames, opens the menu and creates from the spines', async () => {
        const { user } = renderStyle('accordion');
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Home, 1 tab' }));
        await user.click(screen.getByRole('menuitem', { name: 'Rename board' }));
        expect(screen.getByRole('dialog', { name: 'Rename board' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Home, 1 tab' }));
        expect(screen.getByRole('menu', { name: 'Home actions' })).toBeInTheDocument();
        await user.click(screen.getByRole('menuitem', { name: 'Open “Home”' }));
        expect(active()).toBe('b2');
        await user.click(screen.getByRole('button', { name: 'New board' }));
        expect(screen.getByRole('dialog', { name: 'New board' })).toBeInTheDocument();
    });

    it('moves every spine into one row above the board on narrow screens, following resizes', async () => {
        let listener: (() => void) | undefined;
        const query = {
            matches: true,
            addEventListener: (_: string, fn: () => void) => (listener = fn),
            removeEventListener: vi.fn(),
        };
        vi.spyOn(window, 'matchMedia').mockReturnValue(query as unknown as MediaQueryList);
        useUIStore.setState({ activeBoardId: 'b2' });
        const { user, container, unmount } = renderStyle('bookshelf');
        const row = screen.getByRole('group', { name: 'Boards' });
        expect(container.querySelector('.bsw-shelf--narrow')).toBeInTheDocument();
        expect([...row.children].map(el => el.getAttribute('aria-label') ?? el.textContent)).toEqual([
            'Open Work, 2 tabs',
            '1Home',
            'Open Reading, 0 tabs',
            'New board',
        ]);
        expect(within(row).getByText('Home').parentElement).toHaveAttribute('aria-current', 'true');
        await user.click(within(row).getByRole('button', { name: 'Open Reading, 0 tabs' }));
        expect(active()).toBe('b3');

        query.matches = false;
        act(() => listener?.());
        expect(container.querySelector('.bsw-shelf--narrow')).not.toBeInTheDocument();
        unmount();
        expect(query.removeEventListener).toHaveBeenCalled();
    });

    it('draws the bookshelf as books of varying height in the board colour', () => {
        const { container } = renderStyle('bookshelf');
        expect(container.querySelector('.bsw-shelf--bookshelf')).toBeInTheDocument();
        const book = screen.getByRole('button', { name: 'Open Home, 1 tab' });
        expect(book.style.getPropertyValue('--book-height')).toMatch(/^\d+%$/);
        expect(book.style.getPropertyValue('--board-text')).toBe('#111827');
    });
});

describe('Carousel', () => {
    it('shows dots and neighbour peeks, and switches from either', async () => {
        useUIStore.setState({ activeBoardId: 'b2' });
        const { user } = renderStyle('carousel');
        const dots = within(screen.getByRole('tablist', { name: 'Boards' }));
        expect(dots.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
        await user.click(screen.getByRole('button', { name: 'Next board: Reading' }));
        expect(active()).toBe('b3');
        // Last board: the right-hand peek creates a board
        expect(screen.queryByRole('button', { name: /Next board/ })).not.toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: 'New board' })[1]);
        expect(screen.getByRole('dialog', { name: 'New board' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Previous board: Home' }));
        expect(active()).toBe('b2');
        await user.click(dots.getByRole('tab', { name: 'Work' }));
        expect(active()).toBe('b1');
        expect(screen.queryByRole('button', { name: /Previous board/ })).not.toBeInTheDocument();
    });

    it('moves one board per horizontal trackpad swipe', () => {
        const { container } = renderStyle('carousel');
        const carousel = container.querySelector('.bsw-carousel') as HTMLElement;
        wheelAt(carousel, { deltaX: SWIPE_WHEEL_DISTANCE / 2 }, 1000);
        expect(active()).toBe(null);
        wheelAt(carousel, { deltaX: SWIPE_WHEEL_DISTANCE / 2 }, 1010);
        expect(active()).toBe('b2');
        // Cool-down: the rest of the same swipe is ignored
        wheelAt(carousel, { deltaX: SWIPE_WHEEL_DISTANCE * 2 }, 1100);
        expect(active()).toBe('b2');
        // Vertical scrolling never switches
        wheelAt(carousel, { deltaX: 10, deltaY: 400 }, 3000);
        expect(active()).toBe('b2');
        wheelAt(carousel, { deltaX: -SWIPE_WHEEL_DISTANCE }, 4000);
        expect(active()).toBe('b1');
    });

    it('moves on a touch swipe, but not on a mouse drag or a short or vertical swipe', () => {
        const { container } = renderStyle('carousel');
        const row = container.querySelector('.bsw-carousel') as HTMLElement;
        const swipe = (pointerType: string, dx: number, dy = 0) => {
            fireEvent.pointerDown(row, { pointerType, clientX: 300, clientY: 200 });
            fireEvent.pointerUp(row, { pointerType, clientX: 300 + dx, clientY: 200 + dy });
        };
        swipe('mouse', -200);
        expect(active()).toBe(null);
        swipe('touch', -(SWIPE_TOUCH_DISTANCE - 10));
        expect(active()).toBe(null);
        swipe('touch', -100, 120);
        expect(active()).toBe(null);
        swipe('touch', -100);
        expect(active()).toBe('b2');
        swipe('touch', 100);
        expect(active()).toBe('b1');
        fireEvent.pointerUp(row, { pointerType: 'touch', clientX: 0, clientY: 0 });
        expect(active()).toBe('b1');
    });
});

describe('Side dock', () => {
    it('lists boards with counts, marks the current one and switches', async () => {
        const { user } = renderStyle('dock');
        const nav = within(screen.getByRole('navigation', { name: 'Boards' }));
        expect(nav.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-current', 'true');
        expect(nav.getByRole('button', { name: 'Work' })).toHaveTextContent('W' + 'Work' + '2 folders · 2 tabs');
        await user.click(nav.getByRole('button', { name: 'Reading' }));
        expect(active()).toBe('b3');
        expect(screen.getByRole('region', { name: 'Reading' })).toHaveClass('bsw-rise-forward');
        await user.click(nav.getByRole('button', { name: 'Home' }));
        expect(screen.getByRole('region', { name: 'Home' })).toHaveClass('bsw-rise-back');
    });

    it('renames, opens the menu and creates', async () => {
        const { user } = renderStyle('dock');
        await user.dblClick(screen.getByRole('button', { name: 'Home' }));
        expect(screen.getByRole('dialog', { name: 'Rename board' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Home' }));
        expect(screen.getByRole('menu', { name: 'Home actions' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'New board' }));
        expect(screen.getByRole('dialog', { name: 'New board' })).toBeInTheDocument();
    });
});

describe('Overview', () => {
    it('opens the grid from the header, picks a board and zooms into it', async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });
        const { user, container } = renderStyle('overview');
        await user.click(screen.getByRole('button', { name: 'All boards' }));
        expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument();
        expect(screen.getByText('3 boards · 3 tabs')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open Work' })).toHaveAttribute('aria-current', 'true');
        expect(screen.getByRole('button', { name: 'Open Work' })).toHaveTextContent('2 folders');
        expect(screen.getByRole('button', { name: 'Open Reading' })).toHaveTextContent('Empty board');

        await user.click(screen.getByRole('button', { name: 'Open Home' }));
        expect(active()).toBe('b2');
        const board = container.querySelector('.bsw-ov-board') as HTMLElement;
        expect(board).toHaveClass('bsw-zoom-in');
        expect(board.style.transformOrigin).toBe('50.0% 300px');
        // jsdom has no AnimationEvent, so React listens for the prefixed name
        fireEvent(board, new Event('webkitAnimationEnd', { bubbles: true }));
        expect(board).not.toHaveClass('bsw-zoom-in');
    });

    it('closes with Esc or Back, except while a dialog is open, and creates from the grid', async () => {
        const { user } = renderStyle('overview');
        await user.click(screen.getByRole('button', { name: 'All boards' }));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('heading')).toHaveTextContent('Showing Work');

        await user.click(screen.getByRole('button', { name: 'All boards' }));
        await user.click(screen.getByRole('button', { name: 'Back to Work' }));
        expect(screen.getByRole('heading')).toHaveTextContent('Showing Work');

        await user.click(screen.getByRole('button', { name: 'All boards' }));
        await user.click(screen.getByRole('button', { name: '+ New board' }));
        await user.keyboard('{Escape}');
        expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument();
        fireEvent.contextMenu(screen.getByRole('button', { name: 'Open Home' }));
        expect(screen.getByRole('menu', { name: 'Home actions' })).toBeInTheDocument();
        // Esc in the menu closes the menu only
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument();
    });

    it('zooms out and back in on a trackpad pinch (Ctrl + wheel)', () => {
        const { container } = renderStyle('overview');
        const frame = container.querySelector('.bsw-frame') as HTMLElement;
        expect(wheelAt(frame, { deltaY: 40 }, 100).defaultPrevented).toBe(false);
        expect(screen.queryByRole('heading', { name: 'All boards' })).not.toBeInTheDocument();
        expect(wheelAt(frame, { deltaY: 40, ctrlKey: true }, 200).defaultPrevented).toBe(true);
        expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument();
        wheelAt(frame, { deltaY: -40, ctrlKey: true }, 300);
        expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument();
        wheelAt(frame, { deltaY: 1, ctrlKey: true }, 2000);
        expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument();
        wheelAt(frame, { deltaY: -40, ctrlKey: true }, 2100);
        expect(screen.queryByRole('heading', { name: 'All boards' })).not.toBeInTheDocument();
    });
});

describe('Board style frame', () => {
    it('adds nothing around the board in the Dropdown style', () => {
        const { container } = renderStyle('dropdown');
        expect(container.querySelector('.bsw-frame--dropdown')?.children).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'All boards' })).not.toBeInTheDocument();
    });

    it.each<BoardStyle>(['tabs', 'accordion', 'bookshelf', 'carousel', 'dock', 'overview'])(
        'shows just the board when there are no boards (%s)',
        style => {
            useBoardStore.setState({ boards: [] });
            renderStyle(style);
            expect(screen.getByRole('heading')).toHaveTextContent('Showing');
            expect(screen.queryByRole('tab')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'New board' })).not.toBeInTheDocument();
        }
    );

    it('switches boards with [ ] and Alt+1…9, but not while typing or with Ctrl', async () => {
        const { user } = renderStyle('dropdown');
        await user.keyboard(']');
        expect(active()).toBe('b2');
        await user.keyboard('[[[[');
        expect(active()).toBe('b3');
        fireEvent.keyDown(window, { key: '1', code: 'Digit1', altKey: true });
        expect(active()).toBe('b1');
        fireEvent.keyDown(window, { key: '9', code: 'Digit9', altKey: true });
        expect(active()).toBe('b1');
        fireEvent.keyDown(window, { key: ']', ctrlKey: true });
        expect(active()).toBe('b1');
        await user.click(screen.getByLabelText('Search'));
        await user.keyboard(']');
        expect(active()).toBe('b1');
        const prevented = new KeyboardEvent('keydown', { key: ']', cancelable: true });
        prevented.preventDefault();
        window.dispatchEvent(prevented);
        expect(active()).toBe('b1');
    });
});

describe('Board actions', () => {
    it('renames and deletes a board that is not the current one from its menu', async () => {
        const { user, toast } = renderStyle('tabs');
        fireEvent.contextMenu(screen.getByRole('tab', { name: /Home/ }), { clientX: 5000, clientY: 5000 });
        const menu = screen.getByRole('menu', { name: 'Home actions' });
        expect(menu.style.left).toBe(`${window.innerWidth - 200}px`);
        await user.click(within(menu).getByRole('menuitem', { name: 'Rename board' }));
        const name = within(screen.getByRole('dialog', { name: 'Rename board' })).getByLabelText('Name');
        await user.clear(name);
        await user.type(name, 'House{Enter}');
        expect(useBoardStore.getState().boards[1].name).toBe('House');
        expect(toast).toHaveBeenCalledWith('Renamed board to “House”', 'success');

        fireEvent.contextMenu(screen.getByRole('tab', { name: /House/ }));
        await user.click(screen.getByRole('menuitem', { name: 'Delete board' }));
        const dialog = screen.getByRole('dialog', { name: 'Delete “House”' });
        expect(dialog).toHaveTextContent('It has 1 folder and 1 saved tab.');
        await user.click(within(dialog).getByRole('button', { name: 'Delete board' }));
        expect(useBoardStore.getState().boards.map(b => b.id)).toEqual(['b1', 'b3']);
        expect(useBoardStore.getState().folders.find(f => f.id === 'f3')?.boardId).toBe('b1');
        expect(active()).toBe(null);
        expect(toast).toHaveBeenCalledWith('Deleted board “House”', 'info');
    });

    it('creates a board and switches to it', async () => {
        const { user, toast } = renderStyle('dock');
        await user.click(screen.getByRole('button', { name: 'New board' }));
        await user.type(screen.getByLabelText('Name'), 'Travel{Enter}');
        const created = useBoardStore.getState().boards.find(b => b.name === 'Travel');
        expect(active()).toBe(created?.id);
        expect(toast).toHaveBeenCalledWith('Created board “Travel”', 'success');
    });

    it('closes the board menu on an outside click or a scroll, and keeps the last board', async () => {
        const { user } = renderStyle('tabs');
        fireEvent.contextMenu(screen.getByRole('tab', { name: /Home/ }));
        await user.click(screen.getByRole('heading'));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        fireEvent.contextMenu(screen.getByRole('tab', { name: /Home/ }));
        // A scroll inside the page (the tab strip) keeps it open; a page scroll closes it
        fireEvent.scroll(screen.getByRole('tablist', { name: 'Boards' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.scroll(window);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        act(() => useBoardStore.setState({ boards: [makeBoard({ id: 'b1', name: 'Work' })] }));
        fireEvent.contextMenu(screen.getByRole('tab', { name: /Work/ }));
        const remove = screen.getByRole('menuitem', { name: 'Delete board' });
        expect(remove).toBeDisabled();
        expect(remove).toHaveAttribute('title', 'You need at least one board');
        expect(screen.queryByRole('menuitem', { name: /Open/ })).not.toBeInTheDocument();
        await user.keyboard(']');
        expect(active()).toBe(null);
    });
});
