# Spec: Check TabPlex in Brave

|             |                                                                                  |
| ----------- | -------------------------------------------------------------------------------- |
| **Status**  | Ready (needs Brave installed on the test machine) · v1.1 (ROADMAP #16)           |
| **Created** | 2026-10-05                                                                       |
| **Size**    | S (½ day)                                                                        |
| **Outcome** | README says "Works in Brave" (with any known limits), or a list of issues to fix |

## 1. Why

Brave is Chromium-based and installs Chrome Web Store extensions. Users will try it. We should know what works before
they tell us.

## 2. Automated check: run the E2E suite in Brave

The Playwright fixture already accepts a browser binary (`PW_CHROMIUM_PATH`), and it loads `dist/` with
`--load-extension`. Point it at Brave:

```bash
npm run build
PW_CHROMIUM_PATH="C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" npm run test:e2e
```

Record pass/fail per spec. Expected differences to investigate, not assume:

| Area                                         | Risk in Brave                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `chrome.tabGroups`                           | Supported in recent Brave; verify grouping, colours, collapse                                 |
| `favicon` permission (`_favicon/`)           | May differ; check icons in Boards/Bookmarks                                                   |
| On-device AI (`LanguageModel`, `Summarizer`) | Not expected in Brave: features must fall back (site grouping, fallback drafts, no summaries) |
| `chrome.sessions`, `history`, `bookmarks`    | Should work; check the Sessions/History/Bookmarks views                                       |
| Notifications                                | Brave may route them differently; check due reminders/timer                                   |
| Service worker lifetime                      | Same engine; Park & Resume after idle                                                         |

If a test fails only because of a Brave difference (not a bug), mark it `test.skip(isBrave, reason)` with a
`process.env.PW_BROWSER === 'brave'` flag rather than weakening the test.

## 3. Manual pass (15 minutes)

Load `dist/` unpacked in Brave (`brave://extensions`, Developer mode). Walk through: onboarding, Today, add tabs to a
task, Start (group appears), Park (tabs close, note saved), Resume; Organize tabs (site grouping); New task from tabs
(fallback title); Boards folder + tab; Notes; Bookmarks; Sessions; export/import; light/dark. Note anything odd.

## 4. Result

- README "Installation": add Brave (install from the Chrome Web Store once listed; meanwhile load unpacked) and a
  "Known limits in Brave" line (e.g. "on-device AI isn't available; TabPlex uses its non-AI fallbacks").
- `CHROMEWEBSTORE.md`: nothing (Brave uses the Chrome listing).
- File issues for real bugs; ROADMAP #16 → ✅ with the date and Brave version.
