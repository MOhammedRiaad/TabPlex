# Spec: Tags on tasks, notes and tabs

|             |                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| **Status**  | Implemented · milestone v1.2 (ROADMAP #17)                                                                         |
| **Created** | 2026-10-05                                                                                                         |
| **Pitch**   | _"Label work across tasks, notes and saved tabs, and filter by it."_                                               |
| **Data**    | `Task.tags`, `Note.tags` and `Tab.tags` (`string[]`) already exist, and global search matches them. No IDB change. |

## Tag rules (`src/utils/tags.ts`)

- `normalizeTag`: trim, drop a leading `#`, collapse spaces, lower-case, cut to `TAG_MAX` (30). Empty → not added.
- Typing `a, b` adds two tags (commas separate tags; a tag never contains one).
- At most `MAX_TAGS` (10) per item; duplicates are ignored.
- `collectTags(items)`: every tag in use with its count, sorted by name. Used for suggestions and filters.

## UI

- **`TagInput`** (`src/features/ui/components/TagInput.tsx`): chips with a × button (`aria-label="Remove tag {t}"`),
  and an input (`aria-label="Add tag"`). Enter or comma adds; Backspace in an empty input removes the last chip;
  blur adds what's typed. Suggestions come from tags already in use (`<datalist>`). Hidden once 10 tags are set.
- **`TagList`**: read-only chips (`#tag`) shown on task cards, note cards and saved tabs in Boards.
- **Tasks:** the shared task form (create and edit) has a Tags field. Cards show chips.
- **Notes:** the note editor has a Tags field. Cards show chips.
- **Saved tabs (Boards):** the tab create/edit dialog has a Tags field. Tabs show chips under their title.
- **Filters:** a **Tag** select in the Tasks view and in the Notes view ("All tags" + every tag in use there).
  It combines with the existing filters and search.
- Changes go through `addTask`/`updateTask`, `updateNote`, `addTab`/`updateTab`, so they are saved, synced to the
  background and other TabPlex tabs, and exported like any other field.

## Not in v1

- A tag manager (rename/merge/delete a tag everywhere), tag colours, a tag filter in Boards (use the search box).

## Tests

- Rules: normalize, comma split, dedupe, limits, `collectTags` counts and order.
- `TagInput`: add with Enter/comma/blur, remove with × and Backspace, suggestions, limit.
- Task form submits tags; card shows them. Note editor saves tags. Tab dialog saves tags.
- Tasks and Notes tag filters.
