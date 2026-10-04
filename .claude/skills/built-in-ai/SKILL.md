---
name: built-in-ai
description: Add or change a TabPlex feature that uses Chrome's built-in AI (Prompt API / LanguageModel, Summarizer). Use for anything in src/features/ai, Organize tabs, park summaries, or a new AI idea from ROADMAP.md.
---

# Chrome built-in AI in TabPlex

Rules from Chrome's built-in AI guidance (the `modern-web-guidance` skill, `guides/built-in-ai/*`, and its
[dos and don'ts](https://developer.chrome.com/docs/ai/built-in-ai-dos-donts)), applied to our wrappers. Read the
feature's spec first (`docs/specs/AI_*.md`).

## Use the wrappers

- Prompt API: `src/features/ai/utils/promptApi.ts` — `getModelAvailability`, `createSession`, `promptJson`,
  `fitInput`, `aiErrorMessage`. Never call `LanguageModel` directly.
- Summarizer: `src/features/tasks/utils/aiSummary.ts`.
- Tab text for prompts: `describeTabForAi` (`ai/utils/tabText.ts`) — host + path only, never query strings.

## Rules

1. **Every AI feature has a non-AI path.** Most devices can't run the model, and Edge may not have it. Check
   availability (`'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'`) and fall back
   (e.g. Organize tabs groups by site). Never make a store or landing claim that only holds with AI.
2. **Create sessions inside the click handler, before any `await`.** Starting the model download needs user
   activation (`createSession` / `createSummarizer` comments). Pass the same options to `availability()` and
   `create()` (the wrappers share `BASE_OPTIONS` / `OPTIONS`).
3. **System prompt in `initialPrompts` at creation**, not in the first `prompt()`. Don't call `create()` repeatedly
   with the same system prompt; `clone()` a base session for repeated independent tasks.
4. **Structured output via `responseConstraint`** (a plain JSON Schema object; `promptJson` does this and retries
   once). **No `maxLength` / tight length caps in the schema**: the model then squeezes text into emoji or
   gibberish. Ask for short text in the prompt and cut it on the client (e.g. `cleanGroupName`).
5. **Destroy every session and summarizer** when done, on success, early return and error paths alike (see
   `releaseSummarizer` in `useTaskContextActions.ts`, `destroySession` in `organizeStore.ts`). Each one holds
   device memory.
6. **Send only what's needed.** Trim input with `fitInput` (context window with headroom) or a char budget.
7. **Model output is untrusted.** Render it as text (React children / `textContent`), never through
   `dangerouslySetInnerHTML`. Validate parsed JSON (`validate` in `promptJson`) before using it.
8. **Keep the user in control.** Show progress (download `monitor`, a busy state), preview before applying, offer
   undo/cancel (`AbortSignal` → `promptJson`), and let the user edit results.
9. **Privacy:** on-device only. Don't add a cloud fallback or polyfill that sends data off the device (D7).

## Tests

Unit-test with a fake session object (see `src/features/ai/utils/__tests__/promptApi.test.ts`,
`organize/utils/__tests__/aiGrouping.test.ts`): availability states, bad JSON → retry → `bad-output`, timeout,
abort, and that `destroy` is called. E2E can't run the model: test the non-AI path and stub the AI answer.
