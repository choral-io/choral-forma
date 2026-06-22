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
status: ready
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - starter-kit
    - agents
    - validation
blocked_by: []
related_to:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "test-cases/forma-starter-kit"
    - "planning/forma-cli-knowledge-workflow-replacement-validation"
severity: ""
sprint: ""
reported_by: ""
affected_area: "Starter-kit evaluation, forma-cli skill behavior, Agent workflow guidance"
---

# Run Starter Kit Agent Pressure Validation

## Goal

Execute and record a first validation pass over the starter-kit evaluation suite so the project can judge whether `forma-cli` plus configured guidelines cover the practical value of the old knowledge-workflow skills.

## Sources

- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]
- [[test-cases/forma-starter-kit]]
- [[planning/forma-cli-knowledge-workflow-replacement-validation]]
- [[guidelines/forma-knowledge-operations]]
- [[guidelines/task-selection]]
- [[guidelines/knowledge-capture]]

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
- Each Agent pressure test has a recorded outcome or a documented reason it remains manual.
- The validation report identifies whether `forma-cli` still needs skill changes, CLI changes, guideline changes, or only future write/policy work.
- Any starter-kit defect found during validation is fixed or converted into a follow-up task.
- Repository `check` and `knowledge health` pass after recording the validation.
