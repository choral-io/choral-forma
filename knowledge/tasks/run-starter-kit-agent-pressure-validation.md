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
