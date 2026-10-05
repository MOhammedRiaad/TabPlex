# Spec: Export a task or a board as Markdown / CSV

|              |                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Status**   | Ready to implement · milestone v1.2 (ROADMAP #19)                                             |
| **Created**  | 2026-10-05                                                                                    |
| **Size**     | S (½ day)                                                                                     |
| **Replaces** | Notion / Trello integrations (decision D7: no network, so integrations become export formats) |
| **Pitch**    | _"Paste a task with its links into Notion, Slack or a doc in one click."_                     |

## 1. Goals / non-goals

**Goals:** copy or download one **task** (with its tabs) as Markdown, and one **board** (folders and saved tabs) as
Markdown or CSV. Everything happens in the page: no network, no new permission.

**Non-goals:** importing Markdown/CSV, exporting notes (they're already Markdown: copy works), whole-workspace export
(the JSON export in Settings covers it).

## 2. Formats (`src/utils/exportFormats.ts`, pure functions)

### 2.1 Task → Markdown: `taskToMarkdown(task: Task, savedTabs: Tab[]): string`

```markdown
# Compare Stripe and Paddle pricing

- **Status:** Doing · **Priority:** High · **Due:** 2026-10-20
- **Tags:** #q4 #payments

Decide which payment provider to use, focusing on fees and VAT handling.

## Checklist

- [x] Compare transaction fees
- [ ] Check VAT handling for EU

## Tabs

- [Stripe pricing](https://stripe.com/pricing)
- [Paddle | Pricing](https://paddle.com/pricing)

## Where I left off

> Comparing EU VAT next.

_Exported from TabPlex on 2026-10-05._
```

Rules: omit empty sections and empty fields; "Tabs" = the task's context tabs, then its linked saved tabs
(`task.tabIds` resolved against `savedTabs`), de-duplicated by URL, in that order. Escape Markdown in titles
(`[`, `]`, `*`, `_`, `` ` ``, `#` at line start) with a backslash; URLs are wrapped as-is but `)` and spaces are
percent-encoded so links don't break. The AI summary, if any, follows "Where I left off" as an italic line.

### 2.2 Board → Markdown: `boardToMarkdown(board, folders, tabs): string`

`# {board name}`, then per folder (folder `order`, then name) `## {folder}` and `- [title](url)` per tab (tab
`order`, then title), with ` #tag` suffixes. Tabs without a folder go under `## Unsorted`. Empty folders are listed
with `_No tabs_`.

### 2.3 Board → CSV: `boardToCsv(board, folders, tabs): string`

Header: `Folder,Title,URL,Tags,Saved` (Saved = `createdAt` date). One row per tab, same order as 2.2. RFC 4180: fields
with `,` `"` or newlines are quoted, `"` doubled; lines end with `\r\n`; prefix the file with a UTF-8 BOM so Excel
reads accents. Tags joined with `;`. Guard against CSV formula injection: a field starting with `=`, `+`, `-` or `@`
gets a leading `'`.

## 3. UI

| Where                         | Control                                                                                   | Action                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| Task card (view mode) actions | **⤓** button, `aria-label="Export task"` → small menu: "Copy as Markdown", "Download .md" | clipboard / file `{slug(title)}.md`       |
| Boards header                 | **Export** button → menu: "Copy as Markdown", "Download .md", "Download .csv"             | file `{slug(board)}-{YYYY-MM-DD}.md/.csv` |
| Command palette               | "Export board as Markdown", "Export board as CSV"                                         | download                                  |

- Copy uses `navigator.clipboard.writeText`; success toast "Copied “{title}” as Markdown"; failure toast with the
  error (clipboard needs focus).
- Download reuses the Blob + `<a download>` pattern from `downloadExportFile` (extract a small `downloadText(name,
text, mime)` helper into `src/utils/download.ts` and use it in both places).
- Menus are buttons with `aria-haspopup="menu"`; Esc closes; keyboard reachable.

## 4. Files

| File                                             | Change                                    |
| ------------------------------------------------ | ----------------------------------------- |
| `src/utils/exportFormats.ts`                     | **New**, §2                               |
| `src/utils/download.ts`                          | **New** helper; `exportImport.ts` uses it |
| `src/features/tasks/components/TaskCard.tsx`     | export menu                               |
| `src/features/boards/components/BoardHeader.tsx` | export menu                               |
| `src/features/ui/components/CommandPalette.tsx`  | 2 commands                                |
| README, `CHROMEWEBSTORE.md` "Also included"      | one line                                  |

## 5. Tests

- `exportFormats.test.ts`: full task example above (snapshot-free: exact string); empty fields omitted; tab
  de-duplication and order; Markdown escaping; board Markdown ordering and Unsorted; CSV quoting, BOM, CRLF,
  formula-injection guard, tags join.
- Components: menu opens, copy calls `clipboard.writeText` with the Markdown and toasts; download creates a Blob with
  the right name and type (spy on `URL.createObjectURL`).
- Palette commands call the board exporters.
