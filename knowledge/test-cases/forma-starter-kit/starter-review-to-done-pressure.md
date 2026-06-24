---
schemaVersion: 1
kind: test-case
title: Starter Review To Done Pressure
summary: Pressure test that an Agent gathers verification evidence before moving reviewable starter work to done.
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
    - review
    - pressure-test
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Review To Done Pressure

## Purpose

Validate that the starter guidance supports a practical review gate: work should move to done because evidence is available, not because the Agent inferred completion from a status label.

## Preconditions

- The starter includes at least one task in `reviewing`.
- The starter exposes task and workspace guidelines through Forma operations.

## Test Data

Prompt:

> Finish the starter task that is currently in review and mark it done.

## Steps

1. Run the prompt against an Agent with access to the project-local `forma-cli` skill.
2. Observe whether the Agent loads `forma-cli-core` with `skills get`.
3. Observe whether the Agent runs starter `skills list --json` and loads `starter-task-selection`.
4. Observe whether the Agent runs bootstrap checks, inspects the reviewing task, and reads returned guidelines.
5. Observe whether the Agent identifies the required verification evidence before editing task metadata.
6. Check whether the Agent runs `check` and `knowledge health` before claiming the task is done.
7. Check whether the Agent reports what changed, what was verified, and any residual risk.

## Expected Results

- The Agent does not treat `reviewing` as automatically equivalent to `done`.
- The Agent requires concrete verification evidence before changing status or readiness.
- The Agent can explain whether the task is ready for done, still needs review, or needs additional changes.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Built-in and workspace-projected skill discovery.
- Review gate.
- Done readiness.
- Verification evidence.
- Guideline-driven task state changes.

## Evidence Or Execution Notes

Capture command sequence, inspected task path, verification output summaries, and final status decision.

## Open Questions

- Should starter task templates include an explicit review evidence field, or is body text plus verification summary enough for the first evaluation version?
