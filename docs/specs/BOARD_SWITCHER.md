# Spec: Several boards (board switcher)

|             |                                                                             |
| ----------- | --------------------------------------------------------------------------- |
| **Status**  | Ready to implement · milestone v1.2 (ROADMAP #23)                           |
| **Created** | 2026-10-05                                                                  |
| **Size**    | M (1–2 days)                                                                |
| **Pitch**   | _"Keep 'Work' and 'Home' tabs on separate boards and switch between them."_ |
| **Data**    | `Board` objects and `Folder.boardId` already exist. No IndexedDB change.    |

## 1. Problem

The data model supports many boards, but the UI always shows the first one: `BoardView.tsx` uses `boards[0]` (or a
synthetic `default_board`). Ten places assume "the first board" (see §5). Also, `deleteBoard` removes the board but
**leaves its folders and tabs behind**, unreachable (bug, fixed here).

## 2. Goals / non-goals

**Goals:** create, rename, switch and delete boards; every "add to the board" action uses the **current** board;
deleting a board deals with its folders and tabs.

**Non-goals:** moving folders between boards by drag-and-drop (later; the folder edit dialog gets a Board select
instead), board colours in the UI, per-board settings.

## 3. Current board

- `uiStore.activeBoardId: string | null` + `setActiveBoard(id)`, persisted in `localStorage`
  (`tabplex_active_board`, read in try/catch). Per TabPlex tab: two open tabs may show different boards.
- `getCurrentBoardId(boards, activeBoardId)` in `src/utils/boards.ts`: the active id if it still exists, else
  `boards[0]?.id`, else `'default_board'` (the existing fallback). One helper, used everywhere in §5.
- When the active board is deleted (here or in another tab via `STORAGE_BOARD_DELETED`), fall back as above.

## 4. UI (Boards header)

- **Board select** (`<select aria-label="Board">`) listing boards by name, then **+ New board**. Choosing a board
  switches; "+ New board" opens the existing `BoardModal` in a new `type="board"` mode (name, colour).
- **⋯ Board menu:** Rename (same modal, edit), **Delete board**.
- **Delete board** opens a confirm dialog:
    - "Delete “{name}”? It has {F} folders and {T} saved tabs." with two choices:
      **Move them to “{other board}”** (select, default the first other board) or **Delete them too**.
    - Disabled for the **last** board ("You need at least one board").
    - Implementation: a new slice action `deleteBoardWithContents(id, { moveTo?: string })` that updates each folder's
      `boardId` (move) or deletes folders and their tabs (delete), then deletes the board. Each change uses the existing
      synced actions (`updateFolder`/`deleteFolder`/`deleteTab`/`deleteBoard`), so the background and other tabs follow.
- Keyboard: the select and menu are reachable by Tab; Esc closes the menu/dialog.

## 5. Callers to switch from `boards[0]` to `getCurrentBoardId`

| File                                                        | Today                            |
| ----------------------------------------------------------- | -------------------------------- |
| `src/features/boards/BoardView.tsx:54-80`                   | `boards[0]` / synthetic default  |
| `src/features/organize/utils/saveToBoards.ts:20`            | Organize "Save to Boards"        |
| `src/features/tasks/components/NewTaskDialog.tsx:34`        | new task's `boardId`             |
| `src/features/ui/components/CommandPalette.tsx:123,134,138` | create task / folder             |
| `src/hooks/useKeyboardShortcuts.ts:68,119,141`              | shortcuts adding folder/tab/task |

`background-init.ts:21` (first-install default board) stays.

## 6. Folder dialog

`BoardModal` (`type="folder"`, edit) gets a **Board** select when more than one board exists, so a folder can be moved
(`updateFolder(id, { boardId })`).

## 7. Tests

- `getCurrentBoardId`: active exists / deleted / none.
- Switching boards shows only that board's folders; choice survives a reload (localStorage) and survives the board
  being renamed.
- New board → becomes current; Rename updates the select.
- Delete with **move** → folders now on the other board, tabs untouched, board gone; with **delete** → folders and
  their tabs gone; last board can't be deleted; the background gets the matching messages.
- Every §5 caller uses the current board (Organize Save to Boards lands on the current board).
- E2E: create a second board, add a folder and tab there, switch back and forth, delete it with "Move".
