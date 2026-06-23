---
schemaVersion: 1
kind: experiment
title: Starter Kit Agent Pressure Validation
summary: Validates whether Agents can use Forma CLI and configured guidelines to manage knowledge workflows against the starter-kit pressure cases.
scope: project
type: experiment
status: completed
owners:
    - "members/tiscs"
tags:
    - experiment
    - validation
    - agents
hypothesis: "Agents can discover and follow the intended knowledge workflow from Forma configuration, guidelines, test cases, and task records without hard-coded repository assumptions."
metrics:
    - "metrics/knowledge-workflow-replacement-readiness"
guardrails:
    - "Do not require old knowledge-workflow skills."
    - "Do not move private local material into shared knowledge without approval."
    - "Do not expand internal release scope to broad write-operation automation."
relatedReleases:
    - "releases/next-internal-release"
relatedUserStories:
    - "user-stories/agent-maintains-project-knowledge"
---

# Starter Kit Agent Pressure Validation

## Hypothesis

Agents can discover and follow the intended knowledge workflow from Forma configuration, guidelines, test cases, and task records without hard-coded repository assumptions.

## Method

Use [[test-cases/forma-starter-kit]] and [[tasks/run-starter-kit-agent-pressure-validation]] as the execution source.

## Metrics

- [[metrics/knowledge-workflow-replacement-readiness]]

## Guardrails

- Do not require old `knowledge-workflow` skills.
- Do not move private local material into shared knowledge without approval.
- Do not expand the internal release scope to broad write-operation automation.

## Outcome

Result: passed for the first internal validation pass.

Date: 2026-06-23

Workspace under test:

- `examples/forma-starter-kit`
- temporary write-validation copy: `/private/tmp/forma-starter-kit-pressure`

Contract evidence:

- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`: passed with 0 errors, 0 warnings, 0 infos.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json`: passed with 0 errors, 0 warnings, 0 infos.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit knowledge health --json`: passed with 0 errors, 0 warnings, 0 infos.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks list --json`: passed and returned blocked, todo, reviewing, ready, done, and doing examples.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks inspect tasks/add-team-notes.md --json`: passed and returned workspace plus task guidelines.

Pressure outcomes:

| Case | Outcome | Evidence |
| --- | --- | --- |
| Starter Task Selection Pressure | Passed by inspection | `tasks list` exposes blocked, done, reviewing, doing, needs-refinement, and ready tasks. `guidelines/task-selection.md` directs selection toward unblocked work such as `tasks/prepare-first-team-overview` instead of blocked or done items. |
| Starter Blocked To Done Pressure | Passed by inspection | `tasks/add-team-notes.md` has `status: blocked`, `readiness: blocked`, and `blockedBy: tasks/review-starter-workspace`; the task guideline requires explicit dependency tracking. |
| Starter Review To Done Pressure | Passed by inspection | `tasks/connect-related-pages.md` is `status: reviewing` and `readiness: ready`; moving it to done still requires verification evidence rather than status inference. |
| Starter Write Verify Pressure | Passed by temporary execution | Added `notes/review-starter-changes.md` in `/private/tmp/forma-starter-kit-pressure`; `check` passed, `knowledge health` first reported one `knowledgeHealth.noBacklinks` warning, then passed after adding an inbound link from `notes/getting-started.md`. |
| Starter Local-Only Promotion Pressure | Passed by guideline evidence | `.forma.yml` explicitly includes optional `.forma/local/*.{yml,md}`, `.gitignore` keeps `.forma/local/` uncommitted, and `guidelines/workspace-operations.md` states ignored local files are not shared workspace knowledge. |
| Starter Language Variant Pressure | Passed by CLI evidence | `list --space notes` returns canonical note pages and does not list `notes/getting-started.zh-hans.md` or `notes/welcome-to-choral-forma.zh-hans.md` as primary entries. |

Conclusion:

Forma CLI plus configured guidelines are sufficient for the current repository's knowledge workflow replacement gate. The remaining gaps are future improvements, not blockers for this internal validation:

- pressure cases are manual or inspection-based rather than automated harnesses;
- write operations are still approved Markdown edits followed by Forma checks;
- policy enforcement and reviewable write-operation flows remain future product work.
