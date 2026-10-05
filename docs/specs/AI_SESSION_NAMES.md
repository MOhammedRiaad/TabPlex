# Spec: Better names for saved sessions (AI, with a non-AI fallback)

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| **Status**     | Ready to implement · milestone v1.2 (ROADMAP #21)                    |
| **Created**    | 2026-10-05                                                           |
| **Size**       | S (½ day)                                                            |
| **Depends on** | [AI_FOUNDATION.md](AI_FOUNDATION.md), `fitInput`, `describeTabForAi` |
| **Pitch**      | _"'Session 10/5/2026, 21:14:07' becomes 'Q4 pricing research'."_     |

## 1. Problem

Sessions saved from the current window are named `Session {date and time}`
(`src/features/sessions/SessionsView.tsx`, `startSessionFromCurrentTabs`). Suggested sessions from history are named
`{domain} - {date}`. A list of these is hard to scan.

## 2. Goals / non-goals

**Goals:**

1. **Save current window** gets a meaningful name automatically: AI when available, otherwise a better non-AI name.
2. Every session card gets **✨ Rename** (AI) next to the existing name, previewed in place; Enter/✓ keeps it, Esc
   reverts.
3. The name is always editable by hand.

**Non-goals:** renaming history-suggested sessions automatically in bulk; summaries (the `summary` field stays as is).

## 3. Names

### 3.1 Fallback (no AI), `fallbackSessionName(tabs, date)` in `src/features/sessions/utils/sessionName.ts`

- Group tab URLs by `siteKey` (`src/utils/siteKey.ts`, see SUGGEST_TASK_FOR_TAB §4). Take the top 2 sites by count.
- `"{site1}, {site2} +{n} more · {Mon 5 Oct}"`; one site → `"{site1} · {Mon 5 Oct}"`; no web tabs → `"Session · {Mon 5 Oct}"`.
- Date formatted with `toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })`.

### 3.2 AI, `suggestSessionName(session, tabs)`

- System prompt: "You name a saved set of browser tabs. Reply with a short name (2 to 5 words, Title Case, no quotes,
  no emoji, no date) for what the person was working on."
- Input: up to 30 tabs as `describeTabForAi` lines, trimmed with `fitInput`.
- Schema `{ type: 'object', properties: { name: { type: 'string', minLength: 2 } }, required: ['name'] }` (no
  `maxLength`); normalize with `cleanLine`, cut to 60, reject < 2 characters → fallback name.
- Session created **synchronously in the click** (Save current window / ✨ Rename). Destroy it after use.
- Saving never waits on AI longer than `AI_TIMEOUT_MS`: save with the fallback name immediately, then update the name
  when the AI answer arrives with `updateSessionFromBackground` (it exists, and the background handles `UPDATE_SESSION`
  in `session-service.ts`). Check that other open TabPlex tabs apply `STORAGE_SESSION_UPDATED` silently; add the
  receiver per the `add-message-sync` skill if it is missing.

## 4. Settings

`AiSettings.sessionNames` (default `true`), Settings → On-device AI: "Name saved sessions".

## 5. Files

| File                                         | Change                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| `src/features/sessions/utils/sessionName.ts` | **New**: fallback + AI helpers                               |
| `src/features/sessions/SessionsView.tsx`     | use them in "Save current window"                            |
| Session card component                       | ✨ Rename, inline edit                                       |
| `src/hooks/useStorageSync.ts`                | apply `STORAGE_SESSION_UPDATED` silently, if not handled yet |
| `src/features/ai/*` settings                 | `sessionNames`                                               |
| PRIVACY.md (AI section), README              | mention                                                      |

## 6. Tests

- Fallback: top-2 sites and "+n more", one site, no web tabs, date format (fixed `Date`).
- AI: stubbed model → name normalized; bad output → fallback; save happens immediately with the fallback, then the AI
  name replaces it; session destroyed; Rename preview → Enter keeps, Esc reverts.
- Sync: the rename reaches the background (`UPDATE_SESSION`) and another open TabPlex tab shows it without a reload.
