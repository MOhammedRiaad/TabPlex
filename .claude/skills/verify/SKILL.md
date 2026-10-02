---
name: verify
description: Verify a TabPlex change is complete — typecheck, zero-warning lint, prettier check and production build. Use before saying any code change is done, before committing, or when asked to "check", "validate" or "make sure it builds".
---

# Verify

The project has no test suite, so these checks are the definition of done. Run from the repo root, in order, and stop at the first failure.

```bash
npx tsc --noEmit          # strict TS (noUnusedLocals/Parameters on)
npm run lint              # eslint --max-warnings 0 — a single warning fails
npm run format:check      # prettier
npm run build             # tsc && vite build -> dist/
```

If `node_modules` is missing, run `npm install` first.

## Fixing failures

- **Prettier**: run `npm run format`, then re-check. Never hand-format against `.prettierrc` (4 spaces, single quotes, width 120, `arrowParens: avoid`).
- **Lint**: fix the cause. Unused vars/args → remove or prefix with `_`. `no-explicit-any` → use a type from `src/types/index.ts` or `unknown` + narrowing. Only add `eslint-disable-next-line` with a reason, as in `safeSendResponse`.
- **Types**: shared interfaces live in `src/types/index.ts`; store slice signatures in `src/store/slices/board/types.ts`. Update the type, don't cast around it.
- **Build**: confirm `dist/manifest.json` and `dist/src/background/background.js` exist afterwards — the manifest points at that exact path.

## Report

Tell the user which checks passed. If a check can't run (no Node, no network for install), say so explicitly rather than claiming success.

Manual smoke test the user can do: `chrome://extensions` → Load unpacked → `dist/` (or click reload on the card) → click the toolbar icon → exercise the changed feature in two TabPlex tabs to confirm cross-tab sync.
