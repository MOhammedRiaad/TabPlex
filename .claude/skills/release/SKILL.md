---
name: release
description: Ship a TabPlex version — releases are automated by semantic-release + GitHub Actions on merge to main. Use when the user says release, publish, ship, bump version, changelog, GitHub release or package the extension.
---

# Release

Versions, tags, `CHANGELOG.md` and GitHub releases are produced automatically by **semantic-release** when commits land on `main` (`.github/workflows/release.yml`, config in `.releaserc.json`). Never edit `version` in `package.json` / `manifest.json` by hand.

## Ship a release

1. Make sure the work is on a `feature/*` branch with Conventional Commit messages (see the `commit` skill). The commit types decide the bump:
   - `feat` → minor · `fix` / `perf` / `refactor` → patch · `type!:` or a `BREAKING CHANGE:` footer → major
   - `docs` `style` `test` `build` `ci` `chore` → no release
2. Run the `verify` skill.
3. Preview (optional): `GITHUB_TOKEN=<token> npm run release:dry` shows the next version and the release notes.
4. Open a PR to `main`; CI (`ci.yml`) must pass. It also uploads the packaged zip as a build artifact for testing.
5. Merge. The Release workflow syncs the version into `package.json`, `package-lock.json`, `manifest.json`, builds, zips `dist/` to `release/tabplex-vX.Y.Z.zip`, commits `chore(release): X.Y.Z [skip ci]`, tags `vX.Y.Z`, and publishes the GitHub release with the zip attached.
6. Pull `main` locally afterwards (the bot pushed a commit).

## Microsoft Edge Add-ons (automatic)

After semantic-release, `release.yml` runs `npm run publish:edge` (`scripts/publish-edge.mjs`): upload the new zip, wait, submit for review, wait. It needs the secrets `EDGE_CLIENT_ID`, `EDGE_API_KEY`, `EDGE_PRODUCT_ID` (skipped without them) and only updates an extension already published once by hand. `InProgressSubmission` means the previous version is still in review: re-run the workflow later. API keys expire: renew them in Partner Center → Publish API and update `EDGE_API_KEY`.

## Chrome Web Store

Store upload stays manual: download `tabplex-vX.Y.Z.zip` from the GitHub release, smoke-test it unpacked (onboarding, add tab to folder, tasks, export/import, session restore, Park & Resume), then upload it in the Web Store dashboard. If `manifest.json` permissions changed, update `PRIVACY.md` and the README "Permissions Explained" first.

## CHROMEWEBSTORE.md (store listing source of truth)

`CHROMEWEBSTORE.md` at the repo root holds every store field for Chrome and Edge (description, single purpose, permission justifications, data use, assets, version history, review notes), in the format of Chrome's `chrome-extensions` agent skill. It isn't shipped (the zip is `dist/` only).

- Any user-facing, permission or privacy change: update it in the same PR (its "Keep it current" list).
- Each store submission: add or update its Version History row (Submitted → In Review → Published / Rejected), and bump "Last Updated".
- A rejection: record it under Review Notes → Rejection History with the fix.
- Store copy: lead with what it does for the user; no API, library or architecture names. The single purpose names one purpose, not a feature list.
- Before submitting, run Chrome's [pre-publish review checklist](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/chrome-extensions/references/webstore/review-checklist.md) (with the `chrome-extensions` skill installed: `references/webstore/review-checklist.md`).

## Troubleshooting

- **No release happened**: only `docs/chore/ci/...` commits since the last tag, or the workflow failed — check the Actions tab. semantic-release opens an issue on failure.
- **Push rejected**: `main` is protected — let GitHub Actions bypass the rule or use a PAT secret.
- **Invalid version**: Chrome needs plain integers; pre-release suffixes are rejected by `scripts/sync-version.mjs`.
- **Manual packaging** (emergency): `npm run build && npm run package` → `release/`.
