# Spec: Pinning tasks and notes

|             |                                                                                   |
| ----------- | --------------------------------------------------------------------------------- |
| **Status**  | Implemented · milestone v1.1 (ROADMAP #14)                                        |
| **Created** | 2026-10-05                                                                        |
| **Pitch**   | _"Keep the few things that matter at the top."_                                   |
| **Data**    | `Task.pinned?: boolean` and `Note.pinned?: boolean` already exist; no IDB change. |

## Behaviour

- A **📌 pin** button on every task card and note card, next to Edit and Delete. `aria-pressed` reflects the
  state; the label is "Pin task" / "Unpin task" (or note). Clicking toggles `pinned` through `updateTask` /
  `updateNote`, so it is saved, synced to the background and to other open TabPlex tabs like any other edit.
- **Pinned items come first** in every list that shows them, keeping the list's own order otherwise (a stable
  sort): each task column in the Tasks and Today views, the Notes view, and Today's notes. Today's notes show
  pinned notes before the newest ones, so a pinned note is never pushed out of the six shown.
- A pinned card has the class `is-pinned` and a highlighted pin button. Nothing else changes: a pinned task can
  still be moved between columns, parked, finished or deleted.
- Pinning a done task is allowed; it's first in the Done column.
- Export/import carry the flag (it's a normal task/note field).

## Not in v1

- **Saved tabs in Boards.** `Tab.pinned` exists, but folders already have drag-and-drop order, and a "pinned
  first" sort would fight it: dragging a tab to the top is how you pin it there. Revisit if users ask.
- A "Pinned" filter, or pin from the command palette.

## Tests

- `pinnedFirst` keeps relative order within pinned and unpinned items.
- Task and note cards: the button toggles `pinned` (store + `UPDATE_*` message), `aria-pressed` and the label follow.
- Lists: a pinned task/note is rendered first in its column/list; Today's notes keep a pinned older note.
