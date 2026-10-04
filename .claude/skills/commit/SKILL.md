---
name: commit
description: Create a git commit in TabPlex that passes the husky pre-commit (lint-staged) and commit-msg (commitlint, Conventional Commits) hooks. Use when asked to commit, or to write a commit message.
---

# Commit

Only commit when the user asks. Don't push unless asked.

1. `git status` / `git diff` — review what's staged. Don't include `dist/`, zips, or unrelated line-ending-only changes (this repo is edited on Windows; if many files show as modified with no content diff, mention it and leave them out).
2. Prefer a feature branch (`feature/<name>`) over committing directly to `main`.
3. Message format (commitlint `config-conventional`):

    ```
    <type>(<optional scope>): <imperative summary, lower-case, no period>

    <optional body — why, not what>
    ```

    Types: `feat`, `fix`, `refactor`, `perf`, `style`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. Header ≤ 100 chars. Scopes used in this repo map to features: `boards`, `tasks`, `notes`, `sessions`, `canvas`, `bookmarks`, `history`, `background`, `store`.

4. The pre-commit hook runs prettier + `eslint --fix` on staged files; if it fails, fix the lint error (see `verify`) and commit again — never use `--no-verify`.
