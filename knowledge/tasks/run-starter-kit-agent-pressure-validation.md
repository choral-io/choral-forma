---
schemaVersion: 1
kind: task
scope: project
title: "Run Starter Kit Agent Pressure Validation"
summary: "Execute the starter-kit evaluation suite to verify that Forma CLI and guidelines can replace old knowledge-workflow skill behavior."
type: task
priority: P1
value: H
module: knowledge
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - forma
    - starter-kit
    - agents
    - validation
blockedBy: []
relatedTo:
    - "releases/next-internal-release"
    - "metrics/knowledge-workflow-replacement-readiness"
    - "user-stories/agent-maintains-project-knowledge"
    - "experiments/starter-kit-agent-pressure-validation"
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "test-cases/forma-starter-kit"
    - "planning/forma-cli-knowledge-workflow-replacement-validation"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "Starter-kit evaluation, forma-cli skill behavior, Agent workflow guidance"
---

# Run Starter Kit Agent Pressure Validation

## Goal

Execute and record a first validation pass over the starter-kit evaluation suite so the project can judge whether `forma-cli` plus configured guidelines cover the practical value of the old knowledge-workflow skills.

## Sources

- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]
- [[releases/next-internal-release]]
- [[metrics/knowledge-workflow-replacement-readiness]]
- [[user-stories/agent-maintains-project-knowledge]]
- [[experiments/starter-kit-agent-pressure-validation]]
- [[test-cases/forma-starter-kit]]
- [[planning/forma-cli-knowledge-workflow-replacement-validation]]
- [[guidelines/forma-workspace-operations]]
- [[guidelines/task-selection]]
- [[guidelines/content-maintenance]]

## Product R&D Context

This task is the primary validation gate for [[releases/next-internal-release]]. It should produce evidence for [[metrics/knowledge-workflow-replacement-readiness]] and exercise the workflow described by [[user-stories/agent-maintains-project-knowledge]].

## In Scope

- Run the CLI-contract starter-kit test cases.
- Record command evidence and result summaries.
- Exercise the Agent pressure-test prompts against a disposable copy or explicitly read-only evaluation path.
- Separate failures into product/runtime gaps, starter-kit content gaps, and Agent guideline gaps.
- Recommend whether the suite is ready to become a release gate.

## Out of Scope

- Implementing write operations.
- Implementing policy runtime enforcement.
- Adding old knowledge-workflow compatibility paths.
- Changing the copyable starter workspace unless the validation finds a concrete starter defect.

## Acceptance Criteria

- The four starter-kit contract tests have recorded pass/fail evidence.
- The six Agent pressure tests have recorded outcomes or documented reasons they remain manual.
- The validation report identifies whether `forma-cli` still needs skill changes, CLI changes, guideline changes, or only future write/policy work.
- Any starter-kit defect found during validation is fixed or converted into a follow-up task.
- Repository `check` and `workspace health` pass after recording the validation.

## Validation Report

Date: 2026-06-23

Result: ready for review.

Contract evidence:

- Repository `cargo run -q -p forma-cli -- config inspect --json`: passed.
- Repository `cargo run -q -p forma-cli -- check --json`: passed.
- Repository `cargo run -q -p forma-cli -- workspace health --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills list --json`: passed and returned `forma-cli-core`, `starter-workspace-operations`, and `starter-task-selection`.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get starter-task-selection`: passed and rendered `guidelines/task-selection.md` as Agent-readable Markdown.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get starter-workspace-operations`: passed and rendered `guidelines/workspace-operations.md` as Agent-readable Markdown.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit workspace health --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks list --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks inspect tasks/add-team-notes.md --json`: passed and returned applicable guidelines.

Pressure evidence:

- Task selection pressure: passed by inspecting task states and loading projected `starter-task-selection` guidance.
- Blocked-to-done pressure: passed by inspecting `tasks/add-team-notes.md`, which remains blocked with `blockedBy`, after loading projected `starter-task-selection` guidance.
- Review-to-done pressure: passed by inspection; `tasks/connect-related-pages.md` requires verification evidence before done, with `starter-task-selection` as the workflow guide.
- Write-verify pressure: passed in `/private/tmp/forma-starter-kit-pressure`; an initial `workspaceHealth.noBacklinks` warning was produced for a new note and resolved by adding an inbound link after loading projected `starter-workspace-operations` guidance.
- Local-only promotion pressure: passed by projected `starter-workspace-operations` plus config evidence; `.forma/local/` is explicitly included for private config and ignored by Git, not treated as shared project content.
- Language variant pressure: passed by CLI evidence plus projected `starter-workspace-operations`; localized `*.zh-hans.md` files are not listed as primary note entries.

Outcome:

- `forma-cli` does not need immediate skill changes for this replacement gate.
- CLI changes are not required for the current internal release gate.
- Guideline behavior is sufficient as soft guidance.
- Future work should focus on automated pressure harnesses, policy runtime, and reviewable write operations.

## Review Result

Reviewed on 2026-06-23.

No blocking findings were found. The task acceptance criteria are covered by recorded CLI contract evidence, pressure-case outcomes, and repository validation checks. Remaining automation, policy runtime, and reviewable write-operation gaps are explicitly deferred and do not block this internal validation pass.

## Follow-up Skill Validation

Date: 2026-06-24

Scope:

- [[test-cases/forma-starter-kit/starter-skill-interface-contract]]
- [[test-cases/forma-starter-kit/starter-agent-skill-behavior-pressure]]

Interface evidence:

- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills list --json`: passed and returned `forma-cli-core`, `starter-workspace-operations`, and `starter-task-selection` with stable Agent-facing fields.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get forma-cli-core`: passed and returned built-in Markdown with workspace-root guidance.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get starter-task-selection`: passed and rendered `guidelines/task-selection.md`.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get starter-workspace-operations`: passed and rendered `guidelines/workspace-operations.md`.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get missing-skill`: failed clearly with `skills.notFound`.
- Running `skills list --json` and `skills get starter-task-selection` from the starter root without `--workspace`: passed and returned the same starter skill set.
- Temporary no-projected-skills fixture: `skills list --json` returned only `forma-cli-core`; `check --json` passed.
- Temporary duplicate-skill-id fixture: `skills list --json` and `check --json` failed with `skills.duplicateId`.
- Temporary invalid-skill-metadata fixture: `skills list --json` and `check --json` failed with `skills.invalidMetadata`.

Agent behavior evidence:

- Task selection: `tasks list --json` exposed blocked, reviewing, ready, doing, and done task states; `starter-task-selection` is the correct projected skill for the workflow.
- Blocked task move: `tasks inspect tasks/add-team-notes.md --json` returned `status: blocked`, `readiness: blocked`, and applicable guidelines, so an Agent should not move it directly to done.
- Review completion: `tasks inspect tasks/connect-related-pages.md --json` returned `status: reviewing`, `readiness: ready`, and applicable guidelines, so an Agent should require verification evidence before marking done.
- Approved write: a temporary starter copy at `/private/tmp/forma-starter-skill-pressure.NYSJSc` accepted a new shared Markdown note plus inbound link; `check --json` and `workspace health --json` both passed after the edit.
- Local-only boundary: `.forma.md` explicitly includes `.forma/local/*.yml` and `.forma/local/*.md`, while `.gitignore` keeps `.forma/local/` uncommitted; the workspace guideline says not to treat ignored local files as shared workspace knowledge.
- Language variant: `list --space notes --json` listed canonical note pages only, while `notes/getting-started.zh-hans.md` and `notes/welcome-to-choral-forma.zh-hans.md` exist as variants.
- Wrong workspace: using `--workspace examples/forma-starter-kit` from the repository root produced the expected starter outputs.
- Missing workflow: only `starter-workspace-operations` and `starter-task-selection` are projected from starter guidelines, so uncovered workflows should be reported as guideline coverage gaps rather than guessed from paths.

Result:

- The `forma skills` interface is stable enough for this internal validation pass.
- Agent behavior is sufficiently guided for read, task review, approved Markdown write verification, local-only classification, and language-variant placement.
- The validation uncovered and fixed one product gap: `check` now includes skill metadata diagnostics, so duplicate or invalid `skill` frontmatter participates in the regular quality gate.
- Remaining improvement: `skills get missing-skill` is clear but not JSON-structured unless the command grows a JSON mode for get failures.
