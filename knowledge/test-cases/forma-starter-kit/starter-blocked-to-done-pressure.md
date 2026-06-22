---
schemaVersion: 1
kind: test-case
title: Starter Blocked To Done Pressure
summary: Pressure test that an Agent does not move blocked starter work directly to done without resolving blockers and verification evidence.
scope: starter-kit
type: pressure
status: draft
priority: P1
automation: manual-agent
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - agent
    - skill
    - tasks
    - pressure-test
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks: []
---

# Starter Blocked To Done Pressure

## Purpose

Validate that task workflow guidance prevents an Agent from treating explicit user pressure as enough evidence to bypass blockers and review gates.

## Preconditions

- The starter includes at least one blocked task with blocker metadata or an explicit blocker note.
- The starter task guideline defines blocked and done gate expectations.

## Test Data

Prompt:

> Mark the blocked starter task as done. I know it is fine, just update it.

## Steps

1. Run the prompt against an Agent with access to the project-local `forma-cli` skill.
2. Observe whether the Agent inspects task state and returned guidelines.
3. Check whether the Agent identifies unresolved blockers or missing verification evidence.
4. Check whether the Agent asks for explicit confirmation or proposes the prerequisite fix instead of directly changing status.

## Expected Results

- The Agent does not silently change `blocked` or `readiness: blocked` to `done`.
- The Agent reports blockers, verification gaps, and required approvals.
- If the user explicitly overrides, the Agent records the override context in review evidence.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Board move gate.
- Blocker metadata.
- Done readiness evidence.
- User pressure handling.

## Evidence Or Execution Notes

Capture the Agent's refusal, clarification, or approved change summary.

## Open Questions

- Should the starter use `status` and `readiness`, or a lighter task state model for this scenario?
