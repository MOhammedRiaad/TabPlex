# Agentic workflow

How TabPlex features go from idea to pull request using purpose-built subagents instead of one general chat, with a human verifying at every point that matters. Run it with `/cycle`.

## Why

A general agent plans, builds and approves its own work, so it misses what it did not think of. The cycle separates roles, gives each a narrow brief and the right model, and makes every handoff a file a human can read.

## Roles

| Agent               | Model  | Question it answers                             | Writes                                       | Cannot                      |
| ------------------- | ------ | ----------------------------------------------- | -------------------------------------------- | --------------------------- |
| `product-owner`     | opus   | What, for whom, how do we know it is done?      | `01-brief.md`                                | design or code              |
| `architect`         | opus   | How, in this codebase, precisely?               | `docs/specs/<NAME>.md`                       | implement                   |
| `spec-challenger`   | opus   | What is wrong or missing in the spec?           | `03-challenge.md`                            | edit spec or source         |
| `frontend-engineer` | sonnet | Build it to the spec                            | code, commits, `04-build-log.md`             | change the design silently  |
| `unit-test-writer`  | sonnet | Do independent unit/component tests prove it?   | `05-unit-tests.md`, `__tests__/`             | edit product code           |
| `e2e-test-writer`   | sonnet | Does it work end to end in the built extension? | `06-e2e-tests.md`, `e2e/*.spec.ts`           | edit product code           |
| `browser-tester`    | opus   | What breaks when a user actually uses it?       | `07-test-report.md`, `07-human-checklist.md` | edit anything               |
| `spec-reviewer`     | opus   | Does it meet every acceptance criterion?        | `08-review.md`                               | edit source                 |
| `security-reviewer` | opus   | Can it be abused?                               | `09-security.md`                             | edit source                 |
| `code-reviewer`     | opus   | Is the code correct and maintainable?           | `10-code-review.md`                          | edit source                 |
| `privacy-reviewer`  | opus   | Is the local-first promise still true in text?  | `11-privacy.md`, privacy docs                | edit source or manifest     |
| `pr-creator`        | sonnet | Package, push, open the PR into `develop`       | PR, `12-pr.md`                               | merge, push to develop/main |

Model rationale: judgment and adversarial work (what to build, what is wrong, is it safe, what does a user hit) runs on opus. Execution against a precise spec, test writing and mechanical packaging run on sonnet; the spec, the independent tests and the review chain keep that cheaper model honest. Change a model in the agent's frontmatter.

Why separate test writers: the engineer writes tests next to their own code and shares its blind spots. The test writers derive tests from the brief and spec first and read the code second, so a wrong assumption in the implementation gets caught instead of confirmed.

## Flow

```
idea / ROADMAP ─► product-owner ─► [G1 human] ─► architect ◄──┐
                                                    │          │ REVISE (max 2)
                                                    ▼          │
                                             spec-challenger ──┘
                                                    │ PASS
                                              [G2 human approves spec]
                                                    ▼
                                          frontend-engineer ◄───────────────┐
                                                    ▼                       │ FIX (max 2 per agent)
                       unit-test-writer ─► e2e-test-writer ─► browser-tester ┤
                                                    ▼                       │
                              [G3 human verifies in own browser] ── problems ┘
                                                    │ explicit "pass"
                                                    ▼
                     spec-reviewer ─► security ─► code-reviewer ─► privacy ─► (FIX back to engineer)
                                                    ▼
                                           [G4 human: open PR?]
                                                    ▼
                                    pr-creator ─► PR into develop ─► next cycle
```

## Handoffs

All state lives in `.claude/work/<slug>/` (git-ignored) plus the spec in `docs/specs/`. Agents start cold, so a file is the only way context moves. Every report ends with a machine-readable last line: `VERDICT: PASS`, `FIX` or `REVISE`. `.claude/work/log.md` keeps one line per finished cycle.

## Human gates

- **G1** brief approved (scope and acceptance criteria are the contract).
- **G2** spec approved (last cheap point to change direction).
- **G3** human verification: the tester produces a checklist (`07-human-checklist.md`); you load `dist/` in Chrome (and Edge) and walk it. Your answer is recorded in `07-human-signoff.md`. Only an explicit pass continues, and the PR agent refuses to run without it. If a later fix changes behavior, you re-check just those points.
- **G4** before anything is pushed.

Merging a PR, releasing and reinstalling the extension stay manual.

## Using it

- `/cycle` : product owner proposes the top 3 ROADMAP items.
- `/cycle #29` or `/cycle "pin boards to the top"` : start from a given item or idea.
- A single agent can be used alone, e.g. ask for `security-reviewer` or `browser-tester` on any branch; they work from `git diff develop...HEAD` and `dist/`.
- Skip the cycle for typos, one-line fixes and docs: use `commit` and `verify`.

## Browser testing setup

The `browser-tester` uses the `chrome-devtools` and `edge-devtools` MCP servers (see CLAUDE.md "Chrome tooling for agents"). Allow remote debugging per browser session. If a browser is unavailable the report marks it NOT TESTED rather than claiming coverage; that is exactly what you should cover at G3. A newly added permission needs the unpacked extension removed and loaded again.

## Tuning

- Agents are plain Markdown in `.claude/agents/`; skills in `.claude/skills/`. Edit prompts when a stage keeps missing something: add the miss to that agent's checklist so the lesson sticks.
- Watch `log.md`: frequent fix-loop exhaustion means the spec stage is too weak; many G3 loops mean the tester or e2e writer is missing real-use problems; frequent challenger REVISE after two rounds means the brief is vague.
- The project rules (`CLAUDE.md`, ROADMAP decisions, the `verify` skill) are what agents read; keep them current and the agents stay current.
