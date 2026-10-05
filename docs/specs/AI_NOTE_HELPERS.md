# Spec: AI note helpers

|                |                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Status**     | Implemented · milestone v1.2 (ROADMAP #20)                                                  |
| **Created**    | 2026-10-05                                                                                  |
| **Size**       | M (1–2 days)                                                                                |
| **Depends on** | [AI_FOUNDATION.md](AI_FOUNDATION.md) (`promptApi.ts`), the `built-in-ai` skill rules        |
| **Pitch**      | _"Summarize a long note, turn its to-dos into tasks, or tidy the wording, on your device."_ |

## 1. Goals / non-goals

**Goals:** four helpers in the note editor, each previewed before anything changes:

| Helper                                        | API (on device)                                                            | Result                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Summarize**                                 | Summarizer (`type: 'key-points'`, `format: 'markdown'`, `length: 'short'`) | Preview → **Insert at top** (as `## Summary`) or **Copy**    |
| **Action items → tasks**                      | Prompt API, JSON schema                                                    | Checklist preview → **Create N tasks** (selected ones)       |
| **Proofread**                                 | Prompt API (fix spelling/grammar, keep Markdown)                           | Side-by-side preview → **Replace** or **Discard**            |
| **Rewrite** (shorter / clearer / more formal) | Prompt API                                                                 | Preview → **Replace** or **Discard**; **Undo** after replace |

**Non-goals:** chat about a note, translation (Translator API: later), streaming into the editor, cloud fallback.

## 2. Decisions

| #    | Decision                                                                                                      | Reason                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D-N1 | Prompt API for proofread/rewrite/actions; Summarizer for summarize. No Writer/Rewriter/Proofreader APIs in v1 | Those aren't in Chrome's stable guidance yet; feature-detect them in a later version |
| D-N2 | Always preview; the note changes only on **Replace/Insert**, and **Undo** restores the previous text          | Built-in AI guidance: user is the final editor, quick undo                           |
| D-N3 | New setting `AiSettings.noteHelpers` (default `true`), in Settings → On-device AI                             | Same pattern as `tabGrouping` / `taskDrafts`                                         |
| D-N4 | Helpers hidden (not disabled) when AI can't run (`unsupported`/`unavailable` or setting off)                  | No dead buttons on most devices                                                      |

## 3. UI

- In the note **editor** toolbar (`MarkdownEditor`), a **✨ AI** button (`aria-haspopup="menu"`) opens a menu with the four
  helpers (Rewrite has a submenu: Shorter, Clearer, More formal). Shown only when D-N4 allows. Needs at least 20
  characters of text; otherwise the items are disabled with the hint "Write a bit more first".
- Clicking a helper **creates the model session synchronously in the click** (user activation), then opens
  `NoteAiDialog` (one component, `role="dialog"`): progress ("Summarizing on your device…", `ModelStatus` while
  downloading), then the preview and actions. Esc / Cancel aborts (`AbortController`) and destroys the session.
- Preview renders text, never HTML (`textContent` / React text). The Markdown preview uses the existing escaped
  renderer (`parseMarkdown`, which escapes HTML first).
- Errors show `aiErrorMessage(error)` with **Try again**.
- After **Replace**, a toast "Note rewritten · Undo" restores the previous content when Undo is clicked (keep the old
  text in component state until the dialog closes or the note changes).

## 4. Prompts (`src/features/notes/utils/aiNoteHelpers.ts`)

Shared: system prompts in `initialPrompts`; input trimmed with `fitInput`/char budget (`AI_FALLBACK_CHAR_BUDGET`);
note text passed as-is (it's the user's own); **no `maxLength` in schemas**; cut on the client.

- `PROOFREAD_SYSTEM`: "Fix spelling, grammar and punctuation in the user's Markdown note. Keep the meaning, wording,
  Markdown structure, links and code exactly unless they are wrong. Reply with the corrected note only."
- `REWRITE_SYSTEM(style)`: "Rewrite the user's Markdown note to be {shorter | clearer | more formal}. Keep all facts,
  links, code and Markdown structure. Reply with the rewritten note only."
- Proofread/rewrite output: strip one wrapping Markdown fence if the model added one; reject (bad-output) if empty or
  longer than 3× the input.
- `ACTIONS_SYSTEM`: "List the concrete to-dos in the note as tasks. Only things someone has to do; skip facts and
  ideas. Each title is a short imperative phrase."
  Schema: `{ type: 'object', properties: { tasks: { type: 'array', maxItems: 10, items: { type: 'object', properties: {
title: { type: 'string', minLength: 3 }, priority: { enum: ['low','medium','high'] } }, required: ['title'] } } },
required: ['tasks'] }`. Normalizer: `cleanLine` (from taskDraft), cut to 200, dedupe, drop items already in the
  note's tasks.
- Created tasks: `status: 'todo'`, priority from the model (default medium), `description: 'From note “{note title}”'`,
  tags = the note's tags. Toast "Created N tasks".

## 5. Files

| File                                                                                                               | Change                                        |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `src/features/ai/types.ts`, `constants.ts`, `AiFeaturesSetting.tsx`                                                | `noteHelpers` setting                         |
| `src/features/notes/utils/aiNoteHelpers.ts`                                                                        | **New**: prompts, schema, normalizers         |
| `src/features/notes/components/NoteAiDialog.tsx` + `.css`                                                          | **New**                                       |
| `src/features/ui/components/MarkdownEditor.tsx`                                                                    | optional `aiMenu` slot (rendered by NoteCard) |
| `src/features/notes/components/NoteCard.tsx`                                                                       | wire the menu and Undo                        |
| `PRIVACY.md` (AI section names "note helpers"), README, `CHROMEWEBSTORE.md` (Chrome text only; Edge: no AI claims) | docs                                          |

## 6. Tests

- Unit (stub `LanguageModel` / `Summarizer` like the organize/task-draft tests): session created synchronously on
  click; summarize → Insert adds `## Summary` at the top; actions → schema has no `maxLength`, normalizer drops short
  and duplicate items, Create makes the selected tasks with the note's tags; proofread → Replace changes content,
  Undo restores; fence stripping; bad output → error + Try again; Cancel aborts and destroys the session.
- Menu hidden when unsupported or setting off; disabled under 20 characters.
- E2E with a stubbed model (init script, as in organize/task-from-tabs): rewrite → Replace → saved in IndexedDB and the
  background; Undo restores.
- Manual on a device with built-in AI: quality of each helper on a real note.
