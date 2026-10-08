---
name: verify
description: Verify a TabPlex change is complete — typecheck, zero-warning lint, prettier check, unit tests with the 85% coverage gate, production build and (for browser-facing changes) the Playwright E2E suite. Use before saying any code change is done, before committing, or when asked to "check", "validate" or "make sure it builds".
---

# Verify

These checks are the definition of done (CI runs the same). Run from the repo root, in order, and stop at the first failure.

```bash
npm run typecheck         # strict TS for src/ and e2e/ (noUnusedLocals/Parameters on)
npm run lint              # eslint --max-warnings 0 — a single warning fails
npm run format:check      # prettier
npm run build:privacy -- --check  # landing-page/privacy.html matches PRIVACY.md
npm run test:coverage     # vitest; fails below 85% statements/branches/functions/lines
npm run build             # tsc && vite build -> dist/
npm run check:bundle      # every JS chunk under 500 kB except the lazy tldraw canvas
npm run test:e2e          # only when tabs, groups, background or Park & Resume changed; needs the build
```

If `node_modules` is missing, run `npm install` first.

## Fixing failures

- **Prettier**: run `npm run format`, then re-check. Never hand-format against `.prettierrc` (4 spaces, single quotes, width 120, `arrowParens: avoid`).
- **Privacy page**: `landing-page/privacy.html` is generated from `PRIVACY.md`. After any `PRIVACY.md` edit, run `npm run build:privacy` and commit the regenerated page with it.
- **Lint**: fix the cause. Unused vars/args → remove or prefix with `_`. `no-explicit-any` → use a type from `src/types/index.ts` or `unknown` + narrowing. Only add `eslint-disable-next-line` with a reason, as in `safeSendResponse`.
- **Types**: shared interfaces live in `src/types/index.ts`; store slice signatures in `src/store/slices/board/types.ts`. Update the type, don't cast around it.
- **Tests**: read the assertion before touching it — a failing test is often a real bug. New code needs tests next to it
  (`__tests__/`); use `src/test/chromeMock.ts` and `src/test/factories.ts` rather than ad-hoc mocks. If coverage drops,
  open `coverage/index.html` to find the uncovered lines.
- **E2E**: traces of failures land in `test-results/`; open with `npx playwright show-trace <trace.zip>`.
- **Build**: confirm `dist/manifest.json` and `dist/src/background/background.js` exist afterwards — the manifest points at that exact path.

## Report

Tell the user which checks passed. If a check can't run (no Node, no network for install), say so explicitly rather than claiming success.

Manual smoke test the user can do: `chrome://extensions` → Load unpacked → `dist/` (or click reload on the card) → click the toolbar icon → exercise the changed feature in two TabPlex tabs to confirm cross-tab sync.
