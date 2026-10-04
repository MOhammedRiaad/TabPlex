# Maintenance & Contribution Guide

This guide outlines the workflows for maintaining, extending, and releasing TabPlex.

## 🛠️ Development Workflow

### Prerequisites

- Node.js 16+
- NPM 8+

### Setup

```bash
git clone <repo>
npm install
```

### Daily Dev Loop

1. **Start Dev Server**: `npm run dev`
    - This watches for file changes and continually rebuilds.
2. **Load in Chrome**:
    - Go to `chrome://extensions`
    - "Load Unpacked" -> Select `dist/` folder.
    - **Note**: You must reload the extension in `chrome://extensions` manually if you change `manifest.json` or background scripts. UI changes usually hot-reload (or require a simple tab refresh).

---

## ✨ Adding a New Feature

Follow this checklist to add a new "slice" of functionality (e.g., "Reminders") without breaking the architecture.

### 1. Define Types

- [ ] Add interfaces to `src/types/index.ts`.
- [ ] Ensure they are exported.

### 2. Create Storage Layer

- [ ] Update `src/utils/storage.ts`:
    - Add `REMINDERS_STORE` constant.
    - Add `addReminder`, `updateReminder`, `deleteReminder` functions.
    - initializing the store in `initDB`.

### 3. Create Store Slice

- [ ] Create `src/store/slices/board/reminderSlice.ts`.
- [ ] Define `ReminderSlice` interface.
- [ ] Implement `createReminderSlice`.
    - **CRITICAL**: Ensure actions persist to DB **and** send `chrome.runtime.sendMessage`.
- [ ] Add slice to `src/store/boardStore.ts`.

### 4. Background Support (Optional)

- [ ] If background logic is needed, update `src/background/storage.ts` (import shared types!).
- [ ] Add `src/background/reminder-service.ts`.
- [ ] Register in `src/background/message-handler.ts`.

### 5. UI Implementation

- [ ] Create `src/features/reminders/`.
- [ ] Create components and views.
- [ ] Add route to `src/routes.tsx`.

---

## 🧪 Testing

- `npm test` / `npm run test:watch` — Vitest unit and component tests (jsdom, in-memory `chrome` mock, fake IndexedDB).
- `npm run test:coverage` — fails below 85% for statements, branches, functions or lines. HTML report in `coverage/`.
- `npm run test:e2e` — Playwright loads `dist/` into Chromium and runs the Park & Resume flows; build first.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, format, coverage and build, plus a separate E2E job. The release
  workflow runs the unit tests before publishing.
- When fixing a bug, add a test that fails without the fix.

---

## 🚀 Release Process

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/) and GitHub Actions. **Never bump versions by hand.**

### Until v1.0.0: the `develop` branch

Every push to `main` publishes a release, and the first one will be **v1.0.0** (no tag exists yet). v1.0.0 is reserved for the Chrome Web Store launch (`ROADMAP.md`, decisions D1–D3), so until then:

- Feature branches open PRs into **`develop`**. CI runs there as on any branch.
- When the v1.0 queue in `ROADMAP.md` is done, `develop` is merged into `main` **once**. That push releases `v1.0.0`.
- Don't create release tags by hand. semantic-release creates `v1.0.0` itself.
- After launch, go back to the flow below (feature → `main`) and delete `develop`, or keep it as the integration branch if that works better.

### How it works

1. Work on a `feature/*` branch with [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint). CI (`.github/workflows/ci.yml`) runs lint, format check and build on every PR and uploads the packaged zip as an artifact.
2. Merge the PR into `main` (after v1.0.0; see above). The **Release** workflow (`.github/workflows/release.yml`) then:
    - works out the next version from the commits since the last tag:

        | Commit                                           | Release               |
        | ------------------------------------------------ | --------------------- |
        | `fix:` `perf:` `refactor:`                       | patch (1.1.0 → 1.1.1) |
        | `feat:`                                          | minor (1.1.0 → 1.2.0) |
        | `feat!:` / `BREAKING CHANGE:` footer             | major (1.1.0 → 2.0.0) |
        | `docs:` `style:` `test:` `build:` `ci:` `chore:` | no release            |

    - sets the version in `package.json`, `package-lock.json` and `manifest.json` (`scripts/sync-version.mjs`)
    - builds and zips `dist/` into `release/tabplex-vX.Y.Z.zip` (`scripts/package-extension.mjs`)
    - updates `CHANGELOG.md`, commits `chore(release): X.Y.Z [skip ci]` and tags `vX.Y.Z`
    - publishes a GitHub release with the notes and the zip attached

3. Download the zip from the GitHub release and upload it to the Chrome Web Store dashboard. Store publishing stays manual.

### Useful commands

```bash
npm run release:dry                 # preview the next version and notes locally (needs GITHUB_TOKEN)
node scripts/sync-version.mjs 1.2.0 # set a version by hand (emergencies only)
npm run build && npm run package    # build + zip locally → release/
```

### Notes

- The release bot pushes to `main`. If `main` is protected, allow GitHub Actions to bypass the rule (or use a PAT secret instead of `GITHUB_TOKEN`).
- Chrome versions must be plain integers (`1.2.3`); pre-release tags such as `-beta.1` are rejected by `sync-version.mjs`.
- Test the zip before uploading: load the unzipped folder in `chrome://extensions` and check data import, session restore and Park & Resume.

---

## 🔍 Troubleshooting

### "Changes not showing up"

- **UI**: Refresh the tab.
- **Background/Manifest**: Go to `chrome://extensions` and click the refresh icon on the extension card.

### "Data not syncing"

- Check the console for "Message port closed" errors.
- Verify `useStorageSync.ts` has a case for your new message type.
- Ensure your store slice is calling `chrome.runtime.sendMessage`.

### "Build fails on Types"

- We use strict TypeScript. `any` is discouraged.
- Check `src/types/index.ts` for discrepancies.
