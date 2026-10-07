# Spec: Board styles (how you move between boards)

|             |                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Status**  | In progress · ROADMAP #28 · branch `feature/board-views`                                                 |
| **Created** | 2026-10-07                                                                                               |
| **Size**    | M                                                                                                        |
| **Pitch**   | _"Switch boards the way you like: tabs, a shelf of books, a carousel, a dock or a zoomed-out overview."_ |
| **Data**    | One setting in `chrome.storage.local`. No IndexedDB change, no new permission.                           |

Builds on [BOARD_SWITCHER.md](BOARD_SWITCHER.md) (several boards, the select, the name and delete dialogs).

## 1. Styles

| Id          | Name       | What it looks like                                                                                            |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `tabs`      | Board tabs | **Default.** Browser-style tabs above the header, with colour dot and tab count; ▾ lists and finds all boards |
| `accordion` | Accordion  | Closed boards are 48px coloured strips (vertical name, tab count) on either side of the open board            |
| `bookshelf` | Bookshelf  | The accordion as a shelf: closed boards are 30px solid book spines of varying height                          |
| `carousel`  | Carousel   | The board as a card with its neighbours peeking in; dots show every board; swipe sideways to move             |
| `dock`      | Side dock  | A 64px rail of board avatars (initials) that widens on hover to show names and counts                         |
| `overview`  | Overview   | "All boards" (or a trackpad pinch out) zooms out to a grid of live board thumbnails; pick one to zoom in      |
| `dropdown`  | Dropdown   | The original `<select>` in the header                                                                         |

The board itself (header, search, folders) is the same in every style; a style only adds the way to move between
boards around it. Every style offers switch, **New board**, and a right-click menu per board (Open, Rename, Delete).
The header's ⋯ menu stays in every style.

## 2. Setting

- Key `tabplex_board_style` in `chrome.storage.local` (`src/features/boards/switcher/boardStyle.ts`). Unknown or
  missing value → `tabs`. `useBoardStyle()` follows `chrome.storage.onChanged`, so every open TabPlex tab switches
  style at once.
- **Onboarding** (`onboarding.html` / `onboarding.js`): a "How do you want to switch boards?" step with one radio card
  per style, Board tabs pre-selected. Picking a card saves it; skipping saves nothing, so the default applies.
  A unit test keeps the onboarding list in step with `BOARD_STYLES`.
- **Settings → Boards → Board switcher**: the same choices as a radio group.

## 3. Shared pieces (`src/features/boards/switcher/`)

- `BoardActionsProvider` / `useBoardActions()`: boards, current board, per-board folder and tab counts, `select`,
  `cycle`, `openNew`, `openRename(id)`, `openDelete(id)`, `openContextMenu(id, x, y)`. Owns the name and delete dialogs
  (moved to `BoardDialogs.tsx`), so a board other than the current one can be renamed or deleted. Deleting a board that
  isn't the current one keeps the current board.
- `BoardStyleFrame`: wraps the board in the chosen style; `useBoardFrame()` tells the header whether to show the select
  (Dropdown only) and the **All boards** button (Overview only).
- Keyboard (any style, not while typing): `[` / `]` previous / next board, Alt+1…9 jump to a board. Board tabs also
  move with ←/→. Overview: Esc zooms back in.
- Text on a board colour is white or dark, whichever reaches 3:1 (`readableTextColor`).
- Motion: the new board slides in from the side it came from (dock: from above or below); `prefers-reduced-motion`
  turns it off.

## 4. Narrow screens (≤ 640px)

- Accordion and Bookshelf: every spine moves into one scrolling row above the board, the open board marked
  (`useNarrowScreen`). Side-by-side spines would squeeze the board to nothing.
- Carousel: the side peeks hide; the dots and swiping move between boards.
- Side dock: becomes a scrolling row of avatars above the board.
- Folder grid columns shrink below 300px when the space is narrower (`minmax(min(300px, 100%), 1fr)`).

## 5. Not in this change

- Reordering boards by dragging (needs an `order` field on `Board`).
- Creating or renaming boards inline (all styles use the existing dialog).
- Double-click to rename on accordion and bookshelf spines: the first click already opens the board, so its spine is
  gone. Use right-click or the ⋯ menu.

## 6. Tests

- `boardStyle` read/save/fallback; onboarding list matches `BOARD_STYLES`; `useBoardStyle` follows other tabs and
  doesn't let a slow first read overwrite a newer choice.
- Each style: switch, New board, right-click menu, its own gestures (tab arrows, ▾ search, carousel wheel and touch
  swipes, overview pinch and Esc), and no boards → just the board.
- `BoardView` uses the saved style and changes when the setting changes; Settings saves the choice.
- E2E: pick a style in Settings and switch boards with it in the loaded extension.
