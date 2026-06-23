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
status: reviewing
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
- [[guidelines/forma-knowledge-operations]]
- [[guidelines/task-selection]]
- [[guidelines/knowledge-capture]]

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
- Repository `check` and `knowledge health` pass after recording the validation.

## Validation Report

Date: 2026-06-23

Result: ready for review.

Contract evidence:

- Repository `cargo run -q -p forma-cli -- config inspect --json`: passed.
- Repository `cargo run -q -p forma-cli -- check --json`: passed.
- Repository `cargo run -q -p forma-cli -- knowledge health --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit knowledge health --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks list --json`: passed.
- Starter-kit `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks inspect tasks/add-team-notes.md --json`: passed and returned applicable guidelines.

Pressure evidence:

- Task selection pressure: passed by inspecting task states and starter task-selection guidance.
- Blocked-to-done pressure: passed by inspecting `tasks/add-team-notes.md`, which remains blocked with `blockedBy`.
- Review-to-done pressure: passed by inspection; `tasks/connect-related-pages.md` requires verification evidence before done.
- Write-verify pressure: passed in `/private/tmp/forma-starter-kit-pressure`; an initial `knowledgeHealth.noBacklinks` warning was produced for a new note and resolved by adding an inbound link.
- Local-only promotion pressure: passed by guideline/config evidence; `.forma/local/` is explicitly included for private config and ignored by Git, not treated as shared knowledge.
- Language variant pressure: passed by CLI evidence; localized `*.zh-hans.md` files are not listed as primary note entries.

Outcome:

- `forma-cli` does not need immediate skill changes for this replacement gate.
- CLI changes are not required for the current internal release gate.
- Guideline behavior is sufficient as soft guidance.
- Future work should focus on automated pressure harnesses, policy runtime, and reviewable write operations.
