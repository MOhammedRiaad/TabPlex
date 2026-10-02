---
name: release
description: Prepare a TabPlex release — bump version in package.json and manifest.json, verify, build and zip dist/ for the Chrome Web Store. Use when the user says release, publish, ship, bump version or package the extension.
---

# Release

1. **Confirm the version** with the user (semver). Note `package.json` (currently `0.0.0`) and `manifest.json` (`1.0.0`) have drifted — set both to the same new value.
2. **Bump** `"version"` in `package.json` and `manifest.json`. Chrome requires 1–4 dot-separated integers (no `-beta` suffix in the manifest).
3. **Permissions review** — if `manifest.json` permissions or `host_permissions` changed since last release, make sure `PRIVACY.md` and README "Permissions Explained" describe them (Web Store review checks this).
4. **Verify** — run the `verify` skill; all four checks must pass.
5. **Clean build** — delete `dist/` first so stale hashed assets aren't shipped, then `npm run build`. Confirm `dist/manifest.json` shows the new version.
6. **Package** — zip the _contents_ of `dist/` (manifest.json at the zip root), e.g. `TabPlex-v<version>.zip`:
    - bash: `cd dist && zip -r ../TabPlex-v<version>.zip . && cd ..`
    - PowerShell: `Compress-Archive -Path dist\* -DestinationPath TabPlex-v<version>.zip -Force`
      Don't commit the zip.
7. **Smoke test** — load the fresh `dist/` unpacked; test onboarding, adding a tab to a folder, tasks, export/import, session restore.
8. **Commit & tag** — `chore(release): v<version>` then `git tag v<version>`. Push only if the user asks.
9. Update `ROADMAP.md` if milestones were completed.
