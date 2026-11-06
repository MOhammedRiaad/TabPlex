---
name: cycle
description: Run one full TabPlex delivery cycle with the project's specialist agents - product owner, architect, spec challenger, frontend engineer, unit and e2e test writers, browser tester, reviewer, security, code review, privacy, PR creator - with human verification gates and bounded fix loops. Use when the user says cycle, "next feature", "run the workflow", or hands over a feature idea or ROADMAP item to ship.
---

# Cycle: idea to PR

You are the **orchestrator**. Subagents cannot spawn subagents, so you run the pipeline from the main session: launch each agent with the Agent tool (`subagent_type` = its name), read its report, decide the next step. Do the thinking between steps; never skip a step silently.

**A human verifies before anything is reviewed or pushed.** The gates below are mandatory stops. Do not proceed past a gate on your own judgment, and do not treat silence as approval.

Argument: a feature idea, a ROADMAP item (`#29`), or nothing (the product owner picks).

## Pipeline

| #   | Agent               | Model  | Output (in `.claude/work/<slug>/` unless noted) | Gate after                             |
| --- | ------------------- | ------ | ----------------------------------------------- | -------------------------------------- |
| 1   | `product-owner`     | opus   | `01-brief.md` (or top-3 candidates)             | **G1** human approves brief/choice     |
| 2   | `architect`         | opus   | `docs/specs/<NAME>.md`                          |                                        |
| 3   | `spec-challenger`   | opus   | `03-challenge.md`                               | loop with architect, max 2 rounds      |
| -   | (you)               |        |                                                 | **G2** human approves the spec         |
| 4   | `frontend-engineer` | sonnet | code, commits, `04-build-log.md`                |                                        |
| 5   | `unit-test-writer`  | sonnet | `05-unit-tests.md`, tests                       | FIX loop, max 2 rounds                 |
| 6   | `e2e-test-writer`   | sonnet | `06-e2e-tests.md`, `e2e/*.spec.ts`              | FIX loop, max 2 rounds                 |
| 7   | `browser-tester`    | opus   | `07-test-report.md`, `07-human-checklist.md`    | FIX loop, max 2 rounds                 |
| -   | (you)               |        | `07-human-signoff.md`                           | **G3** human verifies in own browser   |
| 8   | `spec-reviewer`     | opus   | `08-review.md`                                  | FIX loop, max 2 rounds                 |
| 9   | `security-reviewer` | opus   | `09-security.md`                                | FIX loop, max 2 rounds                 |
| 10  | `code-reviewer`     | opus   | `10-code-review.md`                             | FIX loop, max 2 rounds                 |
| 11  | `privacy-reviewer`  | opus   | `11-privacy.md` (may edit docs)                 | FIX loop, max 2 rounds; **G4** open PR |
| 12  | `pr-creator`        | sonnet | PR into `develop`, `12-pr.md`                   | then offer the next cycle              |

## Steps

**0. Setup.** Check `git status` is clean and you are on `develop` (pull if behind). Pick a short kebab-case `<slug>`. Create `.claude/work/<slug>/`. Tell the user the slug and the plan in two lines.

**1. Product owner.** Prompt it with the idea (or "pick"). In pick mode, show the 3 candidates and ask which. Show the brief's problem, scope, acceptance criteria and open questions. **G1**: ask the user to approve or amend. Pass answers to open questions forward.

**2-3. Spec loop.** Run `architect` (give it the slug, brief path, G1 answers). Then `spec-challenger`. If `VERDICT: REVISE`, run `architect` again pointing at `03-challenge.md`, then `spec-challenger` again. After 2 rounds, stop looping and present the remaining findings to the user.

**G2.** Summarize: spec path, key decisions, challenger verdict and anything unresolved, open questions with recommendations. Wait for approval. Edits the user requests go back to `architect`.

**4. Build.** Create the branch: `git checkout -b feature/<slug>` from `develop`. Commit the spec if new (one `docs(specs): ...` commit; `.claude/work/` is git-ignored). Run `frontend-engineer` with the spec path. If it reports a blocking spec question, take it to the user, update the spec via `architect`, and resume.

**5-7. Test chain, in order.** Each of `unit-test-writer`, `e2e-test-writer`, `browser-tester` gets the slug and reads earlier reports itself. Read the verdict on the last line of each report.

- `PASS` -> next agent.
- `FIX` -> run `frontend-engineer` with the report path (it fixes the product bug and appends a fix round to the build log), then re-run **that same agent**. Max 2 rounds; then escalate to the user with the open findings.
- Test writers and the tester never fix product code. A failing correct test is a finding, not something to bend.

**G3: human verification (mandatory).** Run `npm run build`, then present `07-human-checklist.md` to the user and ask them to load `dist/` in Chrome (and Edge if they can) and walk it. Include what the tester found and any NOT TESTED browser. Stop and wait. The user answers with pass, or a list of problems.

- Write their answer verbatim to `.claude/work/<slug>/07-human-signoff.md` (date, browsers, result).
- Problems -> `frontend-engineer` with the signoff as the report, then `unit-test-writer`/`e2e-test-writer` for a regression test per bug (they read the signoff), then `browser-tester` on the affected parts, then G3 again. Do not count these toward the 2-round caps; ask the user if it reaches 3 loops.
- Only an explicit "pass" moves on. If the user reports a spec problem rather than a code problem, go back to `architect`.

**8-11. Review chain, in order.** Run `spec-reviewer`, `security-reviewer`, `code-reviewer`, `privacy-reviewer`.

- `PASS` -> next reviewer.
- `FIX` -> `frontend-engineer` with the report path, then re-run **that same reviewer**. Max 2 fix rounds per reviewer; then escalate with the open findings.
- If a fix changes behavior (not just style), the human signoff is stale: re-run `unit-test-writer`/`e2e-test-writer` as needed, list exactly what changed, and ask the user to re-verify those points (a short **G3** re-check) before continuing.
- A reviewer that wants a spec change sends the finding to `architect`, then `frontend-engineer`, then the test chain for the changed part.
- Default is sequential so each reviewer sees prior fixes. Run them in parallel only if the user asks for speed.

**G4.** Show: acceptance table from `08-review.md`, verdicts of all reports, accepted MINOR findings, verify results, the human signoff, and anything the user must do manually (reload, reinstall for a new permission). Ask: "Open the PR into develop?" Wait.

**12. PR.** Run `pr-creator` and tell it the user approved. Return the PR URL.

**13. Next cycle.** Offer another round; the product owner proposes the next 3 items from the ROADMAP. Do not start automatically. Append one line to `.claude/work/log.md` (date, slug, PR URL, fix rounds used per loop, number of G3 loops).

## Rules

- Hand agents **paths, not pasted content**; state the slug in every prompt. Agents start cold: anything a later agent needs must be in the work folder, the spec, or your prompt.
- Never merge a PR, push to `develop`/`main`, or bypass hooks. Never mark a verdict PASS yourself; only the agent's report line counts. Never write a human signoff yourself.
- If an agent errors or returns without its output file, re-run it once with the failure noted; then ask the user.
- To resume a half-finished cycle, read the work folder: the highest-numbered report and its verdict tell you where you are.
- Small fixes (typo, one-line bug, docs) don't need a cycle: use the `commit` and `verify` skills directly.
- Keep messages at each gate short: what was produced, what needs a decision, your recommendation.
